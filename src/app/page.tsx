'use client';

import React from 'react';
import { useUIState } from '@/context/UIContext';
import { useTransactions } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import { useBudgets } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { BalanceHero } from '@/components/overview/BalanceHero';
import { AccountGrid } from '@/components/overview/AccountGrid';
import { MetricsRow } from '@/components/overview/MetricsRow';
import { ReviewPanel } from '@/components/overview/ReviewPanel';
import { TransactionList } from '@/components/overview/TransactionList';
import { SpendingBreakdown } from '@/components/overview/SpendingBreakdown';
import { BudgetOverview } from '@/components/overview/BudgetOverview';
import { QuickActions } from '@/components/overview/QuickActions';
import { monthLabel } from '@/lib/dates';

export default function OverviewPage() {
  const { currentMonth, setPage, openDrawer } = useUIState();
  const {
    transactions,
    create: createTransaction,
    delete: deleteTransaction,
    setCategory,
  } = useTransactions({ period: 'all' });
  const { accounts } = useAccounts();
  const { budgets } = useBudgets(currentMonth);
  const { rules } = useCategories();

  const monthTitle = monthLabel(currentMonth);

  return (
    <div className="page-view">
      <BalanceHero
        accounts={accounts}
        transactions={transactions}
        currentMonth={currentMonth}
      />

      <div className="section-head">
        <h2>Your accounts</h2>
        <button
          type="button"
          className="text-link"
          onClick={() => setPage('Accounts')}
        >
          Manage accounts ↗
        </button>
      </div>
      <AccountGrid accounts={accounts} />

      <div className="section-head">
        <h2 id="ovTitle">{monthTitle} at a glance</h2>
        <span className="subtle">Transfers are excluded from spending</span>
      </div>
      <MetricsRow
        transactions={transactions}
        currentMonth={currentMonth}
      />

      <section className="content-grid">
        <div className="panel" id="reviewPanel">
          <ReviewPanel
            transactions={transactions}
            rules={rules}
            onSetCategory={setCategory}
            onOpenDrawer={openDrawer}
          />
          <TransactionList
            transactions={transactions}
            onOpenDrawer={openDrawer}
          />
        </div>

        <div className="stack">
          <SpendingBreakdown
            transactions={transactions}
            currentMonth={currentMonth}
          />
          <BudgetOverview
            budgets={budgets}
            currentMonth={currentMonth}
          />
        </div>
      </section>

      <QuickActions
        transactions={transactions}
        onAddTransaction={createTransaction}
        onRemoveTransaction={deleteTransaction}
      />
    </div>
  );
}
