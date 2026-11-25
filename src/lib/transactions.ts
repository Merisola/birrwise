/**
 * Shared transaction write logic.
 *
 * Used identically by:
 *   - the web API routes (src/app/api/transactions/route.ts, [id]/route.ts)
 *   - the MCP endpoint (staged operations confirmed by the user)
 *
 * Every balance effect is applied exactly once through reverseApplyBalance
 * so create/update/delete always leave account balances consistent.
 */
import { prisma } from '@/lib/prisma';
import { suggestCategory } from '@/lib/categorization';
import { Prisma } from '@prisma/client';

export class TransactionInputError extends Error {}
export class NotFoundError extends Error {}

// Same icon defaults the create route has always used.
export const DEFAULT_ICONS = {
  income: '↗',
  transfer: '⇄',
  expense: '🛍',
} as const;

export interface CreateTransactionInput {
  date?: string | Date | null;
  time?: string | null;
  account?: string | null;
  accountId?: string | null;
  toAccount?: string | null;
  toAccountId?: string | null;
  name: string;
  category?: string | null;
  type?: 'income' | 'expense' | 'transfer' | null;
  amount: number | string;
  icon?: string | null;
  note?: string | null;
  label?: string | null;
  transferDirection?: 'in' | 'out' | null;
  transferGroupId?: string | null;
  externalRef?: string | null;
}

const includeRels = {
  account: true,
  toAccount: true,
} as const;

async function resolveAccount(ref: {
  account?: string | null;
  accountId?: string | null;
}) {
  if (ref.accountId) {
    return prisma.account.findUnique({ where: { id: ref.accountId } });
  }
  if (ref.account) {
    return prisma.account.findFirst({
      where: {
        OR: [{ short: ref.account }, { name: ref.account }, { id: ref.account }],
      },
    });
  }
  return null;
}

/** Apply (direction=1) or reverse (direction=-1) a transaction's balance effect. */
async function reverseApplyBalance(
  tx: Prisma.TransactionClient,
  row: {
    type: string;
    accountId: string;
    toAccountId: string | null;
    amount: number;
    transferDirection?: string | null;
  },
  direction: 1 | -1
) {
  const amt = row.amount * direction;
  if (row.type === 'expense') {
    await tx.account.update({
      where: { id: row.accountId },
      data: { balance: { increment: -amt } }, // expense subtracts on apply
    });
  } else if (row.type === 'income') {
    await tx.account.update({
      where: { id: row.accountId },
      data: { balance: { increment: amt } },
    });
  } else if (row.type === 'transfer') {
    // Two-row transfers (BOA out + Telebirr in) carry a direction and no
    // toAccountId. Legacy/manual transfers have a destination and are outgoing.
    const incoming = row.transferDirection === 'in' && !row.toAccountId;
    if (incoming) {
      await tx.account.update({
        where: { id: row.accountId },
        data: { balance: { increment: amt } }, // receiving account gains funds
      });
      return;
    }
    await tx.account.update({
      where: { id: row.accountId },
      data: { balance: { increment: -amt } }, // source loses funds
    });
    if (row.toAccountId) {
      await tx.account.update({
        where: { id: row.toAccountId },
        data: { balance: { increment: amt } }, // destination gains funds
      });
    }
  }
}

export async function createTransactionRecord(input: CreateTransactionInput) {
  const {
    date,
    time,
    account,
    accountId,
    toAccount,
    toAccountId,
    name,
    icon,
    note,
    label,
    transferDirection,
    transferGroupId,
    externalRef,
  } = input;
  let { category, type } = input;

  const amount = Number(input.amount);
  if (!amount || amount <= 0 || !name || !String(name).trim()) {
    throw new TransactionInputError('Invalid transaction details');
  }

  // Resolve source account (fallback: Cash, mirroring current behavior)
  let srcAccount = await resolveAccount({ account, accountId });
  if (!srcAccount) {
    srcAccount = await prisma.account.findFirst({ where: { short: 'Cash' } });
  }
  if (!srcAccount) {
    throw new TransactionInputError('Source account not found');
  }

  // Resolve destination account for transfers
  let dstAccount = null;
  if (type === 'transfer') {
    dstAccount = await resolveAccount({ account: toAccount, accountId: toAccountId });
  }

  // Auto-categorize if expense and uncategorized
  if (type === 'expense' && (!category || category === 'Uncategorized')) {
    const rules = await prisma.rule.findMany();
    category = suggestCategory(String(name).trim(), rules) || 'Uncategorized';
  } else if (!category) {
    category =
      type === 'income'
        ? 'Income'
        : type === 'transfer'
        ? 'Internal transfer'
        : 'Uncategorized';
  }

  const txDate = date
    ? new Date(
        (date instanceof Date
          ? date.toISOString().slice(0, 10)
          : String(date).slice(0, 10)) + 'T12:00:00Z'
      )
    : new Date();

  const createData = {
    date: txDate,
    time: time || '12:00 PM',
    accountId: srcAccount.id,
    toAccountId: dstAccount?.id || null,
    name: String(name).trim(),
    category,
    type: (type || 'expense') as string,
    amount,
    icon:
      icon ||
      (type === 'income'
        ? DEFAULT_ICONS.income
        : type === 'transfer'
        ? DEFAULT_ICONS.transfer
        : DEFAULT_ICONS.expense),
    note: note || '',
    label: label ? String(label).trim().slice(0, 140) : null,
    transferDirection:
      type === 'transfer' && (transferDirection === 'in' || transferDirection === 'out')
        ? transferDirection
        : null,
    transferGroupId: transferGroupId || null,
    externalRef: externalRef || null,
  };

  return prisma.$transaction(async (tx) => {
    await reverseApplyBalance(tx, createData, 1);
    return tx.transaction.create({ data: createData, include: includeRels });
  });
}

