import React from 'react';
import { Period } from '@/types';

interface TabsProps {
  activePeriod: Period;
  onSelectPeriod: (period: Period) => void;
}

const TABS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Daily' },
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
  { id: 'year', label: 'Yearly' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];

export const Tabs: React.FC<TabsProps> = ({
  activePeriod,
  onSelectPeriod,
}) => {
  return (
    <div className="period-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={activePeriod === tab.id ? 'active' : ''}
          onClick={() => onSelectPeriod(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
