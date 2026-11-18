'use client';

import React from 'react';
import { Period } from '@/types';
import { Tabs } from '@/components/ui/Tabs';

interface TransactionToolbarProps {
  period: Period;
  onPeriodChange: (p: Period) => void;
  dateFrom: string;
  onDateFromChange: (d: string) => void;
  dateTo: string;
  onDateToChange: (d: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
  account: string;
  onAccountChange: (a: string) => void;
  category: string;
  onCategoryChange: (c: string) => void;
  type: string;
  onTypeChange: (t: string) => void;
}

export const TransactionToolbar: React.FC<TransactionToolbarProps> = ({
  period,
  onPeriodChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  search,
  onSearchChange,
  account,
  onAccountChange,
  category,
  onCategoryChange,
  type,
  onTypeChange,
}) => {
  return (
    <div className="tx-toolbar">
      <Tabs activePeriod={period} onSelectPeriod={onPeriodChange} />

      {period === 'custom' && (
        <div className="date-range" id="customRange">
          <input
            type="date"
            id="dateFrom"
            aria-label="Start date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
          <span className="subtle">to</span>
          <input
            type="date"
            id="dateTo"
            aria-label="End date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>
      )}

      <input
        className="search-control"
        id="txSearch"
        placeholder="⌕ Search merchant, note or amount..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <select
        className="filter-control"
        id="accountFilter"
        value={account}
        onChange={(e) => onAccountChange(e.target.value)}
      >
        <option value="all">All accounts</option>
        <option value="BOA">BOA</option>
        <option value="CBE">CBE</option>
        <option value="Telebirr">Telebirr</option>
        <option value="Cash">Cash</option>
      </select>

      <select
        className="filter-control"
        id="categoryFilter"
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
      >
        <option value="all">All categories</option>
        <option value="Income">Income</option>
        <option value="Transport">Transport</option>
        <option value="Coffee & snacks">Coffee & snacks</option>
        <option value="Food & groceries">Food & groceries</option>
        <option value="Bills">Bills</option>
        <option value="Personal">Personal</option>
        <option value="Internal transfer">Internal transfer</option>
        <option value="Uncategorized">Uncategorized</option>
      </select>

      <select
        className="filter-control"
        id="typeFilter"
        value={type}
        onChange={(e) => onTypeChange(e.target.value)}
      >
        <option value="all">All types</option>
        <option value="expense">Expenses</option>
        <option value="income">Income</option>
        <option value="transfer">Transfers</option>
      </select>
    </div>
  );
};
