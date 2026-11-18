'use client';

import React from 'react';
import { Transaction } from '@/types';

interface TransactionTableProps {
  transactions: Transaction[];
  onOpenDrawer: (id: string) => void;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  onOpenDrawer,
}) => {
  if (transactions.length === 0) {
    return (
      <div className="tx-empty" id="txEmpty">
        No transactions match these filters. Try a wider date range or clear a filter.
      </div>
    );
  }

  return (
    <div className="tx-table-wrap">
      <table className="tx-table">
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Date & time</th>
            <th>Account</th>
            <th>Category</th>
            <th style={{ textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody id="allTransactionsBody">
          {transactions.map((t) => {
            const acctName = t.account?.short || t.account?.name || 'Cash';
            const toAcctName = t.toAccount?.short || t.toAccount?.name;
            const acct =
              t.type === 'transfer'
                ? `${acctName} → ${toAcctName || '—'}`
                : acctName;

            const sign =
              t.type === 'income' ? '+ ' : t.type === 'transfer' ? '' : '− ';
            const amtStr = `${sign}${t.amount.toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })} ETB`;

            let dFormatted = '';
            try {
              dFormatted = new Date(
                (t.date || '').slice(0, 10) + 'T12:00:00'
              ).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
            } catch {
              dFormatted = t.date;
            }

            const amountCls =
              t.type === 'income'
                ? 'income'
                : t.type === 'transfer'
                ? 'xfer'
                : '';

            return (
              <tr key={t.id} onClick={() => onOpenDrawer(t.id)}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                    <div className="merchant-icon">{t.icon || '•'}</div>
                    <div>
                      <div className="merchant-cell">{t.name}</div>
                      <div className="muted-cell">{t.note || ''}</div>
                    </div>
                  </div>
                </td>
                <td>
                  {dFormatted}
                  <div className="muted-cell">{t.time || ''}</div>
                </td>
                <td>
                  <span className="account-tag">{acct}</span>
                </td>
                <td>
                  <span
                    className={`category-tag ${
                      t.category === 'Uncategorized' ? 'unc' : ''
                    }`}
                  >
                    {t.category}
                  </span>
                </td>
                <td className={`amount-cell ${amountCls}`}>{amtStr}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
