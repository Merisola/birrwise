import { Budget, BudgetWithSpending } from '@/types';
import { MonthProgress, monthProgress, monthBounds } from '@/lib/dates';

/**
 * Explicit category groups for budgets that cover multiple transaction categories.
 * Keys are the Budget.category value; values are the transaction categories that count toward it.
 */
export const BUDGET_CATEGORY_GROUPS: Record<string, string[]> = {
  'Food & coffee': ['Coffee & snacks', 'Food & groceries'],
  // Add more groups here if needed, e.g. 'Health & wellness': ['Health', 'Pharmacy', 'Fitness']
};

/**
 * Return all transaction categories that should be aggregated for a given budget category.
 * Static groups first, then the dynamic subcategory map (main -> its subs) passed by the caller.
 */
export function categoriesForBudget(
  budgetCategory: string,
  childrenOf?: Record<string, string[]>
): string[] {
  const group = BUDGET_CATEGORY_GROUPS[budgetCategory];
  const children = childrenOf?.[budgetCategory];
  const merged = new Set<string>([budgetCategory]);
  if (group) group.forEach((c) => merged.add(c));
  if (children) children.forEach((c) => merged.add(c));
  return Array.from(merged);
}

/**
 * Status tone used for styling and accessibility.
 */
export type BudgetTone = 'good' | 'warning' | 'over';

export interface BudgetStatus {
  pct: number;            // 0..100+
  left: number;           // limit - spent (negative when over)
  proj: number;           // projected month-end spend at current pace
  daysLeft: number;
  status: string;         // human-readable
  tone: BudgetTone;
  color: string;          // color for the progress bar
}

/**
 * Compute the status for a single budget given its spent amount and the month progress.
 */
export function computeBudgetStatus(
  spent: number,
  limit: number,
  monthProg: MonthProgress,
  budgetColor: string
): BudgetStatus {
  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const left = limit - spent;
  const daysLeft = monthProg.daysLeft;
  const proj = monthProg.daysElapsed > 0 ? (spent / monthProg.daysElapsed) * monthProg.daysInMonth : spent;

  let status: string;
  let tone: BudgetTone;
  let color: string;

  if (pct >= 100) {
    status = 'Over budget';
    tone = 'over';
    color = '#d65c62';
  } else if (pct >= 80) {
    status = 'Near limit';
    tone = 'warning';
    color = '#d69a42';
  } else if (proj > limit) {
    status = 'Pace risk';
    tone = 'warning';
    color = budgetColor || '#7255d9';
  } else {
    status = 'On track';
    tone = 'good';
    color = budgetColor || '#7255d9';
  }

  return { pct, left, proj, daysLeft, status, tone, color };
}

/**
 * Build the full BudgetWithSpending array from Prisma budgets and transactions for a month.
 * `childrenOf` maps a main category name to its subcategory names (subcategories roll up).
 * `startDay` is the cycle start day (1-28, default 7) for cycle-aware month progress.
 */
export function buildBudgetsWithSpending(
  budgets: Budget[],
  transactions: Array<{ category: string; amount: number; type: string }>,
  month: string,
  childrenOf?: Record<string, string[]>,
  startDay = 7
): BudgetWithSpending[] {
  const prog = monthProgress(month, startDay);
  const expenseTx = transactions.filter((t) => t.type === 'expense');

  return budgets.map((b) => {
    const allowed = categoriesForBudget(b.category, childrenOf);
    const spent = expenseTx
      .filter((t) => allowed.includes(t.category))
      .reduce((sum, t) => sum + t.amount, 0);

    const st = computeBudgetStatus(spent, b.limit, prog, b.color);

    return {
      ...b,
      spent,
      pct: st.pct,
      left: st.left,
      proj: st.proj,
      dl: st.daysLeft,
      status: st.status,
      tone: st.tone,
      color: st.color,
    };
  });
}

/**
 * Map each parent category name to its subcategory names (subcategories roll
 * up into their parent for budget matching).
 */
export function buildChildrenOf(
  allCategories: Array<{ id: string; name: string; parentId: string | null }>
): Record<string, string[]> {
  const byId = new Map(allCategories.map((c) => [c.id, c]));
  const childrenOf: Record<string, string[]> = {};
  for (const c of allCategories) {
    if (c.parentId) {
      const parent = byId.get(c.parentId);
      if (parent) {
        (childrenOf[parent.name] ||= []).push(c.name);
      }
    }
  }
  return childrenOf;
}

