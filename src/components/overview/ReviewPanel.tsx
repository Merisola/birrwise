'use client';

import React from 'react';
import { Transaction, Rule } from '@/types';
import { fdate, key } from '@/lib/utils';
import { suggestCategory } from '@/lib/categorization';
import { useUIState } from '@/context/UIContext';

interface ReviewPanelProps {
  transactions: Transaction[];
  rules: Rule[];
  onSetCategory: (id: string, category: string) => Promise<void>;
  onOpenDrawer: (id: string) => void;
}

export const ReviewPanel: React.FC<ReviewPanelProps> = ({
  transactions,
  rules,
  onSetCategory,
  onOpenDrawer,
}) => {
  const { showToast } = useUIState();

  const reviewTransactions = transactions
    .filter((t) => t.category === 'Uncategorized')
    .sort((a, b) => key(b).localeCompare(key(a)));

  const handleQuickCategorize = async (
    t: Transaction,
    category: string
  ) => {
    try {
      await onSetCategory(t.id, category);
      showToast(`${t.name} → ${category}`, [
        {
          label: 'Undo',
          onClick: () => onSetCategory(t.id, 'Uncategorized'),
        },
      ]);
    } catch {
      showToast('Failed to update category');
    }
  };

  return (
    <div>
      <div className="panel-head">
        <h3>
          Needs review{' '}
          <span className="count-badge" id="reviewCount">
            {reviewTransactions.length}
          </span>
        </h3>
        <span className="subtle">One tap to confirm · rules learn from you</span>
      </div>

      <div id="reviewList">
        {reviewTransactions.length === 0 ? (
          <div className="empty">
            ✓ Inbox zero. Every transaction has a category.
          </div>
        ) : (
          reviewTransactions.map((t) => {
            const suggested = suggestCategory(t.name, rules);
            const fallbackOptions = [
              'Food & groceries',
              'Personal',
              'Transport',
              'Bills',
            ]
              .filter((c) => c !== suggested)
              .slice(0, 3);

            const acctName = t.account?.short || t.account?.name || 'Cash';
            const sign = t.type === 'income' ? '+ ' : t.type === 'transfer' ? '⇄ ' : '− ';

            return (
              <div key={t.id} className="tx-wrap review">
                <div
                  className="transaction"
                  onClick={() => onOpenDrawer(t.id)}
                >
                  <div className="merchant-icon">{t.icon || '•'}</div>
                  <div>
                    <div className="tx-name">{t.name}</div>
                    <div className="tx-meta">
                      {acctName} · {fdate(t)}
                    </div>
                  </div>
                  <span className="category-pill unc">Needs review</span>
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

                <div className="chips">
                  {suggested && (
                    <button
                      type="button"
                      className="chip sug"
                      onClick={() => handleQuickCategorize(t, suggested)}
                    >
                      ✦ {suggested}
                    </button>
                  )}
                  {fallbackOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className="chip"
                      onClick={() => handleQuickCategorize(t, opt)}
                    >
                      {opt}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="chip"
                    onClick={() => onOpenDrawer(t.id)}
                  >
                    More…
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
