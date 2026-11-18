'use client';

import React from 'react';
import { Transaction } from '@/types';
import { fmt } from '@/lib/utils';

interface MetricsRowProps {
  transactions: Transaction[];
  currentMonth: string;
}

export const MetricsRow: React.FC<MetricsRowProps> = ({
  transactions,
  currentMonth,
}) => {
  const monthTx = transactions.filter((t) => (t.date || '').startsWith(currentMonth));
  const inc = monthTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const exp = monthTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const net = inc - exp;

  const expPct = inc ? Math.round((exp / inc) * 100) : 0;
  const expNote = inc ? `${expPct}% of income spent` : 'No income recorded';

  return (
    <section className="metrics">
      <div className="metric">
        <div className="metric-head">
          <span>Income</span>
          <span>↗</span>
        </div>
        <div className="metric-value sens" id="incV" style={{ color: 'var(--green)' }}>
          {fmt(inc)}
        </div>
        <div className="metric-note">Salary and other credits</div>
      </div>

      <div className="metric">
        <div className="metric-head">
          <span>Expenses</span>
          <span>↘</span>
        </div>
        <div className="metric-value sens" id="expV">
          {fmt(exp)}
        </div>
        <div className="metric-note" id="expNote">
          {expNote}
        </div>
      </div>

      <div className="metric">
        <div className="metric-head">
          <span>Net cash flow</span>
          <span>◎</span>
        </div>
        <div className="metric-value sens" id="netV">
          {fmt(net)}
        </div>
        <div className="metric-note">Income minus expenses</div>
      </div>
    </section>
  );
};