export interface UpdateTransactionInput {
  date?: string | null;
  time?: string | null;
  account?: string | null;
  accountId?: string | null;
  toAccount?: string | null;
  toAccountId?: string | null;
  name?: string | null;
  category?: string | null;
  type?: string | null;
  amount?: number | string | null;
  icon?: string | null;
  note?: string | null;
  label?: string | null;
  transferDirection?: 'in' | 'out' | null;
  transferGroupId?: string | null;
  externalRef?: string | null;
}

export async function updateTransactionRecord(
  id: string,
  patch: UpdateTransactionInput
) {
  const existing = await prisma.transaction.findUnique({
    where: { id },
    include: { account: true, toAccount: true },
  });
  if (!existing) {
    throw new NotFoundError('Transaction not found');
  }

  // Resolve new accounts only when explicitly referenced; otherwise unchanged.
  let newSrcId = existing.accountId;
  if (patch.accountId !== undefined) {
    const acct = await resolveAccount({ accountId: patch.accountId });
    if (!acct) throw new NotFoundError('Source account not found');
    newSrcId = acct.id;
  } else if (patch.account !== undefined) {
    const acct = await resolveAccount({ account: patch.account });
    if (!acct) throw new NotFoundError('Source account not found');
    newSrcId = acct.id;
  }

  let newDstId = existing.toAccountId;
  if (patch.toAccountId !== undefined || patch.toAccount !== undefined) {
    const dst = await resolveAccount({
      account: patch.toAccount,
      accountId: patch.toAccountId,
    });
    newDstId = dst?.id ?? null;
  }

  const newAmount =
    patch.amount === undefined || patch.amount === null
      ? existing.amount
      : Number(patch.amount);
  if (!newAmount || newAmount <= 0 || Number.isNaN(newAmount)) {
    throw new TransactionInputError('Amount must be a positive number');
  }
  const newType = patch.type ?? existing.type;
  const newTransferDirection =
    patch.transferDirection !== undefined
      ? patch.transferDirection
      : existing.transferDirection;

  const data: Prisma.TransactionUpdateInput = {
    ...(patch.date !== undefined && patch.date !== null
      ? { date: new Date(String(patch.date).slice(0, 10) + 'T12:00:00Z') }
      : {}),
    ...(patch.time !== undefined ? { time: patch.time || '12:00 PM' } : {}),
    ...(patch.name !== undefined && patch.name ? { name: String(patch.name).trim() } : {}),
    ...(patch.category !== undefined && patch.category
      ? { category: String(patch.category) }
      : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
    ...(patch.label !== undefined
      ? { label: patch.label ? String(patch.label).trim().slice(0, 140) : null }
      : {}),
    ...(patch.icon !== undefined ? { icon: patch.icon || DEFAULT_ICONS.expense } : {}),
    ...(patch.type !== undefined && patch.type ? { type: patch.type } : {}),
    ...(patch.amount !== undefined ? { amount: newAmount } : {}),
    ...(patch.transferDirection !== undefined
      ? { transferDirection: patch.transferDirection }
      : {}),
    ...(patch.transferGroupId !== undefined
      ? { transferGroupId: patch.transferGroupId }
      : {}),
    ...(patch.externalRef !== undefined ? { externalRef: patch.externalRef } : {}),
    ...(newSrcId !== existing.accountId
      ? { account: { connect: { id: newSrcId } } }
      : {}),
    ...(newDstId !== existing.toAccountId
      ? newDstId
        ? { toAccount: { connect: { id: newDstId } } }
        : { toAccount: { disconnect: true } }
      : {}),
  };

  // Skip the reverse/apply round-trip entirely when nothing balance-relevant
  // changed (avoids floating-point dust on label/category-only edits).
  const balanceChanged =
    newAmount !== existing.amount ||
    newType !== existing.type ||
    newSrcId !== existing.accountId ||
    newDstId !== existing.toAccountId ||
    newTransferDirection !== existing.transferDirection;

  return prisma.$transaction(async (tx) => {
    if (balanceChanged) {
      // Reverse the old effect, then apply the new one.
      await reverseApplyBalance(
        tx,
        {
          type: existing.type,
          accountId: existing.accountId,
          toAccountId: existing.toAccountId,
          amount: existing.amount,
          transferDirection: existing.transferDirection,
        },
        -1
      );
      await reverseApplyBalance(
        tx,
        {
          type: newType,
          accountId: newSrcId,
          toAccountId: newDstId,
          amount: newAmount,
          transferDirection: newTransferDirection,
        },
        1
      );
    }
    return tx.transaction.update({ where: { id }, data, include: includeRels });
  });
}

export async function deleteTransactionRecord(id: string) {
  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Transaction not found');
  }

  await prisma.$transaction(async (tx) => {
    await reverseApplyBalance(
      tx,
      {
        type: existing.type,
        accountId: existing.accountId,
        toAccountId: existing.toAccountId,
        amount: existing.amount,
        transferDirection: existing.transferDirection,
      },
      -1
    );
    await tx.transaction.delete({ where: { id } });
  });

  return { success: true };
}
