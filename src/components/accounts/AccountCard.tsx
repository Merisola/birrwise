'use client';

import React from 'react';
import { Account } from '@/types';
import { cls, money } from '@/lib/utils';

interface AccountCardProps {
  accounts: Account[];
  onEdit: (acc: Account) => void;
  onRemove: (id: string, name: string) => void;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  accounts,
  onEdit,
  onRemove,
}) => {
  return (
    <div id="accountList">
      {accounts.map((a) => (
        <div key={a.id} className="manage-row">
          <div className={`bank-icon ${cls(a.short)}`}>{a.icon}</div>
          <div className="manage-row-main">
            <strong>{a.name}</strong>
            <small>
              {a.type} · {a.short}
            </small>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong style={{ font: '700 12px Manrope' }}>
              {money(a.balance)}
            </strong>
            <div className="manage-row-actions" style={{ marginTop: '6px' }}>
              <button
                type="button"
                className="small-action"
                onClick={() => onEdit(a)}
              >
                Edit
              </button>
              <button
                type="button"
                className="small-action danger"
                onClick={() => onRemove(a.id, a.name)}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
