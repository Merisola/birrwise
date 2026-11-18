'use client';

import React from 'react';
import { BudgetWithSpending } from '@/types';
import { money } from '@/lib/utils';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface BudgetCardProps {
  budget: BudgetWithSpending;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export const BudgetCard: React.FC<BudgetCardProps> = ({
  budget,
  onEdit,
  onDelete,
}) => {
  const isOver = budget.tone === 'over';
  const isWarning = budget.tone === 'warning';

  return (
    <div
      className={`budget-card ${isOver ? 'tone-over' : isWarning ? 'tone-warning' : ''}`}
    >
      <div className="budget-card-top">
        <div className="budget-emoji">{budget.icon}</div>
        <div>
          <div className="budget-card-title">{budget.category}</div>
          <div className="budget-card-sub">
            <span className={`status-pill ${budget.tone}`}>{budget.status}</span>
          </div>
        </div>
        <div className="budget-card-actions">
          <button
            type="button"
            className="small-action"
            onClick={() => onEdit(budget.id)}
          >
            Edit
          </button>
          <button
            type="button"
            className="small-action danger"
            onClick={() => onDelete(budget.id)}
          >
            Remove
          </button>
        </div>
      </div>

      <div className="budget-card-amounts">
        <strong>
          {money(budget.spent)}{' '}
          <span style={{ font: "400 11px 'DM Sans'", color: 'var(--muted)' }}>
            of {money(budget.limit)}
          </span>
        </strong>
        <span>{budget.pct}%</span>
      </div>

      <ProgressBar
        pct={budget.pct}
        color={budget.color}
        variant="budget-track"
        showThreshold
        thresholdPct={80}
      />

      <div className="budget-card-foot">
        <span className={budget.tone}>
          {budget.left >= 0
            ? `${money(budget.left)} remaining`
            : `${money(-budget.left)} over limit`}
        </span>
        <span>
          {budget.dl && budget.left > 0
            ? `~${money(Math.round(budget.left / budget.dl))}/day · `
            : ''}
          on pace for {money(Math.round(budget.proj))}
        </span>
      </div>
    </div>
  );
};