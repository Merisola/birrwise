'use client';

import React from 'react';
import { BudgetWithSpending } from '@/types';
import { money } from '@/lib/utils';

interface QuickInsightCardProps {
  budgets: BudgetWithSpending[];
}

export const QuickInsightCard: React.FC<QuickInsightCardProps> = ({
  budgets,
}) => {
  const busiest = [...budgets].sort((a, b) => b.pct - a.pct)[0];

  const insightText = busiest
    ? `${busiest.category} is your busiest budget at ${busiest.pct}%. ` +
      (busiest.dl
        ? `${money(Math.max(0, busiest.left))} left over ${busiest.dl} days, about ${money(
            Math.max(0, Math.round(busiest.left / busiest.dl))
          )} a day.`
        : '')
    : 'No budgets yet.';

  return (
    <div className="budget-side-card">
      <h3>Quick insight ✦</h3>
      <div
        id="quickInsight"
        style={{ fontSize: '12px', lineHeight: 1.6, color: '#737987' }}
      >
        {insightText}
      </div>
    </div>
  );
};