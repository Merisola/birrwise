import { prisma } from '@/lib/prisma';
import { suggestCategory } from '@/lib/categorization';
import {
  ToolDef,
  asStr,
  asNum,
  fail,
  resolveAccountRef,
  resolveCategoryRef,
  SYSTEM_CATEGORIES,
} from './helpers';
import { stageAction } from './pending';

const CONFIRM_HINT =
  'Show this preview to the user. Ask for explicit approval. Only then call confirm_action with the token. Never confirm on your own.';

async function previewAccount(ref: { account?: any; accountId?: any }, label: string) {
  const acct = await resolveAccountRef(ref);
  if (!acct) fail(`${label} account not found`);
  return acct;
}

export const stageTools: ToolDef[] = [
  {
    name: 'stage_transaction_create',
    description:
      'STAGE a new transaction. Nothing is written until the user approves and you call confirm_action. Use for purchases, income and transfers the user wants recorded.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'counterparty / description, never the bank name' },
        amount: { type: 'number', description: 'positive amount' },
        type: { type: 'string', enum: ['income', 'expense', 'transfer'], default: 'expense' },
        account: { type: 'string', description: 'source account short name, e.g. Telebirr' },
        accountId: { type: 'string' },
        toAccount: { type: 'string', description: 'destination account for transfers' },
        toAccountId: { type: 'string' },
        category: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD, default today' },
        time: { type: 'string' },
        icon: { type: 'string' },
        note: { type: 'string' },
        label: { type: 'string' },
      },
      required: ['name', 'amount'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const amount = asNum(args?.amount);
      if (!(amount > 0)) fail('amount must be a positive number');
      const name = asStr(args?.name);
      if (!name) fail('name is required');

      const type = asStr(args?.type) || 'expense';
      if (!['income', 'expense', 'transfer'].includes(type)) fail('invalid type');

      const src = await previewAccount(
        { account: args?.account, accountId: args?.accountId },
        'Source'
      );
      let dstShort: string | null = null;
      if (type === 'transfer') {
        const dst = await previewAccount(
          { account: args?.toAccount, accountId: args?.toAccountId },
          'Destination'
        );
        dstShort = dst.short;
      }

      let category = asStr(args?.category);
      if (type === 'expense' && (!category || category === 'Uncategorized')) {
        const rules = await prisma.rule.findMany();
        category = suggestCategory(name, rules) || 'Uncategorized';
      } else if (!category) {
        category =
          type === 'income' ? 'Income' : type === 'transfer' ? 'Internal transfer' : 'Uncategorized';
      }

      const preview = {
        action: 'Create transaction',
        type,
        name,
        amount,
        account: src.short,
        ...(dstShort ? { toAccount: dstShort } : {}),
        category,
        ...(args?.date ? { date: asStr(args?.date) } : {}),
        ...(args?.time ? { time: asStr(args?.time) } : {}),
        ...(args?.note ? { note: asStr(args?.note) } : {}),
        ...(args?.label ? { label: asStr(args?.label) } : {}),
      };
      const { token, expiresAt } = await stageAction(
        'txn.create',
        { ...args, name, amount, type },
        preview
      );
      return { staged: true, preview, token, expiresAt, instruction: CONFIRM_HINT };
    },
  },
  {
    name: 'stage_transaction_update',
    description:
      'STAGE changes to an existing transaction (name, category, amount, type, date, time, account, note, label, icon). Balance-relevant changes are applied on approval.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        category: { type: 'string' },
        amount: { type: 'number' },
        type: { type: 'string', enum: ['income', 'expense', 'transfer'] },
        date: { type: 'string' },
        time: { type: 'string' },
        account: { type: 'string' },
        accountId: { type: 'string' },
        toAccount: { type: 'string' },
        toAccountId: { type: 'string' },
        note: { type: 'string' },
        label: { type: 'string', description: 'empty string clears the label' },
        icon: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const id = asStr(args?.id);
      if (!id) fail('id is required');
      const existing = await prisma.transaction.findUnique({
        where: { id },
        include: { account: true, toAccount: true },
      });
      if (!existing) fail('Transaction not found');

      const patch: Record<string, any> = {};
      const before: Record<string, any> = {};
      const after: Record<string, any> = {};
      const pick = (key: string, value: any, beforeValue: any, afterValue: any) => {
        if (value !== undefined) {
          patch[key] = value;
          before[key] = beforeValue;
          after[key] = afterValue;
        }
      };

      pick('name', args?.name !== undefined ? asStr(args?.name) : undefined, existing.name, asStr(args?.name));
      pick('category', args?.category !== undefined ? asStr(args?.category) : undefined, existing.category, asStr(args?.category));
      pick('time', args?.time !== undefined ? asStr(args?.time) : undefined, existing.time, asStr(args?.time));
      pick('note', args?.note !== undefined ? asStr(args?.note) : undefined, existing.note ?? '', asStr(args?.note));
      pick('icon', args?.icon !== undefined ? asStr(args?.icon) : undefined, existing.icon, asStr(args?.icon));
      if (args?.label !== undefined) {
        const l = asStr(args?.label);
        patch.label = l ? l.slice(0, 140) : null;
        before.label = existing.label ?? null;
        after.label = patch.label;
      }
      if (args?.date !== undefined) {
        patch.date = asStr(args?.date);
        before.date = existing.date.toISOString().slice(0, 10);
        after.date = patch.date;
      }
      if (args?.amount !== undefined) {
        const n = asNum(args?.amount);
        if (!(n > 0)) fail('amount must be a positive number');
        patch.amount = n;
        before.amount = existing.amount;
        after.amount = n;
      }
      if (args?.type !== undefined) {
        const t = asStr(args?.type);
        if (!['income', 'expense', 'transfer'].includes(t)) fail('invalid type');
        patch.type = t;
        before.type = existing.type;
        after.type = t;
      }
      if (args?.account !== undefined || args?.accountId !== undefined) {
        const acct = await previewAccount(
          { account: args?.account, accountId: args?.accountId },
          'Source'
        );
        patch.accountId = acct.id;
        before.account = existing.account.short;
        after.account = acct.short;
      }
      if (args?.toAccount !== undefined || args?.toAccountId !== undefined) {
        const dst = await resolveAccountRef({
          account: args?.toAccount,
          accountId: args?.toAccountId,
        });
        patch.toAccountId = dst?.id ?? null;
        before.toAccount = existing.toAccount?.short ?? null;
        after.toAccount = dst?.short ?? null;
      }

      const changedKeys = Object.keys(patch);
      if (changedKeys.length === 0) {
        return { staged: false, message: 'No changes requested' };
      }
      const preview = {
        action: 'Update transaction',
        id,
        name: existing.name,
        changes: changedKeys.reduce((acc: any, k) => {
          acc[k] = { from: before[k], to: after[k] };
          return acc;
        }, {}),
      };
      const { token, expiresAt } = await stageAction('txn.update', { id, ...patch }, preview);
      return { staged: true, preview, token, expiresAt, instruction: CONFIRM_HINT };
    },
  },
  {
    name: 'stage_transaction_delete',
    description:
      'STAGE deletion of a transaction. The balance effect is reversed on approval. This cannot be undone.',
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
      const preview = {
        action: 'DELETE transaction (irreversible)',
        id,
        name: t.name,
        type: t.type,
        amount: t.amount,
        account: t.account.short,
        ...(t.toAccount ? { toAccount: t.toAccount.short } : {}),
        date: t.date.toISOString().slice(0, 10),
        note: `Balance will be reversed on ${t.account.short}${t.toAccount ? ' and ' + t.toAccount.short : ''}`,
      };
      const { token, expiresAt } = await stageAction('txn.delete', { id }, preview);
      return { staged: true, preview, token, expiresAt, instruction: CONFIRM_HINT };
    },
  },
  {
    name: 'stage_transaction_set_label',
    description:
      "STAGE setting (or clearing) the user's personal label on a transaction. Pass empty string to clear.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        label: { type: 'string', description: 'empty string clears the label' },
      },
      required: ['id', 'label'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const id = asStr(args?.id);
      if (!id) fail('id is required');
      const t = await prisma.transaction.findUnique({ where: { id } });
      if (!t) fail('Transaction not found');
      const l = asStr(args?.label).slice(0, 140);
      const preview = {
        action: l ? 'Set label on transaction' : 'Clear label on transaction',
        id,
        name: t.name,
        from: t.label ?? null,
        to: l || null,
      };
      const { token, expiresAt } = await stageAction(
        'txn.setLabel',
        { id, label: l || null },
        preview
      );
      return { staged: true, preview, token, expiresAt, instruction: CONFIRM_HINT };
    },
  },
];
