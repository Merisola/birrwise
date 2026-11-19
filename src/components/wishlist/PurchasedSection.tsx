'use client';

import React, { useState } from 'react';
import { WishlistItem } from '@/types';
import { money } from '@/lib/utils';

interface PurchasedSectionProps {
  items: WishlistItem[];
  onDelete: (item: WishlistItem) => void;
}

/** Collapsible history of bought items — the transaction stays in the ledger. */
export const PurchasedSection: React.FC<PurchasedSectionProps> = ({ items, onDelete }) => {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="manage-card" style={{ marginTop: '0' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>Bought ({items.length})</h3>
          <p className="help" style={{ margin: '4px 0 0' }}>
            Each purchase is a real transaction in your ledger.
          </p>
        </div>
        <button type="button" className="small-action" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide ▴' : 'Show ▾'}
        </button>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                border: '1px solid var(--line)',
                borderRadius: '10px',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '12px' }}>{item.name}</div>
                <div className="file-meta" style={{ margin: '2px 0 0' }}>
                  Bought{' '}
                  {item.purchasedAt
                    ? new Date(item.purchasedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                  {item.category ? ` · ${item.category}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <strong style={{ whiteSpace: 'nowrap' }}>{money(item.price)}</strong>
                <button
                  type="button"
                  className="small-action danger"
                  onClick={() => onDelete(item)}
                  title="Remove from wishlist history (keeps the transaction)"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
