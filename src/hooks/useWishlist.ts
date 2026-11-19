'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ComputedWishlistItem,
  CreateWishlistInput,
  WishlistItem,
  WishlistSuggestion,
  WishlistSummary,
} from '@/types';
import { onDataRefresh, emitDataRefresh } from '@/lib/refresh';

export interface UseWishlistReturn {
  items: ComputedWishlistItem[];
  purchased: WishlistItem[];
  summary: WishlistSummary | null;
  suggestion: WishlistSuggestion | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  create: (data: CreateWishlistInput) => Promise<WishlistItem>;
  update: (id: string, data: Partial<CreateWishlistInput>) => Promise<WishlistItem>;
  remove: (id: string) => Promise<void>;
  purchase: (
    id: string,
    input: { account: string; category?: string | null; acknowledgeCooling?: boolean }
  ) => Promise<void>;
}

export function useWishlist(): UseWishlistReturn {
  const [items, setItems] = useState<ComputedWishlistItem[]>([]);
  const [purchased, setPurchased] = useState<WishlistItem[]>([]);
  const [summary, setSummary] = useState<WishlistSummary | null>(null);
  const [suggestion, setSuggestion] = useState<WishlistSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWishlist = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/wishlist');
      if (!res.ok) throw new Error('Failed to fetch wishlist');
      const data = await res.json();
      setItems(data.items || []);
      setPurchased(data.purchased || []);
      setSummary(data.summary || null);
      setSuggestion(data.suggestion || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  useEffect(() => onDataRefresh(fetchWishlist), [fetchWishlist]);

  const create = async (data: CreateWishlistInput): Promise<WishlistItem> => {
    const res = await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to create wishlist item');
    fetchWishlist();
    return json;
  };

  const update = async (
    id: string,
    data: Partial<CreateWishlistInput>
  ): Promise<WishlistItem> => {
    const res = await fetch(`/api/wishlist/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to update wishlist item');
    fetchWishlist();
    return json;
  };

  const remove = async (id: string): Promise<void> => {
    const res = await fetch(`/api/wishlist/${id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Failed to delete wishlist item');
    fetchWishlist();
  };

  const purchase = async (
    id: string,
    input: { account: string; category?: string | null; acknowledgeCooling?: boolean }
  ): Promise<void> => {
    const res = await fetch(`/api/wishlist/${id}/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json.error || 'Failed to complete the purchase.');
      (err as Error & { code?: string }).code = json.code;
      throw err;
    }
    // Let every hook (accounts, budgets, overview, ledger) reload.
    emitDataRefresh();
    fetchWishlist();
  };

  return {
    items,
    purchased,
    summary,
    suggestion,
    isLoading,
    error,
    refetch: fetchWishlist,
    create,
    update,
    remove,
    purchase,
  };
}
