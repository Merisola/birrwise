'use client';

import React from 'react';
import { Transaction } from '@/types';
import { fdate, key } from '@/lib/utils';
import { useUIState } from '@/context/UIContext';

interface TransactionListProps {
  transactions: Transaction[];
  onOpenDrawer: (id: string) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onOpenDrawer,
}) => {
  const { ovFilter, setOvFilter, setPage } = useUIState();

  const filters = ['All', 'BOA', 'CBE', 'Telebirr', 'Cash'];

  const recentTransactions = transactions
    .filter(
      (t) =>
        t.category !== 'Uncategorized' &&
        (ovFilter === 'All' ||
          t.account?.short === ovFilter ||
          t.toAccount?.short === ovFilter)
    )
    .sort((a, b) => key(b).localeCompare(key(a)))
    .slice(0, 6);

  return (
    <div>
      <div className="panel-head" style={{ marginTop: '20px' }}>
        <h3>Recent transactions</h3>
        <button
          type="button"
          className="text-link"
          onClick={() => setPage('Transactions')}
        >
          View all ↗
        </button>
      </div>

      <div className="filters">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            className={`filter ${ovFilter === f ? 'active' : ''}`}
            onClick={() => setOvFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div id="transactionList">
        {recentTransactions.length === 0 ? (
          <div className="empty">No activity for this account yet.</div>
        ) : (
          recentTransactions.map((t) => {
            const acctName = t.account?.short || t.account?.name || 'Cash';
            const toAcctName = t.toAccount?.short || t.toAccount?.name;
            const acct =
              t.type === 'transfer'
                ? `${acctName} → ${toAcctName || '—'}`
                : acctName;
            const sign =
              t.type === 'income' ? '+ ' : t.type === 'transfer' ? '⇄ ' : '− ';

            return (
              <div
                key={t.id}
                className={`transaction ${t.fresh ? 'fresh' : ''}`}
                onClick={() => onOpenDrawer(t.id)}
              >
                <div className="merchant-icon">{t.icon || '•'}</div>
                <div>
                  <div className="tx-name">{t.name}</div>
                  <div className="tx-meta">
                    {acct} · {fdate(t)}
                  </div>
                </div>
                <span className="category-pill">{t.category}</span>
                <div
                  className={`tx-amount ${
                    t.type === 'income' ? 'credit' : 'debit'
                  }`}
                >
                  {sign}
                  {t.amount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                  <span className="tx-date">ETB</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
