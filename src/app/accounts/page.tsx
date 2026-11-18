'use client';

import React, { useState } from 'react';
import { useAccounts } from '@/hooks/useAccounts';
import { useUIState } from '@/context/UIContext';
import { AccountCard } from '@/components/accounts/AccountCard';
import { AccountForm } from '@/components/accounts/AccountForm';
import { Account } from '@/types';
import { generateAccountsCSV } from '@/lib/csv';
import { downloadBlob } from '@/lib/utils';
import { todayISO } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default function AccountsPage() {
  const { accounts, create: createAccount, update: updateAccount, delete: deleteAccount } =
    useAccounts();
  const { showToast } = useUIState();
  const [showForm, setShowForm] = useState(false);

  const handleEdit = async (a: Account) => {
    const newName = window.prompt('Account name', a.name);
    if (newName === null) return;
    const newBal = window.prompt('Current balance (ETB)', String(a.balance));
    if (newBal === null) return;
    const n = Number(newBal);
    if (!newName.trim() || !Number.isFinite(n) || n < 0) {
      showToast('Invalid account details.');
      return;
    }
    try {
      await updateAccount(a.id, { name: newName.trim(), balance: n });
      showToast('Account updated.');
    } catch {
      showToast('Failed to update account');
    }
  };

  const handleRemove = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this demo?`)) return;
    try {
      await deleteAccount(id);
      showToast('Account removed.');
    } catch {
      showToast('Failed to remove account');
    }
  };

  const handleExportAccountsCSV = () => {
    const csvContent = generateAccountsCSV(accounts);
    const dateStr = todayISO().replace(/-/g, '');
    downloadBlob(csvContent, `birrwise-accounts-${dateStr}.csv`, 'text/csv;charset=utf-8');
    showToast('Account summary CSV exported.');
  };

  return (
    <div className="page-view management-page">
      <div className="management-head">
        <div>
          <h2>Accounts</h2>
          <p>
            Manage the places your money lives. Balances and account details in
            this prototype are sample data.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={handleExportAccountsCSV}
          >
            ⇩ Export CSV
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => setShowForm((prev) => !prev)}
          >
            ＋ Add account
          </button>
        </div>
      </div>

      <div className="management-grid">
        <div className="manage-card">
          <h3>Your accounts</h3>
          <p className="help">
            Track bank accounts, mobile wallets and physical cash separately.
          </p>
          <AccountCard
            accounts={accounts}
            onEdit={handleEdit}
            onRemove={handleRemove}
          />
          {showForm && (
            <AccountForm
              onSave={async (data) => {
                await createAccount(data);
                showToast('Account added.');
              }}
              onClose={() => setShowForm(false)}
            />
          )}
        </div>

        <div className="manage-card">
          <h3>Account connections</h3>
          <p className="help">
            Connection status is illustrative until the Android SMS reader and
            backend are connected.
          </p>
          <div className="setting-line">
            <div>
              <strong>Bank of Abyssinia</strong>
              <small>SMS parsing · Last sync today, 10:42 AM</small>
            </div>
            <span className="status-dot" />
          </div>
          <div className="setting-line">
            <div>
              <strong>Commercial Bank of Ethiopia</strong>
              <small>SMS parsing · Last sync Nov 14</small>
            </div>
            <span className="status-dot" />
          </div>
          <div className="setting-line">
            <div>
              <strong>Telebirr</strong>
              <small>SMS parsing · Last sync today, 10:42 AM</small>
            </div>
            <span className="status-dot" />
          </div>
          <div className="setting-line">
            <div>
              <strong>Cash wallet</strong>
              <small>Manual entries only</small>
            </div>
            <span className="status-dot off" />
          </div>
          <div className="data-note">
            🔒 No bank credentials are collected here. A real integration should
            use the Android SMS permission and your own secured backend, not ask
            users to hand over banking passwords.
          </div>
        </div>
      </div>
    </div>
  );
}