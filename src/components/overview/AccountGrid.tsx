'use client';

import React from 'react';
import { Account } from '@/types';
import { cls, money } from '@/lib/utils';
import { useUIState } from '@/context/UIContext';

interface AccountGridProps {
  accounts: Account[];
}

export const AccountGrid: React.FC<AccountGridProps> = ({ accounts }) => {
  const { filterAccount } = useUIState();

  return (
    <section className="account-grid" id="accountGrid">
      {accounts.map((a) => (
        <div
          key={a.id}
          className="account"
          onClick={() => filterAccount(a.short)}
        >
          <div className="account-top">
            <div className={`bank-icon ${cls(a.short)}`}>{a.icon}</div>
            <span className="account-name">{a.type}</span>
          </div>
          <div className="account-amount sens">{money(a.balance)}</div>
          <div className="account-meta">{a.name}</div>
        </div>
      ))}
    </section>
  );
};
