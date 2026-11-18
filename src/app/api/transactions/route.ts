import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { suggestCategory } from '@/lib/categorization';
import { parsePeriodToBounds } from '@/lib/dates';
import { Period } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || 'week') as Period;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = (searchParams.get('search') || '').toLowerCase();
    const accountFilter = searchParams.get('account') || 'all';
    const categoryFilter = searchParams.get('category') || 'all';
    const typeFilter = searchParams.get('type') || 'all';

    const { from, to } = parsePeriodToBounds(period, dateFrom || undefined, dateTo || undefined);

    const transactions = await prisma.transaction.findMany({
      where: {
        date: {
          gte: from,
          lte: to,
        },
      },
      include: {
        account: true,
        toAccount: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Format & client-compatible filter
    const formatted = transactions.map((t) => ({
      ...t,
      date: t.date.toISOString().slice(0, 10),
    }));

    const filtered = formatted.filter((t) => {
      const acctShort = t.account.short;
      const toShort = t.toAccount?.short;
      const matchAccount =
        accountFilter === 'all' ||
        acctShort === accountFilter ||
        toShort === accountFilter;

      const matchCategory =
        categoryFilter === 'all' || t.category === categoryFilter;

      const matchType = typeFilter === 'all' || t.type === typeFilter;

      const searchTerms = [
        t.name,
        t.note || '',
        t.account.name,
        t.account.short,
        t.category,
        t.amount.toString(),
      ]
        .join(' ')
        .toLowerCase();
      const matchSearch = !search || searchTerms.includes(search);

      return matchAccount && matchCategory && matchType && matchSearch;
    });

    const income = filtered
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = filtered
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return NextResponse.json({
      transactions: filtered,
      summary: {
        income,
        expenses,
        count: filtered.length,
      },
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let {
      date,
      time,
      account,
      accountId,
      toAccount,
      toAccountId,
      name,
      category,
      type,
      amount,
      icon,
      note,
    } = body;

    amount = Number(amount);
    if (!amount || amount <= 0 || !name) {
      return NextResponse.json(
        { error: 'Invalid transaction details' },
        { status: 400 }
      );
    }

    // Resolve account ID
    let srcAccount = null;
    if (accountId) {
      srcAccount = await prisma.account.findUnique({ where: { id: accountId } });
    } else if (account) {
      srcAccount = await prisma.account.findFirst({
        where: { OR: [{ short: account }, { name: account }, { id: account }] },
      });
    }

    if (!srcAccount) {
      srcAccount = await prisma.account.findFirst({ where: { short: 'Cash' } });
    }

    if (!srcAccount) {
      return NextResponse.json(
        { error: 'Source account not found' },
        { status: 400 }
      );
    }

    // Resolve destination account for transfer
    let dstAccount = null;
    if (type === 'transfer') {
      if (toAccountId) {
        dstAccount = await prisma.account.findUnique({ where: { id: toAccountId } });
      } else if (toAccount) {
        dstAccount = await prisma.account.findFirst({
          where: { OR: [{ short: toAccount }, { name: toAccount }, { id: toAccount }] },
        });
      }
    }

    // Auto-categorize if expense and uncategorized
    if (type === 'expense' && (!category || category === 'Uncategorized')) {
      const rules = await prisma.rule.findMany();
      category = suggestCategory(name, rules) || 'Uncategorized';
    } else if (!category) {
      category = type === 'income' ? 'Income' : type === 'transfer' ? 'Internal transfer' : 'Uncategorized';
    }

    const txDate = date ? new Date(`${date.slice(0, 10)}T12:00:00Z`) : new Date();

    const created = await prisma.$transaction(async (tx) => {
      // Adjust source balance
      if (type === 'expense') {
        await tx.account.update({
          where: { id: srcAccount.id },
          data: { balance: { decrement: amount } },
        });
      } else if (type === 'income') {
        await tx.account.update({
          where: { id: srcAccount.id },
          data: { balance: { increment: amount } },
        });
      } else if (type === 'transfer') {
        await tx.account.update({
          where: { id: srcAccount.id },
          data: { balance: { decrement: amount } },
        });
        if (dstAccount) {
          await tx.account.update({
            where: { id: dstAccount.id },
            data: { balance: { increment: amount } },
          });
        }
      }

      return tx.transaction.create({
        data: {
          date: txDate,
          time: time || '12:00 PM',
          accountId: srcAccount.id,
          toAccountId: dstAccount?.id || null,
          name,
          category,
          type: type || 'expense',
          amount,
          icon: icon || (type === 'income' ? '↗' : type === 'transfer' ? '⇄' : '🛍'),
          note: note || '',
        },
        include: {
          account: true,
          toAccount: true,
        },
      });
    });

    return NextResponse.json({
      ...created,
      date: created.date.toISOString().slice(0, 10),
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}
export const dynamic = 'force-dynamic';
