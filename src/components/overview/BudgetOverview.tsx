'use client';

import React from 'react';
import { BudgetWithSpending } from '@/types';
import { money, elapsed } from '@/lib/utils';
import { useUIState } from '@/context/UIContext';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { buildBudgetAlerts, BudgetAlert } from '@/lib/budgets';
import { BudgetAlertBanner } from '@/components/budgets/BudgetAlertBanner';

interface BudgetOverviewProps {
  budgets: BudgetWithSpending[];
  currentMonth: string;
}

export const BudgetOverview: React.FC<BudgetOverviewProps> = ({
  budgets,
  currentMonth,
}) => {
  const { setPage } = useUIState();

  const el = elapsed(currentMonth);
  const monthProgress = Math.round(el * 100);

  const top = [...budgets].sort((a, b) => b.pct - a.pct)[0];
  const insightText = top
    ? top.pct >= 80
      ? `${top.category} has used ${top.pct}% of its limit` +
        (top.dl ? ` with ${top.dl} days left.` : '.')
      : `Everything is under 80%. ${top.category} is the closest at ${top.pct}%.`
    : 'Create a budget to see pace insights here.';

  const alerts = buildBudgetAlerts(budgets, { budget80: true, budget100: true });

  return (
    <aside className="panel">
      <div className="panel-head">
        <h3>Budget overview</h3>
        <button
          type="button"
          className="text-link"
          onClick={() => setPage('Budgets')}
        >
          Edit budgets ↗
        </button>
      </div>
      <div className="subtle">
        The dark tick marks how far through the month you are
      </div>

      <BudgetAlertBanner alerts={alerts} />

      <div id="budgetOverview">
        {budgets.length === 0 ? (
          <div className="empty">No budgets yet.</div>
        ) : (
          budgets.map((b) => (
            <div key={b.id} className="budget">
              <div className="budget-top">
                <span className="budget-name">
                  {b.icon} {b.category}
                </span>
                <span className="budget-amount">
                  {money(b.spent)} / {money(b.limit)}
                </span>
              </div>
              <ProgressBar
                pct={b.pct}
                color={b.color}
                variant="progress"
                showTick={el < 1}
                tickPct={monthProgress}
                showThreshold
                thresholdPct={80}
              />
              <div className="budget-bottom">
                <span className={b.tone}>
                  {b.pct}% · {b.status}
                </span>
                <span>{money(Math.max(0, b.left))} left</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="insight">
        <div className="spark">✦</div>
        <div>
          <strong>Heads-up</strong>
          <p id="ovInsight">{insightText}</p>
        </div>
      </div>
    </aside>
  );
};