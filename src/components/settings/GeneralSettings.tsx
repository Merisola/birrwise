'use client';

import React from 'react';
import { Settings } from '@/types';
import { useSignOut } from '@/hooks/useSignOut';

interface GeneralSettingsProps {
  settings: Settings;
  onChange: (updates: Partial<Settings>) => void;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  settings,
  onChange,
}) => {
  const { signOut, signingOut } = useSignOut();

  return (
    <div className="manage-card">
      <h3>General</h3>
      <p className="help">A few basics for how Birrwise displays your money.</p>

      <div className="field">
        <label>WORKSPACE NAME</label>
        <input
          className="settings-input"
          id="workspaceName"
          value={settings.workspace}
          onChange={(e) => onChange({ workspace: e.target.value })}
        />
      </div>

      <div className="field">
        <label>DISPLAY CURRENCY</label>
        <select
          className="settings-input"
          id="currencySetting"
          value={settings.currency}
          onChange={(e) =>
            onChange({ currency: e.target.value as 'ETB' | 'USD' })
          }
        >
          <option value="ETB">Ethiopian Birr (ETB)</option>
          <option value="USD">US Dollar (USD)</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="cycleStartDay">PAY CYCLE START DAY</label>
        <input
          className="settings-input"
          id="cycleStartDay"
          type="number"
          min={1}
          max={28}
          step={1}
          value={settings.cycleStartDay ?? 7}
          onChange={(e) => {
            const raw = e.target.valueAsNumber;
            if (Number.isFinite(raw)) {
              onChange({ cycleStartDay: Math.min(28, Math.max(1, Math.floor(raw))) });
            } else {
              onChange({ cycleStartDay: 7 });
            }
          }}
        />
        <p className="help">Day of the month your cycle starts (1–28). Default 7. Monthly views run from this day to the day before it next month — e.g. 7 means 7 Nov – 6 Dec.</p>
      </div>

      <div className="field">
        <label>DATE FORMAT</label>
        <select
          className="settings-input"
          id="dateSetting"
          value={settings.dateFormat}
          onChange={(e) =>
            onChange({
              dateFormat: e.target.value as
                | 'DD/MM/YYYY'
                | 'MM/DD/YYYY'
                | 'YYYY-MM-DD',
            })
          }
        >
          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
        </select>
      </div>

      <div className="field">
        <label>SESSION</label>
        <button
          type="button"
          className="secondary-btn"
          onClick={signOut}
          disabled={signingOut}
        >
          {signingOut ? 'Signing out…' : 'Sign out of Birrwise'}
        </button>
      </div>
    </div>
  );
};
