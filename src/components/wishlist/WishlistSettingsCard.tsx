'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { useUIState } from '@/context/UIContext';
import { money } from '@/lib/utils';

interface WishlistSettingsCardProps {
  /** Called after a successful save so the wishlist page can refetch. */
  onSaved?: () => void;
}

/**
 * Wishlist settings, shared by the Wishlist page and Settings. Self-saving:
 * it owns its own GET/POST against /api/settings.
 *
 * v1 has manual-only estimates: a late-salary runway (cushion) and a manual
 * income override. There is deliberately no automatic mode yet — one-offs
 * would distort it and the first cycle is incomplete.
 */
export const WishlistSettingsCard: React.FC<WishlistSettingsCardProps> = ({ onSaved }) => {
  const { categories, isLoading: catsLoading } = useCategories();
  const { showToast } = useUIState();

  const [cushion, setCushion] = useState('');
  const [income, setIncome] = useState('');
  const [coolingDays, setCoolingDays] = useState('14');
  const [excluded, setExcluded] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return;
      const d = await res.json();
      setCushion(d.wishlistCushion == null ? '' : String(d.wishlistCushion));
      setIncome(d.wishlistIncomeOverride == null ? '' : String(d.wishlistIncomeOverride));
      setCoolingDays(String(d.wishlistCoolingDays ?? 14));
      setExcluded(Array.isArray(d.wishlistExcludedCategories) ? d.wishlistExcludedCategories : []);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleExcluded = (name: string) => {
    setExcluded((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  const handleSave = async () => {
    // Validate locally for fast feedback; the server revalidates.
    const cushionNum = cushion.trim() === '' ? null : Number(cushion);
    if (cushionNum != null && (!Number.isFinite(cushionNum) || cushionNum < 0)) {
      showToast('Runway must be a number, 0 or more.');
      return;
    }
    const incomeNum = income.trim() === '' ? null : Number(income);
    if (incomeNum != null && (!Number.isFinite(incomeNum) || incomeNum <= 0)) {
      showToast('Average income must be a positive number.');
      return;
    }
    const coolingNum = Number(coolingDays);
    if (!Number.isFinite(coolingNum) || coolingNum < 0 || coolingNum > 365) {
      showToast('Cooling-off days must be between 0 and 365.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wishlistCushion: cushionNum == null ? '' : cushionNum,
          wishlistIncomeOverride: incomeNum == null ? '' : incomeNum,
          wishlistCoolingDays: Math.floor(coolingNum),
          wishlistExcludedCategories: excluded,
        }),
      });
      if (!res.ok) throw new Error();
      showToast('Wishlist settings saved.');
      onSaved?.();
    } catch {
      showToast('Failed to save wishlist settings.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="manage-card" id="wishlist-settings" style={{ marginTop: '0' }}>
      <h3>Wishlist settings</h3>
      <p className="help">
        Estimates are manual for now — no automatic assumptions until a few real
        cycles exist. Clear a field and save to remove that setting.
      </p>

      <div className="field">
        <label htmlFor="wishlistCushion">LATE-SALARY RUNWAY (ETB)</label>
        <input
          id="wishlistCushion"
          className="settings-input"
          inputMode="decimal"
          value={cushion}
          onChange={(e) => setCushion(e.target.value)}
          placeholder="e.g. 9000"
          disabled={!loaded || busy}
        />
        <div className="help" style={{ marginTop: '6px' }}>
          Your salary can arrive up to ~9 days after the cycle boundary, and
          remaining budgets only reserve money through the cycle end. This runway
          covers the late-salary gap and stays untouched — nothing is called
          affordable until it is. An item stays "Ready" only after this amount,
          plus committed budgets, is covered.
        </div>
      </div>

      <div className="field">
        <label htmlFor="wishlistIncomeOverride">AVERAGE INCOME (ETB)</label>
        <input
          id="wishlistIncomeOverride"
          className="settings-input"
          inputMode="decimal"
          value={income}
          onChange={(e) => setIncome(e.target.value)}
          placeholder="e.g. 42000"
          disabled={!loaded || busy}
        />
        <div className="help" style={{ marginTop: '6px' }}>
          Used to estimate cycles-away timelines (surplus after recurring spend).
          Update it whenever your pay changes. Without it, items show progress but
          no timeline.
        </div>
      </div>

      <div className="field">
        <label htmlFor="wishlistCoolingDays">COOLING-OFF PERIOD (DAYS)</label>
        <input
          id="wishlistCoolingDays"
          className="settings-input"
          inputMode="numeric"
          value={coolingDays}
          onChange={(e) => setCoolingDays(e.target.value)}
          placeholder="14"
          disabled={!loaded || busy}
        />
        <div className="help" style={{ marginTop: '6px' }}>
          An item cannot show "Ready" for this many days after it was added —
          the classic impulse-buy filter. Purchase is still possible but needs an
          explicit extra confirmation. Set 0 to disable.
        </div>
      </div>

      <div className="field">
        <label>ONE-OFF CATEGORIES (EXCLUDED FROM TIMELINE ESTIMATE)</label>
        <div className="help" style={{ margin: '0 0 8px' }}>
          Repayments and one-time purchases stay out of the surplus estimate only.
          They still count toward budgets, reports, and the safe-to-spend reserve —
          unspent one-off budgets are committed money this cycle.
        </div>
        {catsLoading ? (
          <div className="help">Loading categories…</div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              maxHeight: '180px',
              overflowY: 'auto',
              padding: '4px 2px',
            }}
          >
            {categories.map((c) => {
              const active = excluded.includes(c.name);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleExcluded(c.name)}
                  aria-pressed={active}
                  className="small-action"
                  style={
                    active
                      ? {
                          background: 'var(--primary, #7255d9)',
                          borderColor: 'var(--primary, #7255d9)',
                          color: '#fff',
                        }
                      : undefined
                  }
                >
                  {c.icon} {c.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        className="primary-btn"
        onClick={handleSave}
        disabled={!loaded || busy}
      >
        {busy ? 'Saving…' : 'Save wishlist settings'}
      </button>
    </div>
  );
};
