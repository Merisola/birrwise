'use client';

import React, { useEffect, useState } from 'react';
import { ComputedWishlistItem } from '@/types';
import { useAccounts } from '@/hooks/useAccounts';
import { useUIState } from '@/context/UIContext';
import { money } from '@/lib/utils';

interface PurchaseModalProps {
  item: ComputedWishlistItem | null;
  onClose: () => void;
  onPurchase: (input: {
    id: string;
    account: string;
    category?: string | null;
    acknowledgeCooling?: boolean;
  }) => Promise<void>;
}

/**
 * Buy confirmation. The server hard-blocks a purchase when the chosen account
 * is short — and a cooling-off item additionally requires the explicit
 * acknowledgement tick, not just a dialog.
 */
export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  item,
  onClose,
  onPurchase,
}) => {
  const { accounts, isLoading } = useAccounts();
  const { showToast } = useUIState();
  const [account, setAccount] = useState('');
  const [category, setCategory] = useState('');
  const [ackCooling, setAckCooling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const open = item != null;

  useEffect(() => {
    if (item) {
      // Default to the account with the most headroom.
      const best = [...(accounts || [])].sort((a, b) => b.balance - a.balance)[0];
      setAccount(best?.short ?? '');
      setCategory(item.category || '');
      setAckCooling(false);
      setError('');
    }
  }, [item, accounts]);

  if (!open) return <div className="modal-backdrop" aria-hidden="true" />;

  const selected = accounts.find((a) => a.short === account);
  const insufficient = selected != null && selected.balance + 1e-9 < item.price;
  const cooling = item.state === 'cooling';
  const blockedReason =
    item.state === 'budget-blocked'
      ? item.reason
      : item.budgetConflict
        ? item.reason
        : null;
  const buyDisabled = busy || !account || insufficient || (cooling && !ackCooling);

  const handleBuy = async () => {
    setBusy(true);
    setError('');
    try {
      await onPurchase({
        id: item.id,
        account,
        category: category || null,
        acknowledgeCooling: cooling ? ackCooling : undefined,
      });
      showToast(`Bought ${item.name} for ${money(item.price)}.`);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to complete the purchase.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop show"
      role="dialog"
      aria-modal="true"
      aria-label={`Buy ${item.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal">
        <h3>Buy {item.name}</h3>
        <p>
          {money(item.price)} · creates an expense and marks the item bought, all
          in one step.
        </p>

        <div className="field">
          <label htmlFor="purchaseAccount">ACCOUNT</label>
          <select
            id="purchaseAccount"
            className="settings-input"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            disabled={busy || isLoading}
          >
            {(accounts || []).map((a) => (
              <option key={a.id} value={a.short}>
                {a.short} — {money(a.balance)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="purchaseCategory">CATEGORY</label>
          <input
            id="purchaseCategory"
            className="settings-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Uncategorized"
            disabled={busy}
          />
        </div>

        {insufficient && (
          <div
            style={{
              margin: '10px 0',
              padding: '10px 12px',
              border: '1px solid var(--red)',
              borderRadius: '10px',
              color: 'var(--red)',
              fontSize: '11px',
              lineHeight: 1.5,
              fontWeight: 600,
            }}
          >
            {account} has only {money(selected.balance)} — this item costs{' '}
            {money(item.price)}. Choose another account or add funds.
          </div>
        )}

        {blockedReason && !insufficient && (
          <div
            style={{
              margin: '10px 0',
              padding: '10px 12px',
              border: '1px solid var(--amber)',
              borderRadius: '10px',
              color: 'var(--amber)',
              fontSize: '11px',
              lineHeight: 1.5,
              fontWeight: 600,
            }}
          >
            ⚠ {blockedReason}
          </div>
        )}

        {cooling && !insufficient && (
          <label
            style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
              margin: '12px 0',
              padding: '10px 12px',
              border: '1px solid var(--amber)',
              borderRadius: '10px',
              fontSize: '11px',
              lineHeight: 1.5,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={ackCooling}
              onChange={(e) => setAckCooling(e.target.checked)}
              disabled={busy}
              style={{ marginTop: '2px' }}
            />
            <span>
              I know this item is still cooling off —{' '}
              <strong>
                {item.coolingDaysLeft} day{item.coolingDaysLeft === 1 ? '' : 's'} left
              </strong>
              , and I want to buy it anyway.
            </span>
          </label>
        )}

        {error && (
          <div
            style={{
              margin: '10px 0',
              padding: '10px 12px',
              border: '1px solid var(--red)',
              borderRadius: '10px',
              color: 'var(--red)',
              fontSize: '11px',
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={handleBuy}
            disabled={buyDisabled}
          >
            {busy ? 'Buying…' : `Buy · ${money(item.price)}`}
          </button>
        </div>
      </div>
    </div>
  );
};
