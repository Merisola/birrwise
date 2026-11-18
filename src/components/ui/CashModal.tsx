'use client';

import React, { useState, useEffect } from 'react';
import { useUIState } from '@/context/UIContext';
import { nowT } from '@/lib/utils';
import { todayISO } from '@/lib/dates';
import { Account } from '@/types';

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
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food & groceries');
  const [date, setDate] = useState(() => todayISO());

  useEffect(() => {
    if (cashModalOpen) {
      setDate(todayISO());
      setTimeout(() => {
        document.getElementById('cashAmountInput')?.focus();
      }, 60);
    }
  }, [cashModalOpen]);

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

  const categories = [
    'Food & groceries',
    'Transport',
    'Coffee & snacks',
    'Bills',
    'Personal',
  ];

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
          <div className="chips" id="cashCats">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`chip ${category === cat ? 'sel' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
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