'use client';

import React, { useState } from 'react';
import { CreateAccountInput } from '@/types';

interface AccountFormProps {
  onSave: (data: CreateAccountInput) => Promise<void>;
  onClose: () => void;
}

export const AccountForm: React.FC<AccountFormProps> = ({ onSave, onClose }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('Bank account');
  const [balance, setBalance] = useState('');

  const handleSave = async () => {
    if (!name.trim()) return;
    await onSave({
      name: name.trim(),
      type,
      balance: Number(balance) || 0,
    });
    setName('');
    setBalance('');
    onClose();
  };

  return (
    <div className="inline-form" id="accountForm">
      <div className="form-row">
        <div className="field">
          <label>ACCOUNT NAME</label>
          <input
            id="newAccountName"
            placeholder="e.g. Dashen Bank"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label>TYPE</label>
          <select
            id="newAccountType"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option>Bank account</option>
            <option>Mobile wallet</option>
            <option>Cash wallet</option>
            <option>Other</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>OPENING BALANCE (ETB)</label>
          <input
            id="newAccountBalance"
            type="number"
            min="0"
            placeholder="0.00"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
        </div>
        <button type="button" className="primary-btn" onClick={handleSave}>
          Save account
        </button>
      </div>
    </div>
  );
};
