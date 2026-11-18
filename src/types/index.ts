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
}

export type Period = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

export type PageName =
  | 'Overview'
  | 'Transactions'
  | 'Budgets'
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