export interface RemainingBudget {
  category: string;
  icon: string;
  limit: number;
  spent: number;
  remaining: number;
}

/**
 * Unspent allowance of every budget for the given (usually current) cycle.
 * Overspent budgets contribute 0 — the overspend already reduced the
 * account balance, so reserving again would double-count.
 */
export function computeRemainingBudgets(
  budgets: Array<Budget>,
  transactions: Array<{ category: string; amount: number; type: string }>,
  month: string,
  childrenOf: Record<string, string[]> | undefined,
  startDay = 7
): { total: number; breakdown: RemainingBudget[] } {
  const withSpending = buildBudgetsWithSpending(budgets, transactions, month, childrenOf, startDay);
  const breakdown: RemainingBudget[] = withSpending.map((b) => ({
    category: b.category,
    icon: b.icon,
    limit: b.limit,
    spent: b.spent,
    remaining: Math.max(0, b.left),
  }));
  const total = breakdown.reduce((sum, b) => sum + b.remaining, 0);
  return { total, breakdown };
}

export interface BudgetSummary {
  total: number;
  spent: number;
  remaining: number;
  pct: number;
}

export function computeBudgetSummary(budgetsWithSpending: BudgetWithSpending[]): BudgetSummary {
  const total = budgetsWithSpending.reduce((s, b) => s + b.limit, 0);
  const spent = budgetsWithSpending.reduce((s, b) => s + b.spent, 0);
  const remaining = total - spent;
  const pct = total > 0 ? Math.round((spent / total) * 100) : 0;
  return { total, spent, remaining, pct };
}

export interface BudgetPace {
  elapsed: number;        // monthProgress.elapsedPct
  used: number;           // summary.pct
  daysElapsed: number;
  daysInMonth: number;
  daysLeft: number;
  message: string;
  tone: BudgetTone;
}

export function computeBudgetPace(
  summary: BudgetSummary,
  monthProg: MonthProgress
): BudgetPace {
  const { elapsedPct, daysElapsed, daysInMonth, daysLeft } = monthProg;
  const usedPct = summary.pct;

  let message: string;
  let tone: BudgetTone;

  if (monthProg.state === 'future') {
    message = 'This month has not started yet.';
    tone = 'good';
  } else if (monthProg.state === 'past') {
    message = usedPct > 100
      ? 'Month complete. You exceeded your total budget.'
      : usedPct >= 80
        ? 'Month complete. You finished near your limit.'
        : 'Month complete. You stayed within your budget.';
    tone = usedPct > 100 ? 'over' : usedPct >= 80 ? 'warning' : 'good';
  } else {
    const delta = usedPct - elapsedPct;
    if (delta > 5) {
      message = `You are spending faster than the month is progressing (${delta}% ahead). Check categories near their limit.`;
      tone = usedPct >= 100 ? 'over' : 'warning';
    } else if (delta < -5) {
      message = `You are spending slower than the month is progressing (${Math.abs(delta)}% behind). Good pace.`;
      tone = 'good';
    } else {
      message = 'You are on track with your monthly pace.';
      tone = 'good';
    }
  }

  return {
    elapsed: elapsedPct,
    used: usedPct,
    daysElapsed,
    daysInMonth,
    daysLeft,
    message,
    tone,
  };
}

export interface BudgetAlert {
  budgetId: string;
  category: string;
  icon: string;
  pct: number;
  left: number;
  type: 'over' | 'near';
  message: string;
}

export function buildBudgetAlerts(
  budgetsWithSpending: BudgetWithSpending[],
  settings: { budget80: boolean; budget100: boolean }
): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];

  for (const b of budgetsWithSpending) {
    if (settings.budget100 && b.pct >= 100) {
      alerts.push({
        budgetId: b.id,
        category: b.category,
        icon: b.icon,
        pct: b.pct,
        left: b.left,
        type: 'over',
        message: `${b.category} is ${b.pct}% used (${b.left < 0 ? 'over by ' + Math.abs(b.left) : 'at limit'}).`,
      });
    } else if (settings.budget80 && b.pct >= 80 && b.pct < 100) {
      alerts.push({
        budgetId: b.id,
        category: b.category,
        icon: b.icon,
        pct: b.pct,
        left: b.left,
        type: 'near',
        message: `${b.category} is at ${b.pct}% of its limit (${b.left} remaining).`,
      });
    }
  }

  // Sort: over first, then by pct descending
  return alerts.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'over' ? -1 : 1;
    return b.pct - a.pct;
  });
}