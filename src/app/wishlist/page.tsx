'use client';

import React, { useMemo, useState } from 'react';
import { useUIState } from '@/context/UIContext';
import { useWishlist } from '@/hooks/useWishlist';
import { ComputedWishlistItem, CreateWishlistInput } from '@/types';
import { SafeToSpendCard } from '@/components/wishlist/SafeToSpendCard';
import { SuggestionCard } from '@/components/wishlist/SuggestionCard';
import { WishlistItemCard } from '@/components/wishlist/WishlistItemCard';
import { WishlistModal } from '@/components/wishlist/WishlistModal';
import { PurchaseModal } from '@/components/wishlist/PurchaseModal';
import { WishlistSettingsCard } from '@/components/wishlist/WishlistSettingsCard';
import { PurchasedSection } from '@/components/wishlist/PurchasedSection';
import { ReloadButton } from '@/components/layout/ReloadButton';

export default function WishlistPage() {
  const { showToast } = useUIState();
  const {
    items,
    purchased,
    summary,
    suggestion,
    isLoading,
    error,
    refetch,
    create,
    update,
    remove,
    purchase,
  } = useWishlist();

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ComputedWishlistItem | null>(null);
  const [buyTarget, setBuyTarget] = useState<ComputedWishlistItem | null>(null);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const stateOrder = { ready: 0, saving: 1, 'budget-blocked': 2, cooling: 3, unknown: 4 } as const;
        const s = stateOrder[a.state] - stateOrder[b.state];
        if (s !== 0) return s;
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.cyclesAway != null && b.cyclesAway != null ? a.cyclesAway - b.cyclesAway : 0;
      }),
    [items]
  );

  const handleDelete = async (item: { id: string; name: string; status: string }) => {
    const message =
      item.status === 'purchased'
        ? `Remove "${item.name}" from bought history? The purchase transaction stays in your ledger.`
        : `Remove "${item.name}" from your wishlist?`;
    if (!window.confirm(message)) return;
    try {
      await remove(item.id);
      showToast('Removed from wishlist.');
    } catch {
      showToast('Failed to remove item.');
    }
  };

  const handleSave = async (data: CreateWishlistInput) => {
    if (editing) {
      await update(editing.id, data);
      showToast('Wishlist item updated.');
    } else {
      await create(data);
      showToast(`${data.name} added to your wishlist.`);
    }
    setEditing(null);
    setAddOpen(false);
  };

  const scrollToSettings = () => {
    document.getElementById('wishlist-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (isLoading && !summary) {
    return (
      <div className="page-view">
        <div className="empty" style={{ padding: '60px' }}>Loading wishlist…</div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="page-view">
        <div className="empty" style={{ padding: '60px' }}>
          Failed to load wishlist.{' '}
          <button className="text-link" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-view">
      <div className="budget-page-top">
        <div>
          <h2>Wishlist</h2>
          <p>
            Things you want, not things you must have. Birrwise tracks what you
            can <em>actually</em> afford — balance, budgets and spending included.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <ReloadButton />
          <button type="button" className="primary-btn" onClick={() => { setEditing(null); setAddOpen(true); }}>
            ＋ Add wish
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {summary && <SafeToSpendCard summary={summary} />}

        {suggestion && summary && (
          <SuggestionCard
            suggestion={suggestion}
            items={items}
            onBuy={(id) => {
              const target = items.find((i) => i.id === id);
              if (target) setBuyTarget(target);
            }}
            onSetCushion={scrollToSettings}
            onAddItem={() => { setEditing(null); setAddOpen(true); }}
          />
        )}

        <section>
          <div className="panel-head" style={{ marginBottom: '10px' }}>
            <div>
              <h3 style={{ font: "700 13px 'Manrope', sans-serif", margin: 0 }}>
                On the list ({items.length})
              </h3>
              <div className="subtle" style={{ marginTop: '4px' }}>
                Ready items fit after runway and remaining budgets. Cooling items wait out the impulse window.
              </div>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="empty-state">
              Nothing here yet. Add the thing you keep thinking about — with its real price.
            </div>
          ) : (
            <div className="budget-list">
              {sortedItems.map((item) => (
                <WishlistItemCard
                  key={item.id}
                  item={item}
                  onEdit={(i) => { setEditing(i); setAddOpen(true); }}
                  onDelete={handleDelete}
                  onBuy={(i) => setBuyTarget(i)}
                />
              ))}
            </div>
          )}
        </section>

        <PurchasedSection
          items={purchased}
          onDelete={handleDelete}
        />

        <WishlistSettingsCard onSaved={refetch} />

        <p className="help" style={{ margin: '2px 4px 0' }}>
          Rent and recurring obligations (rent, repayments, subscriptions) must be
          logged as <strong>expenses in their category</strong> — not as transfers —
          or the budget reservation will not clear and items will look more
          affordable than they are. Bought items are normal expenses: they count
          toward budgets, categories and account balances.
        </p>
      </div>

      <WishlistModal
        open={addOpen}
        editing={editing}
        onClose={() => { setAddOpen(false); setEditing(null); }}
        onSave={handleSave}
      />
      <PurchaseModal
        item={buyTarget}
        onClose={() => setBuyTarget(null)}
        onPurchase={async (input) => {
          await purchase(input.id, {
            account: input.account,
            category: input.category,
            acknowledgeCooling: input.acknowledgeCooling,
          });
          setBuyTarget(null);
        }}
      />
    </div>
  );
}
