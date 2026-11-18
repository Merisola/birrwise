'use client';

import React from 'react';
import { monthLabel } from '@/lib/dates';
import { BudgetPace } from '@/hooks/useBudgets';

interface BudgetPaceCardProps {
  pace: BudgetPace;
  month: string;
}

export const BudgetPaceCard: React.FC<BudgetPaceCardProps> = ({
  pace,
  month,
}) => {
  const { elapsed, used, daysElapsed, daysInMonth, daysLeft, message, tone } = pace;
  const label = monthLabel(month);
  const stateLabel = pace.tone === 'over' ? 'over budget' : pace.tone === 'warning' ? 'ahead of pace' : 'on track';

  const paceBarColor =
    tone === 'over'
      ? '#d65c62'
      : tone === 'warning'
        ? '#d69a42'
        : '#16865b';

  return (
    <div className="budget-side-card">
      <h3>Monthly spending pace</h3>
      <div className="subtle">
        {label} · Day {daysElapsed} of {daysInMonth}
        {daysLeft > 0 && ` · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
      </div>

      <div className="pace-row">
        <span>Month elapsed</span>
        <strong id="paceElapsed">{elapsed}%</strong>
      </div>
      <div className="pace-track">
        <span id="paceElapsedBar" style={{ width: `${elapsed}%` }} />
      </div>

      <div className="pace-row">
        <span>Budget used</span>
        <strong id="paceUsed">{used}%</strong>
      </div>
      <div className="pace-track">
        <span
          id="paceBar"
          style={{ width: `${Math.min(used, 100)}%`, background: paceBarColor }}
        />
      </div>

      <div
        className={`budget-tip ${tone}`}
        id="paceMessage"
        style={{ marginTop: '15px' }}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </div>
  );
};