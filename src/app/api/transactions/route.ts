import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createTransactionRecord, TransactionInputError, NotFoundError } from '@/lib/transactions';
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

    // Category registry: used to (a) embed the parent name on each row and
    // (b) widen a main-category filter to include its subcategories.
    const allCategories = await prisma.category.findMany({
      select: { id: true, name: true, parentId: true },
    });
    const byId = new Map(allCategories.map((c) => [c.id, c]));
    const byName = new Map(allCategories.map((c) => [c.name.toLowerCase(), c]));
    const parentOf = (name: string): string | null => {
      const cat = byName.get((name || '').toLowerCase());
      if (!cat?.parentId) return null;
      return byId.get(cat.parentId)?.name ?? null;
    };
    // If the filter is a main category, its subs match too.
    const categoryFilterSet = new Set<string>(
      categoryFilter === 'all' ? [] : [categoryFilter.toLowerCase()]
    );
    if (categoryFilter !== 'all') {
      const matched = byName.get(categoryFilter.toLowerCase());
      if (matched && !matched.parentId) {
        for (const c of allCategories) {
          if (c.parentId === matched.id) {
            categoryFilterSet.add(c.name.toLowerCase());
          }
        }
      }
    }

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
      categoryParent: parentOf(t.category),
    }));

    const filtered = formatted.filter((t) => {
      const acctShort = t.account.short;
      const toShort = t.toAccount?.short;
      const matchAccount =
        accountFilter === 'all' ||
        acctShort === accountFilter ||
        toShort === accountFilter;

      const matchCategory =
        categoryFilter === 'all' ||
        categoryFilterSet.has(t.category.toLowerCase());

      const matchType = typeFilter === 'all' || t.type === typeFilter;

      const searchTerms = [
        t.name,
        t.note || '',
        t.label || '',
        t.account.name,
        t.account.short,
        t.category,
        t.categoryParent || '',
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
    const created = await createTransactionRecord(body);
    return NextResponse.json({
      ...created,
      date: created.date.toISOString().slice(0, 10),
    });
  } catch (error) {
    if (error instanceof TransactionInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}
export const dynamic = 'force-dynamic';
