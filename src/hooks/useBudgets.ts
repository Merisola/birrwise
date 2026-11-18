'use client';

import { useState, useEffect, useCallback } from 'react';
import { Budget, BudgetWithSpending, CreateBudgetInput } from '@/types';
import { currentMonthKey, monthOptions } from '@/lib/dates';

export interface BudgetPace {
  elapsed: number;
  used: number;
  daysElapsed: number;
  daysInMonth: number;
  daysLeft: number;
  message: string;
  tone: 'good' | 'warning' | 'over';
}

export interface BudgetSummary {
  total: number;
  spent: number;
  remaining: number;
  pct: number;
}

export interface UseBudgetsReturn {
  budgets: BudgetWithSpending[];
  summary: BudgetSummary;
  pace: BudgetPace;
  monthLabel: string;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  create: (data: CreateBudgetInput) => Promise<Budget>;
  update: (id: string, limit: number) => Promise<Budget>;
  delete: (id: string) => Promise<void>;
}

export function useBudgets(month?: string): UseBudgetsReturn {
  const effectiveMonth = month || currentMonthKey();
  const [budgets, setBudgets] = useState<BudgetWithSpending[]>([]);
  const [summary, setSummary] = useState<BudgetSummary>({ total: 0, spent: 0, remaining: 0, pct: 0 });
  const [pace, setPace] = useState<BudgetPace>({
    elapsed: 0,
    used: 0,
    daysElapsed: 0,
    daysInMonth: 0,
    daysLeft: 0,
    message: '',
    tone: 'good',
  });
  const [monthLabel, setMonthLabel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBudgets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/budgets?month=${effectiveMonth}`);
      if (!res.ok) throw new Error('Failed to fetch budgets');
      const data = await res.json();
      setBudgets(data.budgets || []);
      setSummary(data.summary || { total: 0, spent: 0, remaining: 0, pct: 0 });
      setPace(data.pace || { elapsed: 0, used: 0, daysElapsed: 0, daysInMonth: 0, daysLeft: 0, message: '', tone: 'good' });
      setMonthLabel(data.monthLabel || '');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [effectiveMonth]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const create = async (data: CreateBudgetInput): Promise<Budget> => {
    const res = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create budget');
    }
    const created = await res.json();
    fetchBudgets();
    return created;
  };

  const update = async (id: string, limit: number): Promise<Budget> => {
    const res = await fetch(`/api/budgets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit }),
    });
    if (!res.ok) throw new Error('Failed to update budget');
    const updated = await res.json();
    fetchBudgets();
    return updated;
  };

  const remove = async (id: string): Promise<void> => {
    const res = await fetch(`/api/budgets/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete budget');
    fetchBudgets();
  };

  return {
    budgets,
    summary,
    pace,
    monthLabel,
    isLoading,
    error,
    refetch: fetchBudgets,
    create,
    update,
    delete: remove,
  };
}

export { monthOptions, currentMonthKey };