/**
 * Wishlist: "can I afford this yet?" — not another budget.
 *
 * An item's affordability is judged against money the household has NOT
 * earmarked:
 *
 *   remainingBudgetsThroughCycleEnd = Σ max(0, budget.limit − spent)   (per budget)
 *   safeToSpend = max(0, liquidBalance − cushion − remainingBudgetsThroughCycleEnd)
 *
 * The manual cushion doubles as a late-salary runway: salary can land up to
 * ~9 days after the cycle boundary and remaining budgets only reserve money
 * through the cycle end — so nothing is called affordable until the runway is
 * covered.
 *
 * Timelines (cyclesAway) use a manual income override only.
 *   Phase A (no eligible completed cycles): surplus = incomeOverride −
 *     Σ budget limits of categories NOT in `wishlistExcludedCategories`.
 *   Phase B (≥1 eligible completed cycle):  surplus = incomeOverride −
 *     mean recurring expenses (transfers and excluded categories removed).
 *
 * One-off categories (e.g. partner repayments) are excluded from the surplus
 * estimate only — they still count toward budgets, reports and the
 * safe-to-spend reservation (unspent one-off budgets stay reserved because
 * the money is committed this cycle).
 */
import { prisma } from '@/lib/prisma';
import { suggestCategory } from '@/lib/categorization';
import { getCycleStartDay } from '@/lib/cycle';
import {
  currentMonthKey,
  monthBounds,
  monthProgress,
  eligibleCycleKeys,
  etDaysBetween,
  todayISO,
} from '@/lib/dates';
import {
  buildBudgetsWithSpending,
  buildChildrenOf,
  computeBudgetPace,
  computeBudgetSummary,
  computeRemainingBudgets,
  categoriesForBudget,
} from '@/lib/budgets';

const ROUND = (n: number) => Math.round(n * 100) / 100;

export type WishlistItemState = 'cooling' | 'ready' | 'budget-blocked' | 'saving' | 'unknown';

export interface WishlistItemRecord {
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
}

export interface ComputedWishlistItem extends WishlistItemRecord {
  state: WishlistItemState;
  ageDays: number;
  coolingDaysLeft: number;
  cyclesAway: number | null;
  progress: number;              // 0..1 — portion of safeToSpend the price consumes (clamped)
  budgetHeadroom: number | null; // remaining in the matching budget (null = no budget for this category)
  budgetConflict: boolean;
  reason: string;
}

export interface RemainingBudgetEntry {
  category: string;
  icon: string;
  limit: number;
  spent: number;
  remaining: number;
}

export interface WishlistSummary {
  liquidBalance: number;
  cushion: number | null;           // manual wishlistCushion
  runwayDays: number | null;        // cushion ≈ N days of recurring spending
  remainingBudgets: number;
  remainingBudgetBreakdown: RemainingBudgetEntry[];
  safeToSpend: number | null;       // null when the cushion is not set (suggestions paused)
  incomeOverride: number | null;
  excludedCategories: string[];
  surplus: number | null;
  surplusSource: 'cycles' | 'budgets' | 'none';
  surplusDetail: string;
  cyclesUsed: number;               // eligible completed cycles behind the expense estimate
  coolingDays: number;
  budgetPaceAhead: boolean;
  budgetPaceMessage: string | null;
  hasBudgets: boolean;
  currentCycleLabel: string;
  firstTransactionDate: string | null;
}

export type Suggestion =
  | { kind: 'set-cushion' }
  | { kind: 'empty' }
  | { kind: 'ready'; itemId: string }
  | { kind: 'hold'; message: string }
  | { kind: 'next-up'; itemId: string; cyclesAway: number | null }
  | { kind: 'cooling'; itemId: string; daysLeft: number }
  | { kind: 'none'; message: string };

export interface WishlistResult {
  items: ComputedWishlistItem[];
  purchased: WishlistItemRecord[];
  summary: WishlistSummary;
  suggestion: Suggestion;
}

