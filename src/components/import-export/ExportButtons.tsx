'use client';

import React from 'react';
import { Account, Transaction } from '@/types';
import { generateTransactionsCSV, generateAccountsCSV } from '@/lib/csv';
import { downloadBlob } from '@/lib/utils';
import { useUIState } from '@/context/UIContext';

interface ExportButtonsProps {
  transactions: Transaction[];
  accounts: Account[];
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({
  transactions,
  accounts,
}) => {
  const { showToast } = useUIState();

  const handleExportTransactions = () => {
    const csvContent = generateTransactionsCSV(transactions);
    downloadBlob(
      csvContent,
      'birrwise-transactions.csv',
      'text/csv;charset=utf-8'
    );
    showToast('Transaction CSV exported.');
  };

  const handleExportAccounts = () => {
    const csvContent = generateAccountsCSV(accounts);
    downloadBlob(
      csvContent,
      'birrwise-accounts.csv',
      'text/csv;charset=utf-8'
    );
    showToast('Account CSV exported.');
  };

  return (
    <div className="manage-card">
      <h3>Export your data</h3>
      <p className="help">
        Download a copy of the transaction ledger for spreadsheets, accounting
        or your own archive.
      </p>

      <div className="setting-line">
        <div>
          <strong>Transactions CSV</strong>
          <small>All visible demo transactions and imported rows</small>
        </div>
        <button
          type="button"
          className="secondary-btn"
          onClick={handleExportTransactions}
        >
          ⇩ Export CSV
        </button>
      </div>

      <div className="setting-line">
        <div>
          <strong>Account summary</strong>
          <small>Account names, types and current balances</small>
        </div>
        <button
          type="button"
          className="secondary-btn"
          onClick={handleExportAccounts}
        >
          ⇩ Export CSV
        </button>
      </div>

      <div className="data-note">
        Exports are generated in your browser. Real bank statement parsing, Excel
        export and server-side backups require backend integration.
      </div>
    </div>
  );
};
