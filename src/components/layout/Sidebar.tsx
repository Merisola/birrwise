'use client';

import React from 'react';
import { useUIState } from '@/context/UIContext';
import { PageName } from '@/types';
import { useSignOut } from '@/hooks/useSignOut';

interface SidebarProps {
  reviewCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ reviewCount = 0 }) => {
  const { currentPage, setPage } = useUIState();
  const { signOut, signingOut } = useSignOut();

  const navItems: { page: PageName; icon: string; count?: number }[] = [
    { page: 'Overview', icon: '◫' },
    { page: 'Transactions', icon: '⇄', count: reviewCount },
    { page: 'Budgets', icon: '▥' },
    { page: 'Accounts', icon: '▣' },
  ];

  const manageItems: { page: PageName; icon: string }[] = [
    { page: 'Categories', icon: '◈' },
    { page: 'Import & export', icon: '⇧' },
    { page: 'Settings', icon: '⚙' },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">b.</div> birrwise
      </div>
      <div className="nav-label">Workspace</div>
      <nav className="nav">
        {navItems.map((item) => (
          <button
            key={item.page}
            className={currentPage === item.page ? 'active' : ''}
            onClick={() => setPage(item.page)}
          >
            <span className="ico">{item.icon}</span> {item.page}
            {item.count !== undefined && item.count > 0 && (
              <span className="count">{item.count}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="nav-label">Manage</div>
      <nav className="nav">
        {manageItems.map((item) => (
          <button
            key={item.page}
            className={currentPage === item.page ? 'active' : ''}
            onClick={() => setPage(item.page)}
          >
            <span className="ico">{item.icon}</span> {item.page === 'Categories' ? 'Categories & rules' : item.page}
          </button>
        ))}
      </nav>
      <div className="side-bottom">
        <div className="privacy">
          <strong>🔒 Your money. Your data.</strong>
          <p>
            Personal finance data stays in your private workspace. No ads, no
            selling your data.
          </p>
        </div>
        <div className="profile">
          <div className="avatar">M</div>
          <div>
            <strong>My workspace</strong>
            <small>Personal account</small>
          </div>
          <button
            className="signout-btn"
            onClick={signOut}
            disabled={signingOut}
            title="Sign out"
            aria-label="Sign out"
          >
            {signingOut ? '…' : '⏻'}
          </button>
        </div>
      </div>
    </aside>
  );
};
