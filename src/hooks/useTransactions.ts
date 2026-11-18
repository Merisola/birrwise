'use client';

import { useState, useEffect, useCallback } from 'react';
import { Transaction, TransactionFilters, CreateTransactionInput } from '@/types';
import { onDataRefresh } from '@/lib/refresh';

export function useTransactions(filters?: Partial<TransactionFilters>) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState({ income: 0, expenses: 0, count: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.period) params.set('period', filters.period);
      if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.set('dateTo', filters.dateTo);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.account) params.set('account', filters.account);
      if (filters?.category) params.set('category', filters.category);
      if (filters?.type) params.set('type', filters.type);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      setTransactions(data.transactions || []);
      setSummary(data.summary || { income: 0, expenses: 0, count: 0 });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [
    filters?.period,
    filters?.dateFrom,
    filters?.dateTo,
    filters?.search,
    filters?.account,
    filters?.category,
    filters?.type,
  ]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => onDataRefresh(fetchTransactions), [fetchTransactions]);

  const create = async (data: CreateTransactionInput): Promise<Transaction> => {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create transaction');
    const created: Transaction = await res.json();
    created.fresh = true;
    setTransactions((prev) => [created, ...prev]);
    fetchTransactions();
    return created;
  };

  const update = async (
    id: string,
    data: Partial<Transaction>
  ): Promise<Transaction> => {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update transaction');
    const updated: Transaction = await res.json();
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updated } : t))
    );
    fetchTransactions();
    return updated;
  };

  const remove = async (id: string): Promise<void> => {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete transaction');
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    fetchTransactions();
  };

  const setCategory = async (
    id: string,
    category: string,
    always: boolean = false
  ): Promise<void> => {
    const res = await fetch(`/api/transactions/${id}/category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, always }),
    });
    if (!res.ok) throw new Error('Failed to set category');
    fetchTransactions();
  };

  const createRuleFromTransaction = async (
    id: string,
    category: string
  ): Promise<void> => {
    await setCategory(id, category, true);
  };

  return {
    transactions,
    summary,
    isLoading,
    error,
    refetch: fetchTransactions,
    create,
    update,
    delete: remove,
    setCategory,
    createRuleFromTransaction,
  };
}
