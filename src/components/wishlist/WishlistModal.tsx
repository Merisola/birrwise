'use client';

import React, { useEffect, useState } from 'react';
import { ComputedWishlistItem, CreateWishlistInput } from '@/types';
import { useCategories } from '@/hooks/useCategories';

interface WishlistModalProps {
  open: boolean;
  editing: ComputedWishlistItem | null;
  onClose: () => void;
  onSave: (data: CreateWishlistInput) => Promise<void>;
}

const PRIORITIES = [
  { value: 1, label: 'High' },
  { value: 2, label: 'Normal' },
  { value: 3, label: 'Low' },
] as const;

export const WishlistModal: React.FC<WishlistModalProps> = ({
  open,
  editing,
  onClose,
  onSave,
}) => {
  const { categories, isLoading } = useCategories();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [priority, setPriority] = useState<number>(2);
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '');
      setPrice(editing ? String(editing.price) : '');
      setPriority(editing?.priority ?? 2);
      setCategory(editing?.category ?? '');
      setNote(editing?.note ?? '');
      setUrl(editing?.url ?? '');
      setError('');
    }
  }, [open, editing]);

  if (!open) return <div className="modal-backdrop" aria-hidden="true" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(price);
    if (!name.trim()) {
      setError('Give it a name.');
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Price must be a positive number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({
        name: name.trim(),
        price: Math.round(parsed * 100) / 100,
        priority,
        category: category || null,
        note: note.trim() || null,
        url: url.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop show"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? 'Edit wishlist item' : 'Add to wishlist'}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <form className="modal" onSubmit={handleSubmit}>
        <h3>{editing ? 'Edit wish' : 'Add a wish'}</h3>
        <p>Price is rounded to two decimals. Cooling-off starts when the item is created.</p>

        <div className="field">
          <label htmlFor="wishName">NAME</label>
          <input
            id="wishName"
            className="settings-input"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sony WH-1000XM5"
            maxLength={120}
            disabled={busy}
          />
        </div>

        <div className="field" style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="wishPrice">PRICE (ETB)</label>
            <input
              id="wishPrice"
              className="settings-input"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              disabled={busy}
            />
          </div>
          <div style={{ width: '140px' }}>
            <label htmlFor="wishPriority">PRIORITY</label>
            <select
              id="wishPriority"
              className="settings-input"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              disabled={busy}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="wishCategory">CATEGORY (OPTIONAL)</label>
          <select
            id="wishCategory"
            className="settings-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={busy || isLoading}
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
          <div className="help" style={{ marginTop: '6px' }}>
            If the item’s category has a budget, the wishlist checks that budget’s
            headroom before calling it affordable.
          </div>
        </div>

        <div className="field">
          <label htmlFor="wishNote">NOTE (OPTIONAL)</label>
          <textarea
            id="wishNote"
            className="settings-input"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            disabled={busy}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <div className="field">
          <label htmlFor="wishUrl">LINK (OPTIONAL)</label>
          <input
            id="wishUrl"
            className="settings-input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            maxLength={500}
            disabled={busy}
          />
        </div>

        {error && (
          <div
            style={{
              margin: '10px 0',
              padding: '10px 12px',
              border: '1px solid var(--red)',
              borderRadius: '10px',
              color: 'var(--red)',
              fontSize: '11px',
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
          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add to wishlist'}
          </button>
        </div>
      </form>
    </div>
  );
};
