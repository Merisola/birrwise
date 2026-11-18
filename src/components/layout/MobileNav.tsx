'use client';

import React from 'react';
import { useUIState } from '@/context/UIContext';

export const MobileNav: React.FC = () => {
  const { currentPage, setPage, openCashModal } = useUIState();

  return (
    <nav className="mobile-nav">
      <button
        className={currentPage === 'Overview' ? 'active' : ''}
        onClick={() => setPage('Overview')}
      >
        <span>◫</span>Home
      </button>
      <button
        className={currentPage === 'Transactions' ? 'active' : ''}
        onClick={() => setPage('Transactions')}
      >
        <span>⇄</span>Activity
      </button>
      <button onClick={openCashModal}>
        <span>＋</span>Add cash
      </button>
      <button
        className={currentPage === 'Budgets' ? 'active' : ''}
        onClick={() => setPage('Budgets')}
      >
        <span>▥</span>Budgets
      </button>
      <button
        className={currentPage === 'Accounts' ? 'active' : ''}
        onClick={() => setPage('Accounts')}
      >
        <span>▣</span>Accounts
      </button>
    </nav>
  );
};
