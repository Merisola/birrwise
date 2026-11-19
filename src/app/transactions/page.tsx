'use client';

import React, { useState, useEffect } from 'react';
import { useUIState } from '@/context/UIContext';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { TransactionSummary } from '@/components/transactions/TransactionSummary';
import { TransactionToolbar } from '@/components/transactions/TransactionToolbar';
import { TransactionTable } from '@/components/transactions/TransactionTable';
import { generateTransactionsCSV } from '@/lib/csv';
import { downloadBlob } from '@/lib/utils';
import { todayISO, monthBounds } from '@/lib/dates';
import { useUIState as useUI } from '@/context/UIContext';
import { ReloadButton } from '@/components/layout/ReloadButton';

export default function TransactionsPage() {
  const {
    openCashModal,
    openDrawer,
    selectedPeriod,
    setPeriod,
    selectedAccountFilter,
    setSelectedAccountFilter,
    selectedCategoryFilter,
    setSelectedCategoryFilter,
    showToast,
  } = useUI();

  const [dateFrom, setDateFrom] = useState(() => {
    const bounds = monthBounds(); // default calendar-based for custom period
    return bounds.start.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => todayISO());
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');

  // Update default dates when month changes (for custom period)
  useEffect(() => {
    if (selectedPeriod === 'custom') {
      const bounds = monthBounds();
      setDateFrom(bounds.start.toISOString().slice(0, 10));
      setDateTo(todayISO());
    }
  }, [selectedPeriod]);

  const { transactions, summary } = useTransactions({
    period: selectedPeriod,
    dateFrom,
    dateTo,
    search,
    account: selectedAccountFilter,
    category: selectedCategoryFilter,
    type: type as any,
  });

  const { categories } = useCategories();

  const resetFilters = () => {
    setPeriod('all');
    setSearch('');
    setSelectedAccountFilter('all');
    setSelectedCategoryFilter('all');
    setType('all');
  };

  const handleExportCSV = () => {
    const csvContent = generateTransactionsCSV(transactions);
    const dateStr = todayISO().replace(/-/g, '');
    downloadBlob(csvContent, `birrwise-transactions-${dateStr}.csv`, 'text/csv;charset=utf-8');
    showToast('Transaction CSV exported.');
  };

  const periodLabels: Record<string, string> = {
    today: 'today',
    week: 'the last 7 days',
    month: 'this month',
    year: 'this year',
    all: 'all time',
    custom: `${dateFrom} to ${dateTo}`,
  };

  const periodDesc = periodLabels[selectedPeriod] || selectedPeriod;
  const countLabel = `Showing ${transactions.length} transaction${
    transactions.length === 1 ? '' : 's'
  } · ${periodDesc}`;

  return (
    <div className="page-view">
      <div className="tx-page-heading">
        <div>
          <h2>Transactions</h2>
          <p>Every birr in and out, in one searchable ledger.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ReloadButton />
          <button
            type="button"
            className="secondary-btn"
            onClick={handleExportCSV}
          >
            ⇩ Export CSV
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={openCashModal}
          >
            ＋ Add cash spend
          </button>
        </div>
      </div>

      <TransactionSummary
        income={summary.income}
        expenses={summary.expenses}
        count={transactions.length}
      />

      <div className="panel">
        <div className="panel-head">
          <h3>Transaction history</h3>
          <button
            type="button"
            className="text-link"
            onClick={resetFilters}
          >
            Reset filters ↺
          </button>
        </div>

        <TransactionToolbar
          period={selectedPeriod}
          onPeriodChange={setPeriod}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          search={search}
          onSearchChange={setSearch}
          account={selectedAccountFilter}
          onAccountChange={setSelectedAccountFilter}
          category={selectedCategoryFilter}
          onCategoryChange={setSelectedCategoryFilter}
          type={type}
          onTypeChange={setType}
          categories={categories}
        />

        <div className="tx-count" id="txCountLabel">
          {countLabel}
        </div>

        <TransactionTable
          transactions={transactions}
          onOpenDrawer={openDrawer}
        />
      </div>
    </div>
  );
}