'use client';

import React from 'react';
import { useSettings } from '@/hooks/useSettings';

export const BudgetAlertsCard: React.FC = () => {
  const { settings, save } = useSettings();
  const { budget80, budget100 } = settings;

  const handleToggle80 = async () => {
    await save({ budget80: !budget80 });
  };

  const handleToggle100 = async () => {
    await save({ budget100: !budget100 });
  };

  return (
    <div className="budget-side-card">
      <h3>Budget alerts</h3>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '12px 0',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700 }}>80% warning</div>
          <div className="subtle">Alert when a category reaches 80%</div>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10px',
          }}
        >
          <input
            id="alert80"
            type="checkbox"
            checked={budget80}
            onChange={handleToggle80}
          />{' '}
          On
        </label>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '12px 0',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700 }}>
            Budget exceeded
          </div>
          <div className="subtle">Alert when spending passes the limit</div>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '10px',
          }}
        >
          <input
            id="alert100"
            type="checkbox"
            checked={budget100}
            onChange={handleToggle100}
          />{' '}
          On
        </label>
      </div>

      <div className="subtle" style={{ lineHeight: 1.5, marginTop: '12px' }}>
        Alerts appear as banners on the Budgets page and in the dashboard overview.
      </div>
    </div>
  );
};