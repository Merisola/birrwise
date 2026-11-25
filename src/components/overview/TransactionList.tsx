'use client';

import React from 'react';
import { Transaction } from '@/types';
import { fdate, key, transferAccountLabel } from '@/lib/utils';
import { categoryLabel } from '@/lib/categories';
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
            const acct = transferAccountLabel(t, transactions);
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
                    {t.label && (
                      <span className="tx-label" title={`Your label: ${t.label}`}>
                        🏷 {t.label}
                      </span>
                    )}
                  </div>
                </div>
                <span className="category-pill" title={categoryLabel(t)}>
                  {categoryLabel(t)}
                </span>
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
