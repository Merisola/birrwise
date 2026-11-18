import { prisma } from '@/lib/prisma';
import { ToolDef, asStr, fail, resolveAccountRef } from './helpers';

export const moreReadTools: ToolDef[] = [
  {
    name: 'get_transaction',
    description: 'Get one transaction by id (full detail, including label and note).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const id = asStr(args?.id);
      if (!id) fail('id is required');
      const t = await prisma.transaction.findUnique({
        where: { id },
        include: { account: true, toAccount: true },
      });
      if (!t) fail('Transaction not found');
      return {
        id: t.id,
        date: t.date.toISOString().slice(0, 10),
        time: t.time,
        account: t.account.short,
        toAccount: t.toAccount?.short ?? null,
        name: t.name,
        category: t.category,
        type: t.type,
        amount: t.amount,
        note: t.note ?? null,
        label: t.label ?? null,
      };
    },
  },
  {
    name: 'list_budgets',
    description: 'List budgets (category limit per month).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () =>
      prisma.budget.findMany({ orderBy: { category: 'asc' } }),
  },
  {
    name: 'list_categories',
    description:
      'List all categories. Two levels max: a category with a parent is a subcategory.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => {
      const all = await prisma.category.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, icon: true, parentId: true },
      });
      const byId = new Map(all.map((c) => [c.id, c]));
      return all.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        parent: c.parentId ? byId.get(c.parentId)?.name ?? null : null,
        children: all.filter((k) => k.parentId === c.id).map((k) => k.name),
      }));
    },
  },
  {
    name: 'list_rules',
    description: 'List categorization rules (keyword -> category), newest first.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () =>
      prisma.rule.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, keyword: true, category: true },
      }),
  },
  {
    name: 'get_settings',
    description:
      'Get app settings (workspace, currency, date format, budget alerts). Never returns API keys.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => {
      const rows = await prisma.setting.findMany();
      const map = new Map(rows.map((r) => [r.key, r.value]));
      const bool = (k: string, d: boolean) =>
        map.has(k) ? map.get(k) === 'true' : d;
      return {
        workspace: map.get('workspace') ?? 'My workspace',
        currency: map.get('currency') ?? 'ETB',
        dateFormat: map.get('dateFormat') ?? 'DD/MM/YYYY',
        budget80: bool('budget80', true),
        budget100: bool('budget100', true),
        review: bool('review', true),
      };
    },
  },
  {
    name: 'resolve_account',
    description:
      'Resolve an account short name/id to a full account (useful before writing).',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string' },
        accountId: { type: 'string' },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const acct = await resolveAccountRef({
        account: args?.account,
        accountId: args?.accountId,
      });
      if (!acct) fail('Account not found');
      return {
        id: acct.id,
        name: acct.name,
        short: acct.short,
        type: acct.type,
        balance: acct.balance,
      };
    },
  },
];
