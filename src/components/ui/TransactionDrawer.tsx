'use client';

import React from 'react';
import { useUIState } from '@/context/UIContext';
import { Transaction, Category } from '@/types';
import { fmt, fdate, rawSMS } from '@/lib/utils';

interface TransactionDrawerProps {
  transactions: Transaction[];
  categories: Category[];
  onSetCategory: (id: string, category: string) => Promise<void>;
  onCreateRule: (id: string, category: string) => Promise<void>;
}

export const TransactionDrawer: React.FC<TransactionDrawerProps> = ({
  transactions,
  categories,
  onSetCategory,
  onCreateRule,
}) => {
  const { drawerOpen, closeDrawer, drawerTransactionId, showToast } =
    useUIState();

  const transaction = transactions.find((t) => t.id === drawerTransactionId);

  if (!transaction) {
    return (
      <>
        <div
          className={`scrim ${drawerOpen ? 'open' : ''}`}
          onClick={closeDrawer}
        />
        <aside
          className={`drawer ${drawerOpen ? 'open' : ''}`}
          aria-label="Transaction details"
        />
      </>
    );
  }

  const acctName = transaction.account?.short || transaction.account?.name || 'Cash';
  const toAcctName = transaction.toAccount?.short || transaction.toAccount?.name;
  const acctDisplay =
    transaction.type === 'transfer'
      ? `${acctName} → ${toAcctName || '—'}`
      : acctName;

  const sign =
    transaction.type === 'income'
      ? '+ '
      : transaction.type === 'transfer'
      ? ''
      : '− ';

  const amountColor =
    transaction.type === 'income' ? 'credit' : 'debit';

  const catNames = categories.map((c) => c.name);
  if (!catNames.includes('Uncategorized')) {
    catNames.push('Uncategorized');
  }

  const handleCategorySelect = async (cat: string) => {
    try {
      await onSetCategory(transaction.id, cat);
      showToast(`${transaction.name} → ${cat}`, [
        {
          label: 'Undo',
          onClick: () => onSetCategory(transaction.id, transaction.category),
        },
        ...(transaction.category === 'Uncategorized' && transaction.type === 'expense'
          ? [
              {
                label: 'Always do this',
                onClick: () => onCreateRule(transaction.id, cat),
              },
            ]
          : []),
      ]);
    } catch {
      showToast('Failed to update category');
    }
  };

  const handleRuleClick = async () => {
    try {
      await onCreateRule(transaction.id, transaction.category);
      showToast(`Rule saved for “${transaction.name}”.`);
    } catch {
      showToast('Failed to save rule');
    }
  };

  return (
    <>
      <div
        className={`scrim ${drawerOpen ? 'open' : ''}`}
        onClick={closeDrawer}
      />
      <aside
        className={`drawer ${drawerOpen ? 'open' : ''}`}
        aria-label="Transaction details"
      >
        <div id="drawerBody">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'start',
            }}
          >
            <div
              className="merchant-icon"
              style={{ width: '44px', height: '44px', fontSize: '20px' }}
            >
              {transaction.icon || '•'}
            </div>
            <button
              className="icon-btn"
              onClick={closeDrawer}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <h3 style={{ font: '800 20px Manrope', margin: '14px 0 2px' }}>
            {transaction.name}
          </h3>
          <div className="subtle">{transaction.note || ''}</div>

          <div className={`drawer-amt ${amountColor}`}>
            {sign}
            {fmt(transaction.amount)}
          </div>

          <div className="kv">
            <span>Date</span>
            <b>{fdate(transaction)}</b>
          </div>
          <div className="kv">
            <span>Account</span>
            <b>{acctDisplay}</b>
          </div>
          <div className="kv">
            <span>Type</span>
            <b>{transaction.type}</b>
          </div>

          <label className="settings-label" style={{ marginTop: '18px' }}>
            CATEGORY
          </label>
          <div className="chips">
            {catNames.map((c) => (
              <button
                key={c}
                type="button"
                className={`chip ${c === transaction.category ? 'sel' : ''}`}
                onClick={() => handleCategorySelect(c)}
              >
                {c}
              </button>
            ))}
          </div>

          {transaction.type === 'expense' &&
            transaction.category !== 'Uncategorized' && (
              <button
                type="button"
                className="secondary-btn"
                style={{ marginTop: '14px', width: '100%' }}
                onClick={handleRuleClick}
              >
                Always categorize “{transaction.name}” as {transaction.category}
              </button>
            )}

          <label className="settings-label" style={{ marginTop: '20px' }}>
            ORIGINAL MESSAGE (SAMPLE WORDING)
          </label>
          <div className="sms">
            {rawSMS({
              date: transaction.date,
              time: transaction.time,
              account: acctName,
              name: transaction.name,
              amount: transaction.amount,
              type: transaction.type,
            })}
          </div>
        </div>
      </aside>
    </>
  );
};
