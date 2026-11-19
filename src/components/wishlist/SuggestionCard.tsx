'use client';

import React from 'react';
import { ComputedWishlistItem, WishlistSuggestion } from '@/types';
import { money } from '@/lib/utils';

interface SuggestionCardProps {
  suggestion: WishlistSuggestion;
  items: ComputedWishlistItem[];
  onBuy: (itemId: string) => void;
  onSetCushion: () => void;
  onAddItem: () => void;
}

/**
 * The single recommendation. Never a recommendation engine with ten answers —
 * one answer, with the numbers behind it.
 */
export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  items,
  onBuy,
  onSetCushion,
  onAddItem,
}) => {
  const findItem = (id: string) => items.find((i) => i.id === id);

  let tone = 'default';
  let title = '';
  let body = '';
  let action: React.ReactNode = null;

  switch (suggestion.kind) {
    case 'set-cushion':
      tone = 'warn';
      title = 'Set your late-salary runway first';
      body =
        'Birrwise will not tell you what is affordable until you set the runway — the amount that covers spending until your (possibly late) salary lands. Set it below and suggestions unlock instantly.';
      action = (
        <button type="button" className="primary-btn" onClick={onSetCushion}>
          Set runway ↓
        </button>
      );
      break;
    case 'empty':
      tone = 'default';
      title = 'Your wishlist is empty';
      body =
        'Write down the things you want — prices included. Birrwise will tell you when you can actually afford them, based on your balance, budgets and spending.';
      action = (
        <button type="button" className="primary-btn" onClick={onAddItem}>
          ＋ Add your first wish
        </button>
      );
      break;
    case 'ready': {
      const item = findItem(suggestion.itemId);
      if (!item) {
        tone = 'none';
        title = 'No suggestion right now';
        body = 'The top pick just changed — reload to see the latest.';
        break;
      }
      tone = 'good';
      title = `You can afford ${item.name}`;
      body = `${money(item.price)} · ${item.reason}`;
      action = (
        <button type="button" className="primary-btn" onClick={() => onBuy(item.id)}>
          Buy {money(item.price)}
        </button>
      );
      break;
    }
    case 'hold':
      tone = 'warn';
      title = 'Hold this cycle';
      body = suggestion.message;
      break;
    case 'next-up': {
      const item = findItem(suggestion.itemId);
      tone = 'default';
      title = item ? `Next up: ${item.name}` : 'Next up';
      body =
        suggestion.cyclesAway == null
          ? 'Timeline unlocks once your average income is set.'
          : `About ${suggestion.cyclesAway} cycle${suggestion.cyclesAway === 1 ? '' : 's'} away${item ? ` (${money(item.price)})` : ''}. Keep the runway untouched and it will surface as Ready.`;
      action =
        item && item.cyclesAway != null ? (
          <button type="button" className="secondary-btn" onClick={() => onBuy(item.id)}>
            Buy early
          </button>
        ) : null;
      break;
    }
    case 'cooling': {
      const item = findItem(suggestion.itemId);
      tone = 'default';
      title = item ? `${item.name} is cooling off` : 'Cooling off';
      body = `${suggestion.daysLeft} day${suggestion.daysLeft === 1 ? '' : 's'} left in the cooling-off period. Wants survive the wait — impulse buys rarely do. You can still buy it, but you will need to confirm deliberately.`;
      action =
        item != null ? (
          <button type="button" className="secondary-btn" onClick={() => onBuy(item.id)}>
            Buy anyway
          </button>
        ) : null;
      break;
    }
    case 'none':
      tone = 'default';
      title = 'No suggestion yet';
      body = suggestion.message;
      break;
  }

  const border =
    tone === 'good'
      ? 'var(--green, #2f9e6f)'
      : tone === 'warn'
        ? 'var(--amber)'
        : 'var(--line)';

  return (
    <div
      className="manage-card"
      style={{ marginTop: '0', borderLeft: `3px solid ${border}` }}
      aria-live="polite"
    >
      <h3 style={{ marginBottom: '4px' }}>{title}</h3>
      <p className="help" style={{ marginBottom: action ? '10px' : '0' }}>
        {body}
      </p>
      {action && <div style={{ display: 'flex', gap: '8px' }}>{action}</div>}
    </div>
  );
};
