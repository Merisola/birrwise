import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { suggestCategory } from '@/lib/categorization';
import { ImportRow } from '@/lib/import';

export async function POST(request: NextRequest) {
  try {
    const { transactions } = await request.json();

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: 'No transactions to import' },
        { status: 400 }
      );
    }

    // Validate and filter rows
    const validRows: ImportRow[] = [];
    const errors: { rowNumber: number; message: string }[] = [];

    for (const t of transactions) {
      if (!t.date || !t.name || !Number.isFinite(t.amount) || t.amount <= 0) {
        errors.push({ rowNumber: t.rowNumber || -1, message: 'Invalid date, name, or amount' });
        continue;
      }
      validRows.push(t);
    }

    if (validRows.length === 0) {
      return NextResponse.json(
        { error: 'No valid transactions to import', errors },
        { status: 400 }
      );
    }

    // Load accounts for resolution
    const allAccounts = await prisma.account.findMany();
    const acctMap: Record<string, string> = {};
    allAccounts.forEach(a => {
      acctMap[a.short.toLowerCase()] = a.id;
      acctMap[a.name.toLowerCase()] = a.id;
    });

    let defaultAccountId = acctMap['cash'] || (allAccounts.length > 0 ? allAccounts[0].id : null);

    if (!defaultAccountId) {
      const createdDefault = await prisma.account.create({
        data: { name: 'Cash wallet', short: 'Cash', type: 'Cash wallet', balance: 0, icon: '₿' },
      });
      defaultAccountId = createdDefault.id;
    }

    // Load rules for categorization
    const rules = await prisma.rule.findMany();

    // Build existing fingerprints for deduplication
    const existingTx = await prisma.transaction.findMany({
      select: { date: true, time: true, name: true, amount: true, accountId: true, type: true },
    });
    const accountShortMap = new Map(allAccounts.map(a => [a.id, a.short.toLowerCase()]));
    const existingFingerprints = new Set(
      existingTx.map(t =>
        `${t.date.toISOString().slice(0, 10)}|${t.time}|${t.name.toLowerCase().trim()}|${t.amount.toFixed(2)}|${accountShortMap.get(t.accountId) || ''}|${t.type}`
      )
    );

    const batchFingerprints = new Set<string>();
    let importedCount = 0;
    let skippedDuplicates = 0;
    let failedCount = 0;
    const importErrors: { rowNumber: number; message: string }[] = [];
    const unmatchedAccounts: string[] = [];
    const balanceDeltas = new Map<string, number>(); // accountId -> delta

    await prisma.$transaction(async (tx) => {
      for (const t of validRows) {
        const targetAccountId =
          acctMap[(t.account || '').toLowerCase()] || defaultAccountId;

        if (!acctMap[(t.account || '').toLowerCase()]) {
          if (!unmatchedAccounts.includes(t.account)) {
            unmatchedAccounts.push(t.account);
          }
        }

        const dateObj = t.date ? new Date(`${t.date.slice(0, 10)}T12:00:00Z`) : new Date();

        // Determine category
        let category = t.category || 'Uncategorized';
        if (t.type === 'expense' && (category === 'Uncategorized' || !category)) {
          category = suggestCategory(t.name, rules) || 'Uncategorized';
        } else if (t.type === 'income') {
          category = 'Income';
        } else if (t.type === 'transfer') {
          category = 'Internal transfer';
        }

        // Fingerprint for deduplication
        const fingerprint = `${t.date}|${t.time}|${t.name.toLowerCase().trim()}|${t.amount.toFixed(2)}|${targetAccountId}|${t.type}`;
        if (existingFingerprints.has(fingerprint) || batchFingerprints.has(fingerprint)) {
          skippedDuplicates++;
          continue;
        }

        // Handle transfer destination
        let toAccountId: string | null = null;
        if (t.type === 'transfer' && t.account !== t.category) {
          // If category looks like an account, try to resolve it
          // For now, we skip transfers without a clear destination
        }

        try {
          await tx.transaction.create({
            data: {
              date: dateObj,
              time: t.time || '12:00 PM',
              accountId: targetAccountId,
              toAccountId,
              name: t.name,
              category,
              type: t.type || 'expense',
              amount: Math.abs(Number(t.amount) || 0),
              icon: t.icon || (t.type === 'income' ? '↗' : t.type === 'transfer' ? '⇄' : '🛍'),
              note: t.note || 'Imported from CSV',
            },
          });

          // Aggregate balance changes
          const amt = Math.abs(Number(t.amount) || 0);
          if (t.type === 'income') {
            balanceDeltas.set(targetAccountId, (balanceDeltas.get(targetAccountId) || 0) + amt);
          } else {
            balanceDeltas.set(targetAccountId, (balanceDeltas.get(targetAccountId) || 0) - amt);
          }

          if (t.type === 'transfer' && toAccountId) {
            balanceDeltas.set(toAccountId, (balanceDeltas.get(toAccountId) || 0) + amt);
          }

          batchFingerprints.add(fingerprint);
          importedCount++;
        } catch (e) {
          failedCount++;
          importErrors.push({ rowNumber: t.rowNumber, message: e instanceof Error ? e.message : 'Insert failed' });
        }
      }

      // Apply balance deltas
      const updates = Array.from(balanceDeltas.entries())
        .filter(([, delta]) => delta !== 0)
        .map(([accountId, delta]) =>
          tx.account.update({
            where: { id: accountId },
            data: { balance: { increment: delta } },
          })
        );
      await Promise.all(updates);
    });

    // Determine date range of imported transactions
    const dates = validRows.map(t => t.date).filter(Boolean).sort();
    const dateRange = dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null;

    return NextResponse.json({
      imported: importedCount,
      skippedDuplicates,
      failed: failedCount,
      errors: importErrors,
      unmatchedAccounts: Array.from(new Set(unmatchedAccounts)),
      dateRange,
    });
  } catch (error) {
    console.error('Error committing import:', error);
    return NextResponse.json(
      { error: 'Failed to import transactions' },
      { status: 500 }
    );
  }
}