async function readWishlistSettings() {
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          'wishlistCushion',
          'wishlistIncomeOverride',
          'wishlistCoolingDays',
          'wishlistExcludedCategories',
        ],
      },
    },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const num = (key: string): number | null => {
    const raw = map.get(key);
    if (raw === undefined) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? ROUND(n) : null;
  };
  const coolingRaw = Number(map.get('wishlistCoolingDays') ?? '14');
  const coolingDays =
    Number.isFinite(coolingRaw) && coolingRaw >= 0
      ? Math.min(365, Math.floor(coolingRaw))
      : 14;
  let excludedCategories: string[] = [];
  try {
    const parsed = JSON.parse(map.get('wishlistExcludedCategories') ?? '[]');
    if (Array.isArray(parsed)) {
      excludedCategories = parsed
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, 50);
    }
  } catch {
    excludedCategories = [];
  }
  return {
    cushion: num('wishlistCushion'),
    incomeOverride: num('wishlistIncomeOverride'),
    coolingDays,
    excludedCategories,
  };
}

/** Remaining-budget lookup keyed by *transaction* category (with rollups). */
function buildHeadroomIndex(
  breakdown: RemainingBudgetEntry[],
  budgetRows: Array<{ category: string }>,
  childrenOf: Record<string, string[]>
): Map<string, number> {
  const index = new Map<string, number>();
  const remainingByBudget = new Map(breakdown.map((b) => [b.category, b.remaining]));
  for (const b of budgetRows) {
    const remaining = remainingByBudget.get(b.category) ?? 0;
    for (const tc of categoriesForBudget(b.category, childrenOf)) {
      // Conservative: the smallest remaining wins when groups overlap.
      index.set(tc, Math.min(index.get(tc) ?? Infinity, remaining));
    }
  }
  return index;
}

/**
 * Sum of budget limits that are NOT one-off (excluded) — the pre-history
 * proxy for recurring spend. Returns also the total of all budgets for
 * display purposes.
 */
function recurringBudgetCommit(
  budgets: Array<{ category: string; limit: number }>,
  excluded: string[]
): number {
  const excl = new Set(excluded.map((c) => c.toLowerCase()));
  let total = 0;
  for (const b of budgets) {
    if (!excl.has(b.category.toLowerCase())) total += b.limit;
  }
  return ROUND(total);
}

