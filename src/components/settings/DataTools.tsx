'use client';

import React from 'react';
import { Transaction } from '@/types';
import { generateTransactionsCSV } from '@/lib/csv';
import { downloadBlob } from '@/lib/utils';
import { useUIState } from '@/context/UIContext';

interface DataToolsProps {
  transactions: Transaction[];
  onResetDemo: () => Promise<void>;
}

export const DataTools: React.FC<DataToolsProps> = ({
  transactions,
  onResetDemo,
}) => {
  const { showToast } = useUIState();

  const handleExportBackup = () => {
    const csvContent = generateTransactionsCSV(transactions);
    downloadBlob(
      csvContent,
      'birrwise-transactions.csv',
      'text/csv;charset=utf-8'
    );
    showToast('Transaction backup downloaded.');
  };

  const handleReset = async () => {
    if (
      confirm(
        'Reset the demo transactions, accounts, categories and rules to initial seed?'
      )
    ) {
      await onResetDemo();
    }
  };

  return (
    <div className="manage-card">
      <h3>Data tools</h3>
      <p className="help">Manage the data in this session.</p>

      <div style={{ display: 'flex', gap: '9px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="secondary-btn"
          onClick={handleExportBackup}
        >
          ⇩ Download transaction backup
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={handleReset}
        >
          Reset demo data
        </button>
      </div>
    </div>
  );
};
