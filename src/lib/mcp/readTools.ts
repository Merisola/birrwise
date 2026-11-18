import { prisma } from '@/lib/prisma';
import { parsePeriodToBounds } from '@/lib/dates';
import { Period } from '@/types';
import {
  ToolDef,
  asStr,
  asNum,
  limit100,
  resolveAccountRef,
} from './helpers';

async function categoryIndex() {
  const all = await prisma.category.findMany({
    select: { id: true, name: true, parentId: true },
  });
  const byId = new Map(all.map((c) => [c.id, c]));
  const byName = new Map(all.map((c) => [c.name.toLowerCase(), c]));
  const parentOf = (name: string): string | null => {
    const cat = byName.get((name || '').toLowerCase());
    if (!cat?.parentId) return null;
    return byId.get(cat.parentId)?.name ?? null;
  };
  const widen = (filter: string): Set<string> => {
    const set = new Set<string>([filter.toLowerCase()]);
    const matched = byName.get(filter.toLowerCase());
    if (matched && !matched.parentId) {
      for (const c of all) {
        if (c.parentId === matched.id) set.add(c.name.toLowerCase());
      }
    }
    return set;
  };
  return { parentOf, widen };
}

export const readTools: ToolDef[] = [
  {
    name: 'get_summary',
    description:
      'Financial summary for a period (income, expenses, transaction count) plus current account balances. Transfers are excluded from income/expense.',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month', 'year', 'all'], default: 'month' },
        dateFrom: { type: 'string', description: 'YYYY-MM-DD (overrides period)' },
        dateTo: { type: 'string', description: 'YYYY-MM-DD (overrides period)' },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const period = (asStr(args?.period) || 'month') as Period;
      const { from, to } = parsePeriodToBounds(
        period,
        asStr(args?.dateFrom) || undefined,
        asStr(args?.dateTo) || undefined
      );
      const txs = await prisma.transaction.findMany({
        where: { date: { gte: from, lte: to } },
        select: { type: true, amount: true },
      });
      const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expenses = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const accounts = await prisma.account.findMany({
        orderBy: { createdAt: 'asc' },
        select: { name: true, short: true, type: true, balance: true },
      });
      return { period, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), income, expenses, count: txs.length, accounts };
    },
  },
  {
    name: 'list_accounts',
    description: 'List all accounts with id, name, short name, type and current balance.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () =>
      prisma.account.findMany({
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, short: true, type: true, balance: true, icon: true },
      }),
  },
  {
    name: 'list_transactions',
    description:
      'List transactions with optional filters. Amount is always positive; type carries direction (income/expense/transfer). Returns newest first.',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month', 'year', 'all'], default: 'month' },
        dateFrom: { type: 'string' },
        dateTo: { type: 'string' },
        search: { type: 'string', description: 'match name/note/label/account/category' },
        account: { type: 'string', description: 'account short name, e.g. Telebirr' },
        category: { type: 'string', description: 'main category also includes its subcategories' },
        type: { type: 'string', enum: ['income', 'expense', 'transfer'] },
        limit: { type: 'number', default: 20, maximum: 100 },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const period = (asStr(args?.period) || 'month') as Period;
      const { from, to } = parsePeriodToBounds(
        period,
        asStr(args?.dateFrom) || undefined,
        asStr(args?.dateTo) || undefined
      );
      const { parentOf, widen } = await categoryIndex();
      const categoryFilter = asStr(args?.category);
      const catSet = categoryFilter ? widen(categoryFilter) : null;
      const accountFilter = asStr(args?.account);
      const typeFilter = asStr(args?.type);
      const search = asStr(args?.search).toLowerCase();
      const limit = limit100(args?.limit, 20);

      const rows = await prisma.transaction.findMany({
        where: { date: { gte: from, lte: to } },
        include: { account: true, toAccount: true },
        orderBy: { date: 'desc' },
        take: 500,
      });
      return rows
        .map((t) => ({
          id: t.id,
          date: t.date.toISOString().slice(0, 10),
          time: t.time,
          account: t.account.short,
          toAccount: t.toAccount?.short ?? null,
          name: t.name,
          category: t.category,
          categoryParent: parentOf(t.category),
          type: t.type,
          amount: t.amount,
          note: t.note ?? null,
          label: t.label ?? null,
        }))
        .filter(
          (t) =>
            (!accountFilter || t.account === accountFilter || t.toAccount === accountFilter) &&
            (!catSet || catSet.has(t.category.toLowerCase())) &&
            (!typeFilter || t.type === typeFilter) &&
            (!search ||
              [t.name, t.note || '', t.label || '', t.account, t.category, t.categoryParent || '', String(t.amount)]
                .join(' ')
                .toLowerCase()
                .includes(search))
        )
        .slice(0, limit);
    },
  },
];
