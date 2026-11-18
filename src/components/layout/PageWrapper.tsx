'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { CashModal } from '@/components/ui/CashModal';
import { BudgetModal } from '@/components/ui/BudgetModal';
import { TransactionDrawer } from '@/components/ui/TransactionDrawer';
import { Toast } from '@/components/ui/Toast';
import { useTransactions } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useUIState } from '@/context/UIContext';

export const PageWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const pathname = usePathname();

  // The login page is standalone: no app shell and no data hooks.
  if (pathname === '/login') {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentMonth } = useUIState();
  const {
    transactions,
    create: createTransaction,
    delete: deleteTransaction,
    setCategory,
    createRuleFromTransaction,
  } = useTransactions({ period: 'all' });
  const { accounts, create: createAccount } = useAccounts();
  const {
    budgets,
    create: createBudget,
    update: updateBudget,
  } = useBudgets(currentMonth);
  const { categories } = useCategories();

  const reviewCount = transactions.filter(
    (t) => t.category === 'Uncategorized'
  ).length;

  const cashAccount = accounts.find((a) => a.short === 'Cash');

  return (
    <div className="app">
      <Sidebar reviewCount={reviewCount} />
      <main>
        <Topbar reviewCount={reviewCount} />
        {children}
      </main>
      <MobileNav />

      {/* Global Modals & Slide-out Drawers */}
      <CashModal
        cashAccount={cashAccount}
        onSaveCash={createTransaction}
        onUndo={deleteTransaction}
      />
      <BudgetModal
        budgets={budgets}
        onCreateBudget={async (data) => {
          await createBudget(data);
        }}
        onUpdateBudget={async (id, limit) => {
          await updateBudget(id, limit);
        }}
      />
      <TransactionDrawer
        transactions={transactions}
        categories={categories}
        onSetCategory={setCategory}
        onCreateRule={createRuleFromTransaction}
      />
      <Toast />
    </div>
  );
};
