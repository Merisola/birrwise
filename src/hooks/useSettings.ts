'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings } from '@/types';
import { onDataRefresh } from '@/lib/refresh';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({
    workspace: 'My workspace',
    currency: 'ETB',
    dateFormat: 'DD/MM/YYYY',
    budget80: true,
    budget100: true,
    review: true,
    cycleStartDay: 7,
    wishlistCushion: null,
    wishlistIncomeOverride: null,
    wishlistCoolingDays: 14,
    wishlistExcludedCategories: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings((prev) => ({ ...prev, ...data }));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => onDataRefresh(fetchSettings), [fetchSettings]);

  const save = async (newSettings: Partial<Settings>): Promise<void> => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings),
    });
    if (!res.ok) throw new Error('Failed to save settings');
  };

  return {
    settings,
    isLoading,
    error,
    save,
    refetch: fetchSettings,
  };
}
