import { prisma } from '@/lib/prisma';
import {
  createTransactionRecord,
  updateTransactionRecord,
  deleteTransactionRecord,
} from '@/lib/transactions';
import {
  ToolDef,
  asStr,
  fail,
  resolveCategoryRef,
  SYSTEM_CATEGORIES,
} from './helpers';
import {
  findPendingAction,
  consumePendingAction,
  listPendingActions,
  safeParse,
} from './pending';

export const confirmTools: ToolDef[] = [
  {
    name: 'confirm_action',
    description:
      'Execute a staged action by its confirmation token. Only call this AFTER the user has explicitly approved the preview shown to them. Single-use, 10-minute expiry.',
    inputSchema: {
      type: 'object',
      properties: { token: { type: 'string' } },
      required: ['token'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const token = asStr(args?.token);
      if (!token) fail('token is required');
      const row = await findPendingAction(token);
      if (!row) fail('Invalid confirmation token');
      if (row.consumedAt) fail('This confirmation token was already used');
      if (row.expiresAt < new Date()) fail('This confirmation token has expired');

      const payload = safeParse(row.payload);
      if (!payload) fail('Pending action payload is corrupt');
      const { kind, args: p } = payload;

      let result: any;
      switch (kind) {
        case 'txn.create': {
          const created = await createTransactionRecord(p as any);
          result = {
            id: created.id,
            name: created.name,
            type: created.type,
            amount: created.amount,
            account: created.account.short,
            category: created.category,
          };
          break;
        }
        case 'txn.update': {
          const { id, ...patch } = p as any;
          const updated = await updateTransactionRecord(id, patch);
          result = {
            id: updated.id,
            name: updated.name,
            category: updated.category,
            amount: updated.amount,
          };
          break;
        }
        case 'txn.delete': {
          await deleteTransactionRecord((p as any).id);
          result = { deleted: (p as any).id };
          break;
        }
        case 'txn.setLabel': {
          const { id, label } = p as any;
          const updated = await updateTransactionRecord(id, { label });
          result = { id: updated.id, label: updated.label ?? null };
          break;
        }
        case 'budget.delete': {
          await prisma.budget.delete({ where: { category: (p as any).category } });
          result = { deletedBudget: (p as any).category };
          break;
        }
        case 'category.delete': {
          const target = await resolveCategoryRef({ id: (p as any).id });
          if (!target) fail('Category no longer exists');
          if (SYSTEM_CATEGORIES.includes(target.name)) {
            fail('System categories cannot be deleted');
          }
          await prisma.category.delete({ where: { id: target.id } });
          result = { deletedCategory: target.name, note: 'Subcategories (if any) moved to root' };
          break;
        }
        case 'rule.delete': {
          await prisma.rule.delete({ where: { id: (p as any).id } });
          result = { deletedRule: (p as any).id };
          break;
        }
        default:
          fail(`Unknown pending action kind: ${kind}`);
      }

      await consumePendingAction(row.id);
      return { executed: kind, result };
    },
  },
  {
    name: 'cancel_action',
    description: 'Cancel a staged action without executing it.',
    inputSchema: {
      type: 'object',
      properties: { token: { type: 'string' } },
      required: ['token'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const token = asStr(args?.token);
      if (!token) fail('token is required');
      const row = await findPendingAction(token);
      if (!row) fail('Invalid confirmation token');
      if (row.consumedAt) fail('This token was already used or cancelled');
      await consumePendingAction(row.id);
      return { cancelled: row.kind };
    },
  },
  {
    name: 'list_pending_actions',
    description:
      'List pending (unconfirmed, unexpired) staged actions. Useful to recover a token.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => listPendingActions(),
  },
];
