import { prisma } from '@/lib/prisma';
import { createRuleWithBackfill } from '@/lib/rules';
import {
  ToolDef,
  asStr,
  asNum,
  asBool,
  fail,
  resolveAccountRef,
  resolveCategoryRef,
  SYSTEM_CATEGORIES,
} from './helpers';

export const writeTools: ToolDef[] = [
  {
    name: 'upsert_budget',
    description:
      'Create or update a monthly budget for a category. category is the exact category name.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        limit: { type: 'number', description: 'monthly limit, must be > 0' },
        icon: { type: 'string' },
        color: { type: 'string' },
      },
      required: ['category', 'limit'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const category = asStr(args?.category);
      const limit = asNum(args?.limit);
      if (!category) fail('category is required');
      if (!(limit > 0)) fail('limit must be a positive number');
      const icon = asStr(args?.icon) || '💰';
      const color = asStr(args?.color) || '#7c6cf0';
      const budget = await prisma.budget.upsert({
        where: { category },
        update: { limit, ...(args?.icon ? { icon } : {}), ...(args?.color ? { color } : {}) },
        create: { category, limit, icon, color },
      });
      return { success: true, budget };
    },
  },
  {
    name: 'create_category',
    description:
      'Create a category. Two levels max: pass parent (a root category name or id) to create a subcategory.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        icon: { type: 'string' },
        parent: { type: 'string', description: 'root category name or id (optional)' },
      },
      required: ['name'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const name = asStr(args?.name);
      if (!name) fail('name is required');
      if (SYSTEM_CATEGORIES.some((s) => s.toLowerCase() === name.toLowerCase())) {
        fail(`"${name}" is a reserved system category name`);
      }
      const clash = await prisma.category.findUnique({ where: { name } });
      if (clash) fail(`Category "${name}" already exists`);

      let parentId: string | null = null;
      const parentRef = asStr(args?.parent);
      if (parentRef) {
        const parent =
          (await prisma.category.findUnique({ where: { name: parentRef } })) ??
          (await prisma.category.findUnique({ where: { id: parentRef } }));
        if (!parent) fail(`Parent category "${parentRef}" not found`);
        if (parent.parentId) fail('Categories can only be two levels deep');
        parentId = parent.id;
      }
      const created = await prisma.category.create({
        data: { name, icon: asStr(args?.icon) || '📂', parentId },
      });
      return { success: true, category: created };
    },
  },
  {
    name: 'update_category',
    description:
      'Rename, re-icon or re-parent a category. System categories (Income, Internal transfer, Uncategorized) cannot be modified. Pass parent="" or the word root to move a subcategory back to root.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'target category name' },
        id: { type: 'string', description: 'target category id (alternative to name)' },
        newName: { type: 'string' },
        icon: { type: 'string' },
        parent: { type: 'string', description: 'new parent name/id, "" for root' },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const target = await resolveCategoryRef({ id: args?.id, name: args?.name });
      if (!target) fail('Category not found');
      if (SYSTEM_CATEGORIES.includes(target.name)) {
        fail('System categories cannot be modified');
      }

      const data: any = {};
      const newName = asStr(args?.newName);
      if (newName && newName !== target.name) {
        const clash = await prisma.category.findUnique({ where: { name: newName } });
        if (clash) fail(`Category "${newName}" already exists`);
        data.name = newName;
      }
      const icon = asStr(args?.icon);
      if (icon) data.icon = icon;

      if (args?.parent !== undefined) {
        const pRef = asStr(args?.parent);
        if (!pRef || pRef.toLowerCase() === 'root') {
          data.parentId = null;
        } else {
          const parent =
            (await prisma.category.findUnique({ where: { name: pRef } })) ??
            (await prisma.category.findUnique({ where: { id: pRef } }));
          if (!parent) fail(`Parent category "${pRef}" not found`);
          if (parent.id === target.id) fail('A category cannot be its own parent');
          if (parent.parentId) fail('Categories can only be two levels deep');
          const childCount = await prisma.category.count({ where: { parentId: target.id } });
          if (childCount > 0) fail('A category with subcategories cannot become a subcategory');
          data.parentId = parent.id;
        }
      }
      const updated = await prisma.category.update({ where: { id: target.id }, data });
      return { success: true, category: updated };
    },
  },
  {
    name: 'create_rule',
    description:
      'Create or update a categorization rule (keyword -> category). Also back-fills matching uncategorized expenses.',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string' },
        category: { type: 'string' },
      },
      required: ['keyword', 'category'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const keyword = asStr(args?.keyword);
      const category = asStr(args?.category);
      if (!keyword || !category) fail('keyword and category are required');
      return createRuleWithBackfill(keyword, category);
    },
  },
  {
    name: 'create_account',
    description: 'Create an account (bank, cash, wallet...). balance defaults to 0.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        short: { type: 'string', description: 'short unique label, e.g. "CBE"' },
        type: { type: 'string', description: 'e.g. bank, cash, wallet' },
        balance: { type: 'number' },
        icon: { type: 'string' },
      },
      required: ['name', 'short', 'type'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const name = asStr(args?.name);
      const short = asStr(args?.short);
      const type = asStr(args?.type);
      if (!name || !short || !type) fail('name, short and type are required');
      const balance = args?.balance === undefined ? 0 : asNum(args?.balance);
      if (!Number.isFinite(balance)) fail('balance must be a number');
      const clash = await prisma.account.findUnique({ where: { short } });
      if (clash) fail(`Account short name "${short}" is already in use`);
      const created = await prisma.account.create({
        data: { name, short, type, balance, icon: asStr(args?.icon) || '🏦' },
      });
      return { success: true, account: created };
    },
  },
  {
    name: 'update_account',
    description:
      'Update an account. balance, when provided, SETS the absolute balance (not a delta).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        short: { type: 'string', description: 'alternative to id' },
        name: { type: 'string' },
        newShort: { type: 'string' },
        type: { type: 'string' },
        icon: { type: 'string' },
        balance: { type: 'number', description: 'absolute balance to set' },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const target = await resolveAccountRef({
        account: args?.short,
        accountId: args?.id,
      });
      if (!target) fail('Account not found');
      const data: any = {};
      const name = asStr(args?.name);
      if (name) data.name = name;
      const newShort = asStr(args?.newShort);
      if (newShort && newShort !== target.short) {
        const clash = await prisma.account.findUnique({ where: { short: newShort } });
        if (clash) fail(`Account short name "${newShort}" is already in use`);
        data.short = newShort;
      }
      const type = asStr(args?.type);
      if (type) data.type = type;
      const icon = asStr(args?.icon);
      if (icon) data.icon = icon;
      if (args?.balance !== undefined) {
        const b = asNum(args?.balance);
        if (!Number.isFinite(b)) fail('balance must be a number');
        data.balance = b;
      }
      const updated = await prisma.account.update({ where: { id: target.id }, data });
      return { success: true, account: updated };
    },
  },
  {
    name: 'update_settings',
    description:
      'Update app settings (workspace, currency, dateFormat, budget80, budget100, review, cycleStartDay). API keys are not accessible here.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: { type: 'string' },
        currency: { type: 'string', enum: ['ETB', 'USD'] },
        dateFormat: { type: 'string', enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] },
        budget80: { type: 'boolean' },
        budget100: { type: 'boolean' },
        review: { type: 'boolean' },
        cycleStartDay: { type: 'number', minimum: 1, maximum: 28, description: 'Day of month the pay cycle starts (1-28). Example: 7 means cycles run 7th to 6th.' },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const entries: [string, string][] = [];
      const ws = asStr(args?.workspace);
      if (ws) entries.push(['workspace', ws.slice(0, 80)]);
      if (args?.currency !== undefined) {
        const c = asStr(args?.currency);
        if (c !== 'ETB' && c !== 'USD') fail('currency must be ETB or USD');
        entries.push(['currency', c]);
      }
      if (args?.dateFormat !== undefined) {
        const d = asStr(args?.dateFormat);
        if (!['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(d)) fail('invalid dateFormat');
        entries.push(['dateFormat', d]);
      }
      for (const k of ['budget80', 'budget100', 'review'] as const) {
        if (args?.[k] !== undefined) entries.push([k, String(asBool(args[k]))]);
      }
      if (args?.cycleStartDay !== undefined) {
        const raw = asNum(args?.cycleStartDay);
        if (raw === undefined || !Number.isFinite(raw) || raw < 1 || raw > 28) {
          fail('cycleStartDay must be a number between 1 and 28');
        }
        entries.push(['cycleStartDay', String(Math.floor(raw))]);
      }
      if (entries.length === 0) fail('No valid settings provided');
      for (const [key, value] of entries) {
        await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
      }
      return { success: true, updated: entries.map(([k]) => k) };
    },
  },
];
