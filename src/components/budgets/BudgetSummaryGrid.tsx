'use client';

import React from 'react';
import { money } from '@/lib/utils';

interface BudgetSummaryGridProps {
  total: number;
  spent: number;
  remaining: number;
  pct: number;
  monthLabel?: string;
}

export const BudgetSummaryGrid: React.FC<BudgetSummaryGridProps> = ({
  total,
  spent,
  remaining,
  pct,
  monthLabel,
}) => {
  return (
    <div className="budget-summary-grid">
      <div className="budget-summary">
        <span>Total budgeted</span>
        <strong id="budgetTotal">{money(total)}</strong>
        <small>{monthLabel ? `For ${monthLabel}` : 'Across all active categories'}</small>
      </div>
      <div className="budget-summary">
        <span>Total spent</span>
        <strong id="budgetSpent">{money(spent)}</strong>
        <small id="budgetSpentPct">{pct}% of your limits</small>
      </div>
      <div className="budget-summary">
        <span>Remaining</span>
        <strong
          id="budgetRemaining"
          style={{ color: remaining < 0 ? 'var(--red)' : 'var(--green)' }}
        >
          {money(remaining)}
        </strong>
        <small>Available for the rest of the month</small>
      </div>
    </div>
  );
};