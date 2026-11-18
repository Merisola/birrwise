'use client';

import React from 'react';
import { Transaction } from '@/types';
import { money } from '@/lib/utils';
import { useUIState } from '@/context/UIContext';

interface SpendingBreakdownProps {
  transactions: Transaction[];
  currentMonth: string;
}

export const SpendingBreakdown: React.FC<SpendingBreakdownProps> = ({
  transactions,
  currentMonth,
}) => {
  const { goCat } = useUIState();

  const monthExpenses = transactions.filter(
    (t) =>
      (t.date || '').startsWith(currentMonth) &&
      t.type === 'expense' &&
      t.category !== 'Uncategorized'
  );

  const byCat: Record<string, number> = {};
  monthExpenses.forEach((t) => {
    byCat[t.category] = (byCat[t.category] || 0) + t.amount;
  });

  const sorted = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const maxVal = sorted[0]?.[1] || 1;

  return (
    <aside className="panel">
      <div className="panel-head">
        <h3>Where your money went</h3>
        <span className="subtle">Tap to open</span>
      </div>

      <div id="breakdown">
        {sorted.length === 0 ? (
          <div className="empty">No spending yet this month.</div>
        ) : (
          sorted.map(([cat, val]) => {
            const widthPct = Math.min(Math.round((val / maxVal) * 100), 100);
            return (
              <div
                key={cat}
                className="bd"
                onClick={() => goCat(cat)}
              >
                <div className="budget-top">
                  <span className="budget-name">{cat}</span>
                  <span className="budget-amount">{money(val)}</span>
                </div>
                <div className="progress">
                  <span style={{ width: `${widthPct}%` }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
