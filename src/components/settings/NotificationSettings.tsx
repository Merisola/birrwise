'use client';

import React from 'react';
import { Settings } from '@/types';

interface NotificationSettingsProps {
  settings: Settings;
  onChange: (updates: Partial<Settings>) => void;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  settings,
  onChange,
}) => {
  return (
    <div className="manage-card">
      <h3>Notifications</h3>
      <p className="help">
        Choose which reminders and warnings appear in the app.
      </p>

      <div className="setting-line">
        <div>
          <strong>Budget warning at 80%</strong>
          <small>Show a warning when a category nears its limit.</small>
        </div>
        <input
          className="toggle"
          type="checkbox"
          id="settingBudget80"
          checked={settings.budget80}
          onChange={(e) => onChange({ budget80: e.target.checked })}
        />
      </div>

      <div className="setting-line">
        <div>
          <strong>Budget exceeded alert</strong>
          <small>Notify when a category goes over its limit.</small>
        </div>
        <input
          className="toggle"
          type="checkbox"
          id="settingBudget100"
          checked={settings.budget100}
          onChange={(e) => onChange({ budget100: e.target.checked })}
        />
      </div>

      <div className="setting-line">
        <div>
          <strong>Uncategorized transaction reminders</strong>
          <small>Keep transactions needing review visible.</small>
        </div>
        <input
          className="toggle"
          type="checkbox"
          id="settingReview"
          checked={settings.review}
          onChange={(e) => onChange({ review: e.target.checked })}
        />
      </div>
    </div>
  );
};
