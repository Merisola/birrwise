'use client';

import React from 'react';
import { useUIState } from '@/context/UIContext';
import { fmt, money } from '@/lib/utils';
import { Account, Transaction } from '@/types';
import { monthLabel } from '@/lib/dates';

interface BalanceHeroProps {
  accounts: Account[];
  transactions: Transaction[];
  currentMonth: string;
}

export const BalanceHero: React.FC<BalanceHeroProps> = ({
  accounts,
  transactions,
  currentMonth,
}) => {
  const { toggleMasked } = useUIState();

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  const monthTx = transactions.filter((t) => (t.date || '').startsWith(currentMonth));
  const inc = monthTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const exp = monthTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const netFlow = inc - exp;

  const monthName = monthLabel(currentMonth);

  return (
    <section className="balance-hero">
      <div>
        <div className="balance-label">
          Total available balance{' '}
          <button
            type="button"
            className="eye"
            onClick={toggleMasked}
            aria-label="Hide balances"
          >
            👁 Hide
          </button>
        </div>
        <div className="balance-total sens" id="totalBalance">
          {fmt(totalBalance)}
        </div>
        <div className="balance-foot" id="heroFoot">
          Across {accounts.length} accounts · transfers never count as spending
        </div>
      </div>
      <div className="hero-right">
        <span id="netLabel">{monthName} net cash flow</span>
        <strong className="sens" id="netFlow">
          {money(netFlow)}
        </strong>
        <div className="hero-chip">
          <i />
          <span id="syncText">Synced · last SMS Today, 10:42 AM</span>
        </div>
      </div>
    </section>
  );
};