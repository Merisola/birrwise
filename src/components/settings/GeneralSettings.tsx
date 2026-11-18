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
