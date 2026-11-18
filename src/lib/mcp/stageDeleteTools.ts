import { prisma } from '@/lib/prisma';
import { ToolDef, asStr, fail, resolveCategoryRef, SYSTEM_CATEGORIES } from './helpers';
import { stageAction } from './pending';

const CONFIRM_HINT =
  'Show this preview to the user. Ask for explicit approval. Only then call confirm_action with the token. Never confirm on your own.';

export const stageDeleteTools: ToolDef[] = [
  {
    name: 'stage_budget_delete',
    description: 'STAGE deletion of a budget (by exact category name). Irreversible.',
    inputSchema: {
      type: 'object',
      properties: { category: { type: 'string' } },
      required: ['category'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const category = asStr(args?.category);
      if (!category) fail('category is required');
      const budget = await prisma.budget.findUnique({ where: { category } });
      if (!budget) fail(`Budget for "${category}" not found`);
      const preview = { action: 'DELETE budget', category, limit: budget.limit };
      const { token, expiresAt } = await stageAction('budget.delete', { category }, preview);
      return { staged: true, preview, token, expiresAt, instruction: CONFIRM_HINT };
    },
  },
  {
    name: 'stage_category_delete',
    description:
      'STAGE deletion of a category. Subcategories move to root (they are not deleted). System categories cannot be deleted. Irreversible.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        id: { type: 'string' },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const target = await resolveCategoryRef({ id: args?.id, name: args?.name });
      if (!target) fail('Category not found');
      if (SYSTEM_CATEGORIES.includes(target.name)) {
        fail('System categories cannot be deleted');
      }
      const childCount = await prisma.category.count({ where: { parentId: target.id } });
      const preview = {
        action: 'DELETE category',
        name: target.name,
        note: childCount > 0 ? `${childCount} subcategories will move to root` : 'No subcategories',
      };
      const { token, expiresAt } = await stageAction(
        'category.delete',
        { id: target.id },
        preview
      );
      return { staged: true, preview, token, expiresAt, instruction: CONFIRM_HINT };
    },
  },
  {
    name: 'stage_rule_delete',
    description: 'STAGE deletion of a categorization rule (by id or keyword). Irreversible.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        keyword: { type: 'string' },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const id = asStr(args?.id);
      const keyword = asStr(args?.keyword).toUpperCase();
      const rule = id
        ? await prisma.rule.findUnique({ where: { id } })
        : await prisma.rule.findUnique({ where: { keyword } });
      if (!rule) fail('Rule not found');
      const preview = {
        action: 'DELETE rule',
        keyword: rule.keyword,
        category: rule.category,
      };
      const { token, expiresAt } = await stageAction('rule.delete', { id: rule.id }, preview);
      return { staged: true, preview, token, expiresAt, instruction: CONFIRM_HINT };
    },
  },
];