export async function buildWishlistData(now = new Date()): Promise<WishlistResult> {
  const startDay = await getCycleStartDay();
  const settings = await readWishlistSettings();
  const currentMonth = currentMonthKey(now, startDay);
  const cycleBounds = monthBounds(currentMonth, startDay);

  const [accounts, budgets, categories, firstTx, activeItems, purchasedItems, cycleTx] =
    await Promise.all([
      prisma.account.findMany({ select: { balance: true } }),
      prisma.budget.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.category.findMany({ select: { id: true, name: true, parentId: true } }),
      prisma.transaction.findFirst({ orderBy: { date: 'asc' }, select: { date: true } }),
      prisma.wishlistItem.findMany({
        where: { status: 'active' },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.wishlistItem.findMany({
        where: { status: 'purchased' },
        orderBy: { purchasedAt: 'desc' },
        take: 50,
      }),
      prisma.transaction.findMany({
        where: { date: { gte: cycleBounds.start, lte: cycleBounds.end }, type: 'expense' },
        select: { category: true, amount: true, type: true },
      }),
    ]);

  const childrenOf = buildChildrenOf(categories);
  const liquidBalance = ROUND(accounts.reduce((sum, a) => sum + a.balance, 0));

  // Serialize to the client Budget shape (string dates) for the shared helpers.
  const budgetList = budgets.map((b) => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }));

  const { total: remainingBudgets, breakdown: remainingBudgetBreakdown } =
    computeRemainingBudgets(
      budgetList,
      cycleTx,
      currentMonth,
      childrenOf,
      startDay
    );

  // --- Budget pace (hold trigger) ---
  const summary = computeBudgetSummary(
    buildBudgetsWithSpending(
      budgetList,
      cycleTx,
      currentMonth,
      childrenOf,
      startDay
    )
  );
  const prog = monthProgress(currentMonth, startDay, now);
  const pace = computeBudgetPace(summary, prog);
  const hasBudgets = budgets.length > 0;
  const budgetPaceAhead = hasBudgets && prog.state === 'current' && summary.pct - prog.elapsedPct > 5;
  const budgetPaceMessage = budgetPaceAhead ? pace.message : null;

  // --- Surplus / timeline estimate ---
  const firstTransactionDate = firstTx?.date ?? null;
  const eligible = eligibleCycleKeys(firstTransactionDate, now, startDay, 3);

  const exclLower = new Set(settings.excludedCategories.map((c) => c.toLowerCase()));
  const budgetCommit = recurringBudgetCommit(budgets, settings.excludedCategories);
  const daysInCycle = cycleBounds.daysInCycle;

  let surplus: number | null = null;
  let surplusSource: WishlistSummary['surplusSource'] = 'none';
  let surplusDetail: string;
  let cyclesUsed = 0;
  let recurringPerCycleForRunway: number | null = null;

  if (settings.incomeOverride != null) {
    if (eligible.length > 0) {
      // Actual recurring expenses over eligible completed cycles.
      const perCycle: number[] = [];
      for (const key of eligible) {
        const bounds = monthBounds(key, startDay);
        const txs = await prisma.transaction.findMany({
          where: {
            date: { gte: bounds.start, lte: bounds.end },
            type: 'expense',
          },
          select: { category: true, amount: true },
        });
        const total = txs
          .filter((t) => !exclLower.has(t.category.toLowerCase()))
          .reduce((sum, t) => sum + t.amount, 0);
        perCycle.push(total);
      }
      cyclesUsed = perCycle.length;
      const recurringAvg = perCycle.reduce((a, b) => a + b, 0) / perCycle.length;
      recurringPerCycleForRunway = recurringAvg;
      surplus = Math.max(0, ROUND(settings.incomeOverride - recurringAvg));
      surplusSource = 'cycles';
      surplusDetail = `Income override minus recurring expenses over ${cyclesUsed} completed cycle${cyclesUsed === 1 ? '' : 's'} (one-offs excluded).`;
    } else {
      recurringPerCycleForRunway = budgetCommit > 0 ? budgetCommit : null;
      surplus = Math.max(0, ROUND(settings.incomeOverride - budgetCommit));
      surplusSource = 'budgets';
      surplusDetail =
        'Income override minus the limits of your non-one-off budgets (one-offs excluded). Switches to real cycle averages after your first eligible completed cycle.';
    }
  } else {
    surplusDetail = 'Set your average income to unlock cycles-away estimates.';
  }

  // --- Late-salary runway label ---
  const dailyRecurring =
    recurringPerCycleForRunway != null && daysInCycle > 0
      ? recurringPerCycleForRunway / daysInCycle
      : null;
  const runwayDays =
    settings.cushion != null && dailyRecurring != null && dailyRecurring > 0
      ? Math.floor(settings.cushion / dailyRecurring)
      : null;

  const safeToSpend =
    settings.cushion != null
      ? Math.max(0, ROUND(liquidBalance - settings.cushion - remainingBudgets))
      : null;

  // Headroom index keyed by transaction category (rollups + static groups).
  const headroomIndex = buildHeadroomIndex(remainingBudgetBreakdown, budgets, childrenOf);

  const contextBase = {
    safeToSpend,
    surplus,
    surplusSource,
    budgetPaceAhead,
    hasBudgets,
    coolingDays: settings.coolingDays,
    headroomIndex,
    cycleLabel: cycleBounds.label,
  };

  const computed = activeItems.map((item) => computeItemState(item, contextBase, now));

  const summaryOut: WishlistSummary = {
    liquidBalance,
    cushion: settings.cushion,
    runwayDays,
    remainingBudgets,
    remainingBudgetBreakdown,
    safeToSpend,
    incomeOverride: settings.incomeOverride,
    excludedCategories: settings.excludedCategories,
    surplus,
    surplusSource,
    surplusDetail,
    cyclesUsed,
    coolingDays: settings.coolingDays,
    budgetPaceAhead,
    budgetPaceMessage,
    hasBudgets,
    currentCycleLabel: cycleBounds.label,
    firstTransactionDate: firstTransactionDate
      ? todayISO(firstTransactionDate)
      : null,
  };

  return {
    items: computed,
    purchased: purchasedItems,
    summary: summaryOut,
    suggestion: buildSuggestion(computed, summaryOut),
  };
}

interface ItemContextBase {
  safeToSpend: number | null;
  surplus: number | null;
  surplusSource: 'cycles' | 'budgets' | 'none';
  budgetPaceAhead: boolean;
  hasBudgets: boolean;
  coolingDays: number;
  headroomIndex: Map<string, number>;
  cycleLabel: string;
}

