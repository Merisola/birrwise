'use client';

import React, { useRef } from 'react';
import { useUIState } from '@/context/UIContext';
import { generateTransactionsCSV } from '@/lib/csv';
import { downloadBlob, nowT } from '@/lib/utils';
import { todayISO } from '@/lib/dates';
import { Transaction } from '@/types';

interface QuickActionsProps {
  transactions: Transaction[];
  onAddTransaction: (data: any) => Promise<Transaction>;
  onRemoveTransaction: (id: string) => Promise<void>;
}

const SMS_SAMPLES: [string, string, number, string][] = [
  ['Telebirr', 'Ride payment', 70, '🚕'],
  ['Telebirr', 'Tomoca Coffee', 85, '☕'],
  ['CBE', 'POS purchase', 310, '🛍'],
  ['Telebirr', 'Ride payment', 80, '🚕'],
  ['Telebirr', 'Unknown recipient', 150, '◉'],
  ['BOA', 'Salary bonus', 2000, '↗'],
];

export const QuickActions: React.FC<QuickActionsProps> = ({
  transactions,
  onAddTransaction,
  onRemoveTransaction,
}) => {
  const { openCashModal, setPage, showToast } = useUIState();
  const smsIndexRef = useRef(0);

  const handleSimulateSMS = async () => {
    const [account, name, amount, icon] =
      SMS_SAMPLES[smsIndexRef.current % SMS_SAMPLES.length];
    smsIndexRef.current += 1;

    const isIncome = name === 'Salary bonus';

    try {
      const created = await onAddTransaction({
        date: todayISO(),
        time: nowT(),
        account,
        name,
        category: isIncome ? 'Income' : '',
        type: isIncome ? 'income' : 'expense',
        amount,
        icon,
        note: 'Auto-parsed from SMS',
      });

      showToast(
        `New SMS · ${name} ${isIncome ? '+' : '−'}${amount} ETB → ${
          created.category
        }`,
        [
          {
            label: 'Undo',
            onClick: () => onRemoveTransaction(created.id),
          },
        ]
      );
    } catch {
      showToast('Failed to simulate SMS');
    }
  };

  const handleExportCSV = () => {
    const csvContent = generateTransactionsCSV(transactions);
    downloadBlob(csvContent, 'birrwise-transactions.csv', 'text/csv;charset=utf-8');
    showToast('Transaction CSV exported.');
  };

  return (
    <>
      <div className="section-head">
        <h2>Quick actions</h2>
      </div>
      <div style={{ display: 'flex', gap: '9px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="secondary-btn"
          onClick={openCashModal}
        >
          ＋ Record cash expense
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={handleSimulateSMS}
        >
          📩 Simulate incoming SMS
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={handleExportCSV}
        >
          ⇩ Export transactions
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => setPage('Categories')}
        >
          ⚙ Manage rules
        </button>
      </div>
    </>
  );
};