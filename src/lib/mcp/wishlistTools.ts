import { prisma } from '@/lib/prisma';
import {
  ToolDef,
  asStr,
  asBool,
  fail,
  resolveAccountRef,
} from './helpers';
import { stageAction } from './pending';
import {
  buildWishlistData,
} from '@/lib/wishlist';
import {
  validateItemInput,
  serializeItem,
  serializeComputed,
} from '@/lib/wishlistIO';

const CONFIRM_HINT =
  'Show this preview to the user. Ask for explicit approval. Only then call confirm_action with the token. Never confirm on your own.';

export const wishlistReadTools: ToolDef[] = [
  {
    name: 'get_wishlist',
    description:
      'List wishlist items with their computed state (cooling/ready/budget-blocked/saving/unknown), the safe-to-spend summary, and the single current suggestion. Use this before suggesting or purchasing anything.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => {
      const data = await buildWishlistData(new Date());
      return {
        items: data.items.map(serializeComputed),
        purchased: data.purchased.map(serializeItem),
        summary: data.summary,
        suggestion: data.suggestion,
      };
    },
  },
];

export const wishlistWriteTools: ToolDef[] = [
  {
    name: 'add_wishlist_item',
    description:
      'Add an item to the wishlist. price must be > 0 and is rounded to two decimals. The item still has to finish its cooling-off period before it can show as Ready.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        price: { type: 'number', description: 'positive amount' },
        priority: { type: 'number', minimum: 1, maximum: 3, description: '1 high, 2 normal (default), 3 low' },
        category: { type: 'string', description: 'optional; used to check that category\'s budget headroom' },
        note: { type: 'string' },
        url: { type: 'string', description: 'must start with http:// or https://' },
      },
      required: ['name', 'price'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const data = validateItemInput(args ?? {}, { partial: false });
      if ('error' in data) fail(data.error);
      const v = data.value;
      const created = await prisma.wishlistItem.create({
        data: {
          name: v.name!,
          price: v.price!,
          priority: v.priority ?? 2,
          category: v.category ?? null,
          note: v.note ?? null,
          url: v.url ?? null,
        },
      });
      return {
        success: true,
        item: serializeItem(created),
        note: 'Safe-to-spend and cooling-off apply — fetch get_wishlist to see how it lands.',
      };
    },
  },
  {
    name: 'update_wishlist_item',
    description:
      'Edit a wishlist item (name, price, priority, category, note, url). Purchased items cannot be edited. Pass an empty string for category/note/url to clear it.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        price: { type: 'number' },
        priority: { type: 'number', minimum: 1, maximum: 3 },
        category: { type: 'string' },
        note: { type: 'string' },
        url: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const id = asStr(args?.id);
      if (!id) fail('id is required');
      const existing = await prisma.wishlistItem.findUnique({ where: { id } });
      if (!existing) fail('Wishlist item not found');
      if (existing.status === 'purchased') {
        fail('Purchased items cannot be edited — this keeps your history truthful');
      }
      const body: Record<string, any> = {};
      for (const k of ['name', 'price', 'priority', 'category', 'note', 'url'] as const) {
        if (args?.[k] !== undefined) body[k] = args[k];
      }
      const data = validateItemInput(body, { partial: true });
      if ('error' in data) fail(data.error);
      if (Object.keys(data.value).length === 0) fail('No changes requested');
      const updated = await prisma.wishlistItem.update({
        where: { id },
        data: data.value,
      });
      return { success: true, item: serializeItem(updated) };
    },
  },
];

export const wishlistStageTools: ToolDef[] = [
  {
    name: 'stage_wishlist_purchase',
    description:
      'STAGE buying a wishlist item. Creates an expense and debits the account on approval. Hard-blocked if the account is short. Cooling-off items require acknowledgeCooling=true at stage time — only pass it after the user explicitly agrees to buy during cooling-off. Money movement, two-level confirmation.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        account: { type: 'string', description: 'account short name, e.g. Telebirr' },
        accountId: { type: 'string' },
        category: { type: 'string', description: 'override category for the created expense; empty = item category or auto-suggest' },
        acknowledgeCooling: { type: 'boolean', description: 'set true only after explicit user approval to buy during cooling-off' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const id = asStr(args?.id);
      if (!id) fail('id is required');
      const item = await prisma.wishlistItem.findUnique({ where: { id } });
      if (!item) fail('Wishlist item not found');
      if (item.status === 'purchased') {
        fail('This item has already been purchased');
      }

      const acct = await resolveAccountRef({
        account: args?.account,
        accountId: args?.accountId,
      });
      if (!acct) fail('Account not found — pass account (short name) or accountId');

      const price = Math.round(item.price * 100) / 100;
      if (acct.balance + 1e-9 < price) {
        fail(
          `${acct.short} has only ETB ${acct.balance.toFixed(2)}; this item costs ETB ${price.toFixed(2)}. Choose another account or add funds.`
        );
      }

      const acknowledgeCooling = asBool(args?.acknowledgeCooling);
      const data = await buildWishlistData(new Date());
      const computed = data.items.find((i) => i.id === id);
      const state = computed?.state ?? 'unknown';
      const cooling = state === 'cooling';
      const category = asStr(args?.category) || item.category || null;

      const preview = {
        action: 'Purchase wishlist item',
        name: item.name,
        price,
        account: acct.short,
        accountBalance: acct.balance,
        category: category ?? 'auto (from rules)',
        state,
        reason: computed?.reason ?? null,
        effect: `Creates a ${price} expense on ${acct.short} and debits the balance atomically`,
        ...(computed?.budgetConflict
          ? { budgetWarning: computed.reason }
          : {}),
        ...(cooling
          ? {
              coolingWarning: `Still cooling off — ${computed?.coolingDaysLeft} day(s) left. confirm_action will be refused unless you re-stage with acknowledgeCooling=true after the user explicitly agrees to buy during cooling-off.`,
            }
          : {}),
      };
      const { token, expiresAt } = await stageAction(
        'wishlist.purchase',
        { id, account: acct.short, category, acknowledgeCooling },
        preview
      );
      return { staged: true, preview, token, expiresAt, instruction: CONFIRM_HINT };
    },
  },
  {
    name: 'stage_wishlist_item_delete',
    description:
      'STAGE deletion of a wishlist item. The purchase transaction (if any) is NOT deleted. Irreversible.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const id = asStr(args?.id);
      if (!id) fail('id is required');
      const item = await prisma.wishlistItem.findUnique({
        where: { id },
        select: { id: true, name: true, price: true, status: true },
      });
      if (!item) fail('Wishlist item not found');
      const preview = {
        action: 'DELETE wishlist item',
        name: item.name,
        price: item.price,
        status: item.status,
        note: 'Any purchase transaction stays in the ledger; only this wishlist entry is removed.',
      };
      const { token, expiresAt } = await stageAction(
        'wishlist.delete',
        { id },
        preview
      );
      return { staged: true, preview, token, expiresAt, instruction: CONFIRM_HINT };
    },
  },
];