export function computeItemState(
  item: WishlistItemRecord,
  ctx: ItemContextBase,
  now: Date = new Date()
): ComputedWishlistItem {
  const ageDays = Math.max(0, etDaysBetween(item.createdAt, now));
  const coolingEnabled = ctx.coolingDays > 0;
  const coolingDaysLeft = coolingEnabled ? Math.max(0, ctx.coolingDays - ageDays) : 0;
  const cooling = coolingEnabled && ageDays < ctx.coolingDays;

  const budgetHeadroom =
    item.category != null ? ctx.headroomIndex.get(item.category) ?? null : null;
  const budgetConflict =
    item.category != null && budgetHeadroom !== null && budgetHeadroom < item.price;

  const base = {
    ...item,
    ageDays,
    coolingDaysLeft,
    budgetHeadroom,
    budgetConflict,
  };

  if (cooling) {
    return {
      ...base,
      state: 'cooling',
      cyclesAway: null,
      progress: 0,
      reason: `Cooling off — ${coolingDaysLeft} day${coolingDaysLeft === 1 ? '' : 's'} left. Waiting helps you actually want less.`,
    };
  }

  if (ctx.safeToSpend == null) {
    return {
      ...base,
      state: 'unknown',
      cyclesAway: null,
      progress: 0,
      reason: 'Set your late-salary runway to unlock suggestions.',
    };
  }

  const affordable = item.price <= ctx.safeToSpend;

  if (!affordable) {
    const gap = ROUND(item.price - ctx.safeToSpend);
    if (ctx.surplus != null && ctx.surplus > 0) {
      const cyclesAway = Math.ceil(gap / ctx.surplus);
      return {
        ...base,
        state: 'saving',
        cyclesAway,
        progress: Math.min(1, ctx.safeToSpend / item.price),
        reason: `About ${cyclesAway} cycle${cyclesAway === 1 ? '' : 's'} away (needs ETB ${gap.toLocaleString('en-US', { maximumFractionDigits: 0 })} more).`,
      };
    }
    return {
      ...base,
      state: 'unknown',
      cyclesAway: null,
      progress: Math.min(1, ctx.safeToSpend / item.price),
      reason: 'Set your average income to estimate how many cycles remain.',
    };
  }

  if (ctx.budgetPaceAhead) {
    return {
      ...base,
      state: 'budget-blocked',
      cyclesAway: null,
      progress: 1,
      reason: 'Budget pace is ahead this cycle — hold off until next cycle.',
    };
  }

  if (budgetConflict) {
    return {
      ...base,
      state: 'budget-blocked',
      cyclesAway: null,
      progress: 1,
      reason: `Only ETB ${budgetHeadroom!.toLocaleString('en-US', { maximumFractionDigits: 0 })} left in ${item.category}'s budget.`,
    };
  }

  return {
    ...base,
    state: 'ready',
    cyclesAway: 0,
    progress: 1,
    reason: 'Fits your safe-to-spend and no budget conflict.',
  };
}

