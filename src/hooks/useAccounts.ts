'use client';

import { useState, useEffect, useCallback } from 'react';
import { Account, CreateAccountInput } from '@/types';

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/accounts');
      if (!res.ok) throw new Error('Failed to fetch accounts');
      const data = await res.json();
      setAccounts(data.accounts || []);
      setTotalBalance(data.totalBalance || 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const create = async (data: CreateAccountInput): Promise<Account> => {
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create account');
    const created: Account = await res.json();
    fetchAccounts();
    return created;
  };

  const update = async (
    id: string,
    data: Partial<Account>
  ): Promise<Account> => {
    const res = await fetch(`/api/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update account');
    const updated: Account = await res.json();
    fetchAccounts();
    return updated;
  };

  const remove = async (id: string): Promise<void> => {
    const res = await fetch(`/api/accounts/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete account');
    fetchAccounts();
  };

  return {
    accounts,
    totalBalance,
    isLoading,
    error,
    refetch: fetchAccounts,
    create,
    update,
    delete: remove,
  };
}
