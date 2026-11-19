'use client';

import React, { useState } from 'react';
import { WishlistSummary } from '@/types';
import { fmt, money } from '@/lib/utils';

interface SafeToSpendCardProps {
  summary: WishlistSummary;
}

/**
 * The honest top line: safeToSpend = liquid − late-salary runway − the
 * unspent part of every budget this cycle. Everything below it is committed
 * money. Expandable breakdown so the number is never a black box.
 */
export const SafeToSpendCard: React.FC<SafeToSpendCardProps> = ({ summary }) => {
  const [showDetails, setShowDetails] = useState(false);
  const {
    liquidBalance,
    cushion,
    runwayDays,
    remainingBudgets,
    remainingBudgetBreakdown,
    safeToSpend,
    incomeOverride,
    surplus,
    surplusSource,
    surplusDetail,
    cyclesUsed,
    budgetPaceAhead,
    currentCycleLabel,
    firstTransactionDate,
  } = summary;

  return (
    <div className="manage-card" style={{ marginTop: '0' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '14px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 style={{ marginBottom: '2px' }}>Safe to spend right now</h3>
          <p className="help" style={{ margin: 0 }}>
            Liquid balance minus your late-salary runway and everything already
            committed in this cycle's budgets ({currentCycleLabel}).
          </p>
        </div>
        {safeToSpend != null && (
          <div style={{ font: "800 26px 'Manrope', sans-serif", whiteSpace: 'nowrap' }}>
            {fmt(safeToSpend)}
          </div>
        )}
      </div>

      <div
        className="budget-summary-grid"
        style={{ marginTop: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
      >
        <div className="budget-summary">
          <span>Liquid balance</span>
          <strong>{money(liquidBalance)}</strong>
          <small>All accounts</small>
        </div>
        <div className="budget-summary">
          <span>Late-salary runway</span>
          <strong>{cushion != null ? money(cushion) : '—'}</strong>
          <small>
            {cushion != null
              ? runwayDays != null
                ? `about ${runwayDays} day${runwayDays === 1 ? '' : 's'} of recurring spending`
                : 'Set average income to see days of coverage'
              : 'Not set — suggestions paused'}
          </small>
        </div>
        <div className="budget-summary">
          <span>Remaining budgets</span>
          <strong>{money(remainingBudgets)}</strong>
          <small>Committed through end of this cycle</small>
        </div>
        <div className="budget-summary">
          <span>Average income</span>
          <strong>{incomeOverride != null ? money(incomeOverride) : '—'}</strong>
          <small>
            {incomeOverride != null
              ? 'Manual override — update when pay changes'
              : 'Set to unlock cycles-away estimates'}
          </small>
        </div>
      </div>

      {surplus != null && (
        <div className="file-meta" style={{ marginTop: '10px' }}>
          Average surplus per cycle: <strong>{fmt(surplus)}</strong> ·{' '}
          {surplusSource === 'cycles'
            ? `from your last ${cyclesUsed} eligible cycle${cyclesUsed === 1 ? '' : 's'}`
            : 'pre-history estimate from budget limits'}
          {budgetPaceAhead && (
            <span style={{ color: 'var(--amber)' }}>
              {' '}
              · budget pace is ahead — purchases are on hold
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        className="text-link"
        style={{ marginTop: '8px' }}
        onClick={() => setShowDetails((v) => !v)}
        aria-expanded={showDetails}
      >
        {showDetails ? 'Hide the math ▴' : 'How this is calculated ▾'}
      </button>

      {showDetails && (
        <div style={{ marginTop: '10px', fontSize: '11px', lineHeight: 1.6 }}>
          <div className="file-meta">
            {fmt(liquidBalance)} liquid
            {'  −  '}
            {cushion != null ? fmt(cushion) : 'ETB 0.00'} runway
            {'  −  '}
            {fmt(remainingBudgets)} remaining budgets
            {'  =  '}
            <strong>
              {safeToSpend != null ? fmt(safeToSpend) : '—'} safe to spend
            </strong>
          </div>
          {remainingBudgetBreakdown.length > 0 && (
            <>
              <div className="help" style={{ margin: '10px 0 6px' }}>
                What is still reserved (unspent part of each budget this cycle):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {remainingBudgetBreakdown.map((b) => (
                  <div
                    key={b.category}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}
                  >
                    <span>
                      {b.icon} {b.category}
                      {b.remaining === 0 && b.spent > b.limit && (
                        <span style={{ color: 'var(--red)' }}> (over limit)</span>
                      )}
                    </span>
                    <span className="file-meta" style={{ margin: 0 }}>
                      {money(b.spent)} spent of {money(b.limit)} → {money(b.remaining)} reserved
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="help" style={{ marginTop: '10px' }}>
            {surplusDetail}
            {firstTransactionDate && (
              <>
                {' '}
                Cycles that started before your first entry ({firstTransactionDate})
                are ignored — your history did not cover them fully.
              </>
            )}
            {' '}
            One-off categories are excluded from the surplus estimate only; their
            unspent budgets stay reserved above.
          </p>
          <p
            className="help"
            style={{
              marginTop: '8px',
              padding: '8px 10px',
              border: '1px solid var(--amber)',
              borderRadius: '8px',
              color: 'var(--amber)',
              fontWeight: 600,
            }}
          >
            Rent and repayments must be logged as expenses in their category
            (not as transfers), or the budget reservation will never clear.
          </p>
        </div>
      )}
    </div>
  );
};
