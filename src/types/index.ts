export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Account {
  id: string;
  name: string;
  short: string;
  type: string;
  balance: number;
  icon: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Transaction {
  id: string;
  date: string; // ISO string YYYY-MM-DD or full ISO
  time: string;
  accountId: string;
  account?: Account;
  toAccountId?: string | null;
  toAccount?: Account | null;
  name: string;
  category: string;
  categoryParent?: string | null; // set by the API when the category has a parent
  type: TransactionType;
  amount: number;
  icon: string;
  note?: string | null;
  label?: string | null; // user's own annotation, separate from the system note
  externalRef?: string | null; // bank/wallet transaction reference
  transferGroupId?: string | null; // links the two account-side rows of one transfer
  transferDirection?: 'in' | 'out' | null;
  fresh?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Budget {
  id: string;
  category: string;
  icon: string;
  limit: number;
  color: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BudgetWithSpending extends Budget {
  spent: number;
  pct: number;
  left: number;
  proj: number;
  dl: number;
  status: string;
  tone: 'good' | 'warning' | 'over';
  color: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  parentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Rule {
  id: string;
  keyword: string;
  category: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Settings {
  workspace: string;
  currency: 'ETB' | 'USD';
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  budget80: boolean;
  budget100: boolean;
  review: boolean;
  mcpEnabled?: boolean;
  hasMcpKey?: boolean;
  mcpKeyPreview?: string | null;
  cycleStartDay?: number;
  // Wishlist — manual-only estimates in v1 (no auto mode yet).
  wishlistCushion?: number | null;        // late-salary runway (ETB); unset = suggestions paused
  wishlistIncomeOverride?: number | null; // manual average income (ETB); unlocks cyclesAway
  wishlistCoolingDays?: number;           // cooling-off before an item shows Ready (0-365, default 14)
  wishlistExcludedCategories?: string[];  // one-off categories excluded from the surplus estimate
}

export type Period = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

export type PageName =
  | 'Overview'
  | 'Transactions'
  | 'Budgets'
  | 'Wishlist'
  | 'Accounts'
  | 'Categories'
  | 'Import & export'
  | 'Settings';

export interface TransactionFilters {
  period: Period;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  account?: string;
  category?: string;
  type?: 'all' | 'income' | 'expense' | 'transfer';
}

export interface CreateTransactionInput {
  date: string;
  time: string;
  account: string; // short name or id
  name: string;
  category?: string;
  type: TransactionType;
  amount: number;
  icon?: string;
  note?: string;
  label?: string;
  toAccount?: string; // short name or id
}

export interface CreateAccountInput {
  name: string;
  short?: string;
  type: string;
  balance: number;
  icon?: string;
}

export interface CreateBudgetInput {
  category: string;
  limit: number;
  icon?: string;
  color?: string;
}

export type WishlistItemState = 'cooling' | 'ready' | 'budget-blocked' | 'saving' | 'unknown';
export type WishlistItemStatus = 'active' | 'purchased';

export interface WishlistItem {
  id: string;
  name: string;
  price: number;
  priority: number;
  category: string | null;
  note: string | null;
  url: string | null;
  status: WishlistItemStatus;
  purchasedAt: string | null;
  transactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComputedWishlistItem extends WishlistItem {
  state: WishlistItemState;
  ageDays: number;
  coolingDaysLeft: number;
  cyclesAway: number | null;
  progress: number;
  budgetHeadroom: number | null;
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
  cushion: number | null;
  runwayDays: number | null;
  remainingBudgets: number;
  remainingBudgetBreakdown: RemainingBudgetEntry[];
  safeToSpend: number | null;
  incomeOverride: number | null;
  excludedCategories: string[];
  surplus: number | null;
  surplusSource: 'cycles' | 'budgets' | 'none';
  surplusDetail: string;
  cyclesUsed: number;
  coolingDays: number;
  budgetPaceAhead: boolean;
  budgetPaceMessage: string | null;
  hasBudgets: boolean;
  currentCycleLabel: string;
  firstTransactionDate: string | null;
}

export type WishlistSuggestion =
  | { kind: 'set-cushion' }
  | { kind: 'empty' }
  | { kind: 'ready'; itemId: string }
  | { kind: 'hold'; message: string }
  | { kind: 'next-up'; itemId: string; cyclesAway: number | null }
  | { kind: 'cooling'; itemId: string; daysLeft: number }
  | { kind: 'none'; message: string };

export interface CreateWishlistInput {
  name: string;
  price: number;
  priority?: number;
  category?: string | null;
  note?: string | null;
  url?: string | null;
}