function buildSuggestion(
  items: ComputedWishlistItem[],
  summary: WishlistSummary
): Suggestion {
  if (summary.safeToSpend == null) return { kind: 'set-cushion' };
  if (items.length === 0) return { kind: 'empty' };

  const ready = items.filter((i) => i.state === 'ready');
  if (ready.length > 0) {
    // Priority 1 first, then the oldest wish.
    const best = [...ready].sort(
      (a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime()
    )[0];
    return { kind: 'ready', itemId: best.id };
  }

  if (summary.budgetPaceAhead && summary.budgetPaceMessage) {
    return { kind: 'hold', message: summary.budgetPaceMessage };
  }

  const saving = items
    .filter((i) => i.state === 'saving')
    .sort((a, b) => (a.cyclesAway ?? Infinity) - (b.cyclesAway ?? Infinity));
  if (saving.length > 0) {
    const next = saving[0];
    return { kind: 'next-up', itemId: next.id, cyclesAway: next.cyclesAway };
  }

  const cooling = items
    .filter((i) => i.state === 'cooling')
    .sort((a, b) => b.ageDays - a.ageDays);
  if (cooling.length > 0) {
    return { kind: 'cooling', itemId: cooling[0].id, daysLeft: cooling[0].coolingDaysLeft };
  }

  const blocked = items.filter((i) => i.state === 'budget-blocked');
  if (blocked.length > 0) {
    return { kind: 'none', message: 'Everything affordable is waiting on budget limits — see the items below.' };
  }
  return { kind: 'none', message: 'No suggestion yet — items need a timeline or a cushion.' };
}

// ---------- Purchase ----------

export class WishlistPurchaseError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Atomically: claim the item (double-purchase → 409), verify the account
 * balance (shortfall → rollback), create the expense, decrement the account,
 * link item → transaction. Nothing is written if any step fails.
 */
export async function purchaseWishlistItem(input: {
  id: string;
  account: string;      // short name or id
  category?: string | null;
  acknowledgeCooling?: boolean;
}) {
  const { id, account, category, acknowledgeCooling } = input;

  return prisma.$transaction(async (tx) => {
    // Claim: only an active item can be purchased. Atomic guard against
    // double-clicks and concurrent purchases.
    const claim = await tx.wishlistItem.updateMany({
      where: { id, status: 'active' },
      data: { status: 'purchased', purchasedAt: new Date() },
    });
    if (claim.count === 0) {
      const existing = await tx.wishlistItem.findUnique({
        where: { id },
        select: { status: true },
      });
      throw new WishlistPurchaseError(
        existing ? 'This item has already been purchased.' : 'Wishlist item not found.',
        existing ? 409 : 404
      );
    }

    const item = await tx.wishlistItem.findUniqueOrThrow({ where: { id } });
    const price = ROUND(item.price);

    // Cooling-off purchases need the extra deliberate acknowledgement.
    const settings = await readWishlistSettings();
    const ageDays = Math.max(0, etDaysBetween(item.createdAt, new Date()));
    const cooling = settings.coolingDays > 0 && ageDays < settings.coolingDays;
    if (cooling && acknowledgeCooling !== true) {
      throw new WishlistPurchaseError(
        `This item is still cooling off (${settings.coolingDays - ageDays} days left). Confirm you want to buy it anyway.`,
        400,
        'cooling_required'
      );
    }

    // Account resolution: short name (case-insensitive) or id.
    const accounts = await tx.account.findMany();
    const acct =
      accounts.find((a) => a.id === account) ??
      accounts.find((a) => a.short.toLowerCase() === String(account).toLowerCase()) ??
      accounts.find((a) => a.name.toLowerCase() === String(account).toLowerCase());
    if (!acct) {
      throw new WishlistPurchaseError('Account not found.', 404);
    }
    if (amtLte(acct.balance, price)) {
      throw new WishlistPurchaseError(
        `${acct.short} has ETB ${acct.balance.toFixed(2)}; this item costs ETB ${price.toFixed(2)}. Choose another account or add funds.`,
        422,
        'insufficient_balance'
      );
    }

    // Category: caller override → item category → auto-suggest → Uncategorized.
    let finalCategory = category?.trim() || item.category || '';
    if (!finalCategory || finalCategory === 'Uncategorized') {
      const rules = await tx.rule.findMany();
      finalCategory = suggestCategory(item.name, rules) || 'Uncategorized';
    }

    const now = new Date();
    const dateObj = new Date(`${todayISO(now)}T12:00:00Z`);
    const timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Addis_Ababa',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(now);

    const created = await tx.transaction.create({
      data: {
        date: dateObj,
        time: timeStr,
        accountId: acct.id,
        name: item.name,
        category: finalCategory,
        type: 'expense',
        amount: price,
        icon: '🛍',
        note: `Wishlist purchase${item.note ? ` · ${item.note}` : ''}`,
        label: null,
      },
      include: { account: { select: { short: true } } },
    });

    await tx.account.update({
      where: { id: acct.id },
      data: { balance: { decrement: price } },
    });

    const linked = await tx.wishlistItem.update({
      where: { id: item.id },
      data: { transactionId: created.id },
    });

    return {
      item: linked,
      transaction: created,
      account: { id: acct.id, short: acct.short, balanceBefore: acct.balance, balanceAfter: ROUND(acct.balance - price) },
    };
  });
}

const amtLte = (balance: number, price: number) => balance + 1e-9 < price;

export const WISHLIST_ITEM_CONSTRAINTS = {
  nameMax: 120,
  noteMax: 500,
  urlMax: 500,
  categoryMax: 80,
} as const;

/** Round a price to 2 decimals; returns null when invalid. */
export function normalizePrice(raw: unknown): number | null {
  const n = typeof raw === 'string' ? Number(raw.replace(/,/g, '')) : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return ROUND(n);
}
