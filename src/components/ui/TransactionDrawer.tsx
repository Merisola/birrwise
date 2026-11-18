'use client';

import React, { useState, useEffect } from 'react';
import { useUIState } from '@/context/UIContext';
import { Transaction, Category } from '@/types';
import { fmt, fdate, rawSMS } from '@/lib/utils';
import { buildCategoryGroups, categoryLabel } from '@/lib/categories';

interface TransactionDrawerProps {
  transactions: Transaction[];
  categories: Category[];
  onSetCategory: (id: string, category: string) => Promise<void>;
  onCreateRule: (id: string, category: string) => Promise<void>;
  onSetLabel: (id: string, label: string | null) => Promise<void>;
}

export const TransactionDrawer: React.FC<TransactionDrawerProps> = ({
  transactions,
  categories,
  onSetCategory,
  onCreateRule,
  onSetLabel,
}) => {
  const { drawerOpen, closeDrawer, drawerTransactionId, showToast } =
    useUIState();

  const transaction = transactions.find((t) => t.id === drawerTransactionId);

  const txId = transaction?.id ?? '';
  const txLabel = transaction?.label ?? '';
  const [labelDraft, setLabelDraft] = useState(txLabel);

  useEffect(() => {
    setLabelDraft(txLabel);
  }, [txId, txLabel]);

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
  const chipCategories = [...categories];
  if (!catNames.includes('Uncategorized')) {
    chipCategories.push({
      id: 'virtual-uncategorized',
      name: 'Uncategorized',
      icon: '◉',
      createdAt: '',
      updatedAt: '',
    });
  }
  const chipGroups = buildCategoryGroups(chipCategories);

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

  const handleLabelSave = async (draft: string = labelDraft) => {
    const trimmed = draft.trim();
    const current = (transaction.label ?? '').trim();
    if (trimmed === current) {
      return; // silent no-op (blur fires when switching to chips etc.)
    }
    try {
      await onSetLabel(transaction.id, trimmed || null);
      showToast(trimmed ? `🏷 ${trimmed}` : 'Label cleared.', [
        {
          label: 'Undo',
          onClick: () => onSetLabel(transaction.id, current || null),
        },
      ]);
    } catch {
      setLabelDraft(current);
      showToast('Failed to save label');
    }
  };

  const handleLabelClear = async () => {
    setLabelDraft('');
    await handleLabelSave('');
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

          <div className="drawer-label">
            <div className="settings-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span>🏷 YOUR LABEL</span>
              <span className="drawer-label-hint">optional · Enter ↵ saves · Esc reverts</span>
            </div>
            <div className="drawer-label-row">
              <input
                className="drawer-label-input"
                value={labelDraft}
                maxLength={140}
                placeholder="e.g. for Joe & Beti"
                aria-label="Your label"
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleLabelSave();
                  if (e.key === 'Escape') setLabelDraft(transaction.label ?? '');
                }}
                onBlur={() => handleLabelSave()}
              />
              {transaction.label && (
                <button
                  type="button"
                  className="small-action danger"
                  onMouseDown={(e) => e.preventDefault()} // keep input focus so blur-save doesn't fire first
                  onClick={handleLabelClear}
                  title="Clear label"
                  aria-label="Clear label"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

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
          <div className="kv">
            <span>Category</span>
            <b>{categoryLabel(transaction)}</b>
          </div>

          <label className="settings-label" style={{ marginTop: '18px' }}>
            CATEGORY
          </label>
          <div className="chip-groups">
            {chipGroups.map(({ main, subs }) => (
              <div key={main.id} className="chip-group">
                {subs.length > 0 && (
                  <span className="chip-group-label">
                    {main.icon} {main.name}
                  </span>
                )}
                <div className="chips">
                  {[main, ...subs].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`chip ${
                        cat.name === transaction.category ? 'sel' : ''
                      }`}
                      onClick={() => handleCategorySelect(cat.name)}
                    >
                      {subs.length > 0 && cat.id !== main.id ? '· ' : ''}
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
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
