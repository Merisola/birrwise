/**
 * Validation and serialization helpers shared by the wishlist API routes.
 * Kept out of the route modules because Next.js route files may only
 * export HTTP verbs and route segment config.
 */
import { normalizePrice, WISHLIST_ITEM_CONSTRAINTS } from '@/lib/wishlist';

export interface ValidatedItemInput {
  name?: string;
  price?: number;
  priority?: number;
  category?: string | null;
  note?: string | null;
  url?: string | null;
}

export function validateItemInput(
  body: unknown,
  { partial }: { partial: boolean }
): { value: ValidatedItemInput } | { error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Body must be a JSON object.' };
  }
  const raw = body as Record<string, unknown>;
  const out: ValidatedItemInput = {};

  if (raw.name !== undefined) {
    const name = String(raw.name).trim();
    if (!name) return { error: 'Name is required.' };
    out.name = name.slice(0, WISHLIST_ITEM_CONSTRAINTS.nameMax);
  } else if (!partial) {
    return { error: 'Name is required.' };
  }

  if (raw.price !== undefined) {
    const price = normalizePrice(raw.price);
    if (price == null) return { error: 'Price must be a positive number.' };
    out.price = price;
  } else if (!partial) {
    return { error: 'Price is required.' };
  }

  if (raw.priority !== undefined) {
    const p = Number(raw.priority);
    if (!Number.isFinite(p)) return { error: 'Priority must be 1, 2 or 3.' };
    out.priority = Math.max(1, Math.min(3, Math.floor(p)));
  }

  if (raw.category !== undefined) {
    const c = raw.category == null ? '' : String(raw.category).trim();
    out.category = c ? c.slice(0, WISHLIST_ITEM_CONSTRAINTS.categoryMax) : null;
  }
  if (raw.note !== undefined) {
    const n = raw.note == null ? '' : String(raw.note).trim();
    out.note = n ? n.slice(0, WISHLIST_ITEM_CONSTRAINTS.noteMax) : null;
  }
  if (raw.url !== undefined) {
    const u = raw.url == null ? '' : String(raw.url).trim();
    if (u && !/^https?:\/\//i.test(u)) return { error: 'Link must start with http:// or https://.' };
    out.url = u ? u.slice(0, WISHLIST_ITEM_CONSTRAINTS.urlMax) : null;
  }

  return { value: out };
}

export function serializeItem(item: {
  id: string;
  name: string;
  price: number;
  priority: number;
  category: string | null;
  note: string | null;
  url: string | null;
  status: string;
  purchasedAt: Date | null;
  transactionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...item,
    purchasedAt: item.purchasedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function serializeComputed(item: {
  id: string;
  name: string;
  price: number;
  priority: number;
  category: string | null;
  note: string | null;
  url: string | null;
  status: string;
  purchasedAt: Date | null;
  transactionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  state: string;
  ageDays: number;
  coolingDaysLeft: number;
  cyclesAway: number | null;
  progress: number;
  budgetHeadroom: number | null;
  budgetConflict: boolean;
  reason: string;
}) {
  return {
    ...serializeItem(item),
    state: item.state,
    ageDays: item.ageDays,
    coolingDaysLeft: item.coolingDaysLeft,
    cyclesAway: item.cyclesAway,
    progress: item.progress,
    budgetHeadroom: item.budgetHeadroom,
    budgetConflict: item.budgetConflict,
    reason: item.reason,
  };
}
