'use client';

import React, { useState, useEffect } from 'react';
import { useUIState } from '@/context/UIContext';
import { useCategories } from '@/hooks/useCategories';
import { nowT } from '@/lib/utils';
import { todayISO } from '@/lib/dates';
import { Account } from '@/types';
import { buildCategoryGroups } from '@/lib/categories';

interface CashModalProps {
  onSaveCash: (data: {
    date: string;
    time: string;
    account: string;
    name: string;
    category: string;
    type: 'expense';
    amount: number;
    icon: string;
    note: string;
  }) => Promise<{ id: string } | undefined>;
  onUndo?: (id: string) => Promise<void>;
  cashAccount?: Account;
}

export const CashModal: React.FC<CashModalProps> = ({
  onSaveCash,
  onUndo,
  cashAccount,
}) => {
  const { cashModalOpen, closeCashModal, showToast } = useUIState();
  const { categories: allCategories } = useCategories();
  const cashCategories = allCategories.filter(
    (c) => !['Income', 'Internal transfer'].includes(c.name)
  );
  const groups = buildCategoryGroups(cashCategories);
  const firstExpense = groups[0]?.main.name || 'Food & groceries';

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food & groceries');
  const [date, setDate] = useState(() => todayISO());

  useEffect(() => {
    if (cashModalOpen) {
      setDate(todayISO());
      setCategory((prev) =>
        cashCategories.some((c) => c.name === prev) ? prev : firstExpense
      );
      setTimeout(() => {
        document.getElementById('cashAmountInput')?.focus();
      }, 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashModalOpen, firstExpense]);

  if (!cashModalOpen) return null;

  const cashBalance = cashAccount ? cashAccount.balance : 2500;

  const handleSave = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0 || !description.trim()) {
      showToast('Add a valid amount and description.');
      return;
    }
    if (numAmount > cashBalance) {
      showToast('That is more than your tracked cash balance.');
      return;
    }

    try {
      const saved = await onSaveCash({
        date: date || todayISO(),
        time: nowT(),
        account: 'Cash',
        name: description.trim(),
        category,
        type: 'expense',
        amount: numAmount,
        icon: '💵',
        note: 'Cash purchase',
      });

      closeCashModal();
      setAmount('');
      setDescription('');

      if (saved && onUndo) {
        showToast('Cash expense saved.', [
          {
            label: 'Undo',
            onClick: () => onUndo(saved.id),
          },
        ]);
      } else {
        showToast('Cash expense saved.');
      }
    } catch {
      showToast('Error saving cash expense.');
    }
  };

  return (
    <div
      className={`modal-backdrop ${cashModalOpen ? 'show' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCashModal();
      }}
    >
      <div className="modal">
        <h3>Record a cash expense</h3>
        <p>Keep your physical cash balance up to date.</p>

        <div className="field">
          <label>AMOUNT (ETB)</label>
          <input
            id="cashAmountInput"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="e.g. 180.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="chips" style={{ marginTop: '8px' }}>
            {[15, 50, 70, 100, 200].map((preset) => (
              <button
                key={preset}
                type="button"
                className="chip"
                onClick={() => setAmount(String(preset))}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>WHAT DID YOU SPEND ON?</label>
          <input
            placeholder="e.g. Lunch"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <label>CATEGORY</label>
          <div className="chip-groups" id="cashCats">
            {groups.map(({ main, subs }) => (
              <div key={main.id} className="chip-group">
                <span className="chip-group-label">
                  {main.icon} {main.name}
                </span>
                <div className="chips">
                  {[main, ...subs].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`chip ${category === cat.name ? 'sel' : ''}`}
                      onClick={() => setCategory(cat.name)}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="field">
          <label>DATE</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={todayISO()}
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={closeCashModal}>
            Cancel
          </button>
          <button type="button" className="primary-btn" onClick={handleSave}>
            Save expense
          </button>
        </div>
      </div>
    </div>
  );
};