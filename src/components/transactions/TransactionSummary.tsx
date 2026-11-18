'use client';

import React from 'react';
import { fmt } from '@/lib/utils';

interface TransactionSummaryProps {
  income: number;
  expenses: number;
  count: number;
}

export const TransactionSummary: React.FC<TransactionSummaryProps> = ({
  income,
  expenses,
  count,
}) => {
  return (
    <div className="tx-summary">
      <div className="tx-summary-card">
        <span>Total income · selected period</span>
        <strong id="periodIncome" style={{ color: 'var(--green)' }}>
          {fmt(income)}
        </strong>
      </div>
      <div className="tx-summary-card">
        <span>Total expenses · selected period</span>
        <strong id="periodExpenses">{fmt(expenses)}</strong>
      </div>
      <div className="tx-summary-card">
        <span>Transactions found</span>
        <strong id="periodCount">{count}</strong>
      </div>
    </div>
  );
};
