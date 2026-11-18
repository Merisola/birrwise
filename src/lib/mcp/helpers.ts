import { prisma } from '@/lib/prisma';

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: any) => Promise<any>;
}

export const asStr = (v: any): string =>
  typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();

export const asNum = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

export const asBool = (v: any): boolean =>
  v === true || v === 'true' || v === 1 || v === '1';

// NOTE: must stay a function declaration — arrow consts typed `never`
// do not participate in control-flow narrowing.
export function fail(msg: string): never {
  throw new Error(msg);
}

export const requireStr = (v: any, name: string): string => {
  const s = asStr(v);
  if (!s) fail(`${name} is required`);
  return s;
};

export const limit100 = (v: any, fallback = 20): number => {
  const n = Math.floor(asNum(v));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, 100);
};

export async function resolveAccountRef(ref: {
  account?: any;
  accountId?: any;
}) {
  const id = asStr(ref.accountId);
  const s = asStr(ref.account);
  if (id) return prisma.account.findUnique({ where: { id } });
  if (s) {
    return prisma.account.findFirst({
      where: { OR: [{ short: s }, { name: s }, { id: s }] },
    });
  }
  return null;
}

export async function resolveCategoryRef(ref: { id?: any; name?: any }) {
  const id = asStr(ref.id);
  const name = asStr(ref.name);
  if (id) return prisma.category.findUnique({ where: { id } });
  if (name) return prisma.category.findUnique({ where: { name } });
  return null;
}

export const SYSTEM_CATEGORIES = ['Income', 'Internal transfer', 'Uncategorized'];

export const jsonResult = (result: any) => result;
