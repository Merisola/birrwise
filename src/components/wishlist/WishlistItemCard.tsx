'use client';

import React from 'react';
import { ComputedWishlistItem } from '@/types';
import { money } from '@/lib/utils';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface WishlistItemCardProps {
  item: ComputedWishlistItem;
  onEdit: (item: ComputedWishlistItem) => void;
  onDelete: (item: ComputedWishlistItem) => void;
  onBuy: (item: ComputedWishlistItem) => void;
}

const PRIORITY_LABEL: Record<number, string> = { 1: 'High', 2: 'Normal', 3: 'Low' };

const STATE_PILL: Record<ComputedWishlistItem['state'], { label: (i: ComputedWishlistItem) => string; cls: string }> = {
  ready: { label: () => 'Ready', cls: 'good' },
  cooling: { label: (i) => `Cooling off · ${i.coolingDaysLeft}d left`, cls: 'warning' },
  'budget-blocked': { label: () => 'Budget-blocked', cls: 'warning' },
  saving: {
    label: (i) => (i.cyclesAway != null ? `Saving · ~${i.cyclesAway} cycle${i.cyclesAway === 1 ? '' : 's'}` : 'Saving'),
    cls: 'warning',
  },
  unknown: { label: () => 'Needs an estimate', cls: 'warning' },
};

export const WishlistItemCard: React.FC<WishlistItemCardProps> = ({
  item,
  onEdit,
  onDelete,
  onBuy,
}) => {
  const pill = STATE_PILL[item.state];
  const added = new Date(item.createdAt);
  const addedLabel = added.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="budget-card">
      <div className="budget-card-top">
        <div className="budget-emoji" aria-hidden="true">
          {item.priority === 1 ? '⭐' : '☆'}
        </div>
        <div>
          <div className="budget-card-title">{item.name}</div>
          <div className="budget-card-sub">
            <span className={`status-pill ${pill.cls}`}>{pill.label(item)}</span>{' '}
            <span style={{ color: 'var(--muted)' }}>
              · {PRIORITY_LABEL[item.priority]} priority
            </span>
          </div>
        </div>
        <div className="budget-card-actions">
          <button type="button" className="small-action" onClick={() => onBuy(item)}>
            Buy
          </button>
          <button type="button" className="small-action" onClick={() => onEdit(item)}>
            Edit
          </button>
          <button
            type="button"
            className="small-action danger"
            onClick={() => onDelete(item)}
          >
            Remove
          </button>
        </div>
      </div>

      <div className="budget-card-amounts">
        <strong>{money(item.price)}</strong>
        <span>{item.category || 'No category'}</span>
      </div>

      <ProgressBar
        pct={Math.round(item.progress * 100)}
        color={item.state === 'ready' ? '#2f9e6f' : '#7255d9'}
        variant="budget-track"
      />

      <div className="budget-card-foot">
        <span>{item.reason}</span>
        <span style={{ whiteSpace: 'nowrap' }}>added {addedLabel}</span>
      </div>

      {(item.note || item.url) && (
        <div className="file-meta" style={{ marginTop: '6px' }}>
          {item.note && <div style={{ lineHeight: 1.5 }}>{item.note}</div>}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-link"
              style={{ wordBreak: 'break-all' }}
            >
              {item.url}
            </a>
          )}
        </div>
      )}
    </div>
  );
};
