'use client';

import React, { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useTransactions } from '@/hooks/useTransactions';
import { useUIState } from '@/context/UIContext';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { McpAccess } from '@/components/settings/McpAccess';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { PrivacySettings } from '@/components/settings/PrivacySettings';
import { DataTools } from '@/components/settings/DataTools';
import { WishlistSettingsCard } from '@/components/wishlist/WishlistSettingsCard';
import { Settings } from '@/types';
import { ReloadButton } from '@/components/layout/ReloadButton';

export default function SettingsPage() {
  const { settings, save: saveSettings, refetch } = useSettings();
  const { transactions } = useTransactions({ period: 'all' });
  const { showToast } = useUIState();

  const [formData, setFormData] = useState<Settings>(settings);

  // Keep local state in sync when settings finish loading
  React.useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleChange = (updates: Partial<Settings>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    // Wishlist settings are owned by the Wishlist page card (self-saving);
    // keep them out of the page-level payload so a stale formData never
    // clobbers what the user set there.
    const {
      wishlistCushion: _c,
      wishlistIncomeOverride: _i,
      wishlistCoolingDays: _cd,
      wishlistExcludedCategories: _e,
      ...payload
    } = formData;
    try {
      await saveSettings(payload);
      showToast('Settings saved.');
    } catch {
      showToast('Failed to save settings.');
    }
  };

  const handleResetDemo = async () => {
    try {
      const res = await fetch('/api/settings/reset', { method: 'POST' }).catch(() => null);
      if (!res || !res.ok) {
        // Fallback: reload page
        window.location.reload();
        return;
      }
      showToast('Demo data reset.');
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  return (
    <div className="page-view management-page">
      <div className="management-head">
        <div>
          <h2>Settings</h2>
          <p>Control your workspace preferences, privacy and data behavior.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <ReloadButton />
          <button
            type="button"
            className="primary-btn"
            onClick={handleSave}
          >
            Save settings
          </button>
        </div>
      </div>

      <div className="management-grid">
        <GeneralSettings settings={formData} onChange={handleChange} />
        <McpAccess settings={formData} refetch={refetch} />
        <NotificationSettings settings={formData} onChange={handleChange} />
        <PrivacySettings />
        {/* Wishlist settings save on their own button; not part of the page-level Save. */}
        <WishlistSettingsCard />
        <DataTools
          transactions={transactions}
          onResetDemo={handleResetDemo}
        />
      </div>
    </div>
  );
}
