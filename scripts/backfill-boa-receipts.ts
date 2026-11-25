/**
 * One-off, idempotent backfill for BOA SMS rows that were ingested before
 * receipt enrichment existed.
 *
 *   npx tsx scripts/backfill-boa-receipts.ts           # dry run
 *   npx tsx scripts/backfill-boa-receipts.ts --apply   # write
 *
 * What it does, per reference:
 *   - CBE transfer: replaces the generic "BOA debit" name with the receiver
 *     from the receipt and stores the FT reference. Amount is unchanged.
 *   - Telebirr top-up: splits the single BOA expense into a 220.00 transfer
 *     row (direction "out") plus a separate 12.00 fee expense, and links the
 *     existing Telebirr transfer-in row through a shared transferGroupId.
 *
 * It never touches account balances: 220 + 12 still equals the original 232,
 * and the Telebirr row was already credited when it was first ingested.
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  BOA_TELEBIRR_FEE_NAME,
  boaFeeNote,
  buildBoaEnrichment,
  fetchBoaReceipt,
} from '../src/lib/boaReceipt';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const REFS = ['FT26328BZ03948564', 'FT26328LZQ7148564'] as const;

function money(n: number): string {
  return n.toFixed(2);
}

function log(...args: unknown[]) {
  console.log(APPLY ? '[apply]' : '[dry-run]', ...args);
}

async function main() {
  const accounts = await prisma.account.findMany();
  const byShort = (short: string) =>
    accounts.find((a) => a.short.toLowerCase() === short.toLowerCase());

  const boa = byShort('BOA');
  const telebirr = byShort('Telebirr');
  if (!boa) throw new Error('No BOA account found');
  if (!telebirr) throw new Error('No Telebirr account found');

  for (const ref of REFS) {
    const row = await prisma.transaction.findFirst({
      where: {
        accountId: boa.id,
        note: { contains: ref },
        // `NOT` on a nullable column would also drop rows where externalRef is
        // still NULL (SQL three-valued logic), so match explicitly instead.
        OR: [{ externalRef: null }, { externalRef: ref }],
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!row) {
      log(`${ref}: no BOA row found — skipped`);
      continue;
    }

    const receipt = await fetchBoaReceipt(ref);
    if (!receipt) {
      log(`${ref}: receipt unavailable — left unchanged (generic fallback)`);
      continue;
    }

    const smsAmount =
      receipt.totalAmount !== undefined ? receipt.totalAmount : row.amount;
    const enrichment = buildBoaEnrichment(receipt, {
      smsAmount,
      isDebit: true,
      fallbackName: row.name,
    });

    if (!enrichment.isTelebirr) {
      // Only replace the generic parser name; keep a name/category the user
      // may already have edited.
      const genericName = /^BOA (debit|credit)$/i.test(row.name);
      log(
        `${ref}: ${genericName ? `rename "${row.name}" → "${enrichment.name}"` : 'keep custom name'} (amount ${money(
          row.amount
        )} unchanged)`
      );
      if (APPLY) {
        await prisma.transaction.update({
          where: { id: row.id },
          data: {
            ...(genericName ? { name: enrichment.name } : {}),
            note: enrichment.note,
            externalRef: ref,
          },
        });
      }
      continue;
    }

    const sibling = await prisma.transaction.findFirst({
      where: {
        accountId: telebirr.id,
        amount: enrichment.principalAmount,
        date: row.date,
        // Older pulls may have been stored as income; both already credit the
        // wallet, so converting to a transfer-in keeps the balance unchanged.
        type: { in: ['transfer', 'income'] },
        OR: [
          { note: { contains: 'Bank of Abyssinia' } },
          { name: { contains: 'Internal transfer' } },
          { name: { contains: 'Transfer from' } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    const existingFee = await prisma.transaction.findUnique({
      where: { externalRef: `${ref}:fee` },
    });

    const groupId =
      row.transferGroupId || sibling?.transferGroupId || existingFee?.transferGroupId || randomUUID();

    const telebirrRef = sibling?.note
      ? /trx\s+([A-Z0-9]+)/i.exec(sibling.note)?.[1]
      : undefined;

    log(
      `${ref}: split "${row.name}" ${money(row.amount)} into transfer ${money(
        enrichment.principalAmount
      )} + fee ${money(enrichment.feeAmount)}; sibling ${
        sibling ? `"${sibling.name}" (${sibling.id})` : 'not found'
      }; group ${groupId}`
    );

    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: row.id },
        data: {
          name: enrichment.name,
          category: enrichment.category,
          type: 'transfer',
          amount: enrichment.principalAmount,
          note: enrichment.note,
          externalRef: ref,
          transferDirection: 'out',
          transferGroupId: groupId,
        },
      });

      if (sibling) {
        await tx.transaction.update({
          where: { id: sibling.id },
          data: {
            name: 'Transfer from BOA',
            category: 'Internal transfer',
            type: 'transfer',
            transferDirection: 'in',
            transferGroupId: groupId,
            ...(telebirrRef ? { externalRef: telebirrRef } : {}),
          },
        });
      }

      if (enrichment.feeAmount > 0) {
        const feeData = {
          date: row.date,
          time: row.time,
          accountId: boa.id,
          name: BOA_TELEBIRR_FEE_NAME,
          category: 'Uncategorized',
          type: 'expense',
          amount: enrichment.feeAmount,
          icon: '🧾',
          note: `${boaFeeNote(receipt, enrichment.feeAmount)} · Added by backfill`,
          transferGroupId: groupId,
        };
        await tx.transaction.upsert({
          where: { externalRef: `${ref}:fee` },
          create: { ...feeData, externalRef: `${ref}:fee` },
          update: feeData,
        });
      }
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
