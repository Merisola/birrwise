'use client';

import React, { useState } from 'react';
import { useUIState } from '@/context/UIContext';
import { useBudgets, monthOptions } from '@/hooks/useBudgets';
import { buildBudgetAlerts } from '@/lib/budgets';
import { BudgetSummaryGrid } from '@/components/budgets/BudgetSummaryGrid';
import { BudgetCard } from '@/components/budgets/BudgetCard';
import { BudgetPaceCard } from '@/components/budgets/BudgetPaceCard';
import { BudgetAlertsCard } from '@/components/budgets/BudgetAlertsCard';
import { BudgetAlertBanner } from '@/components/budgets/BudgetAlertBanner';
import { QuickInsightCard } from '@/components/budgets/QuickInsightCard';
import { ReloadButton } from '@/components/layout/ReloadButton';

export default function BudgetsPage() {
  const {
    currentMonth,
    setMonth,
    setBudgetModalOpen,
    setEditingBudgetId,
    showToast,
  } = useUIState();

  const { budgets, summary, pace, monthLabel, isLoading, error, delete: deleteBudget } = useBudgets(currentMonth);

  const alerts = buildBudgetAlerts(budgets, { budget80: true, budget100: true });
  const monthOpts = monthOptions();

  const handleCreateClick = () => {
    setEditingBudgetId(null);
    setBudgetModalOpen(true);
  };

  const handleEdit = (id: string) => {
    setEditingBudgetId(id);
    setBudgetModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const b = budgets.find((item) => item.id === id);
    if (!b) return;
    try {
      await deleteBudget(id);
      showToast(`${b.category} budget removed.`);
    } catch {
      showToast('Failed to remove budget');
    }
  };

  if (isLoading) {
    return (
      <div className="page-view">
        <div className="empty" style={{ padding: '60px' }}>Loading budgets…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-view">
        <div className="empty" style={{ padding: '60px' }}>
          Failed to load budgets. <button className="text-link" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-view">
      <div className="budget-page-top">
        <div>
          <h2>Budgets</h2>
          <p>
            Give every birr a direction. Track your spending before the month
            gets away from you.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <ReloadButton />
          <select
            className="budget-month"
            id="budgetMonth"
            value={currentMonth}
            onChange={(e) => setMonth(e.target.value)}
          >
            {monthOpts.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="primary-btn"
            onClick={handleCreateClick}
          >
            ＋ Create budget
          </button>
        </div>
      </div>

      <BudgetAlertBanner alerts={alerts} />

      <BudgetSummaryGrid
        total={summary.total}
        spent={summary.spent}
        remaining={summary.remaining}
        pct={summary.pct}
        monthLabel={monthLabel}
      />

      <div className="budget-layout">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Category budgets</h3>
              <div className="subtle" style={{ marginTop: '4px' }}>
                Your spending against each monthly limit
              </div>
            </div>
            <button
              type="button"
              className="text-link"
              onClick={() =>
                showToast(
                  'Budget amounts are editable from each category card.'
                )
              }
            >
              How it works ⓘ
            </button>
          </div>

          <div className="budget-list" id="budgetCards">
            {budgets.length === 0 ? (
              <div className="empty">
                No budgets yet. Create one to start tracking.
              </div>
            ) : (
              budgets.map((b) => (
                <BudgetCard
                  key={b.id}
                  budget={b}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        </div>

        <aside>
          <BudgetPaceCard pace={pace} month={currentMonth} />
          <BudgetAlertsCard />
          <QuickInsightCard budgets={budgets} />
        </aside>
      </div>
    </div>
  );
}