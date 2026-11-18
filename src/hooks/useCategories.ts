'use client';

import { useState, useEffect, useCallback } from 'react';
import { Category, Rule } from '@/types';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryIcons, setCategoryIcons] = useState<Record<string, string>>({});
  const [rules, setRules] = useState<Rule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCategoriesAndRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const [catRes, rulesRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/rules'),
      ]);
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories || []);
        setCategoryIcons(catData.categoryIcons || {});
      }
      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        setRules(rulesData.rules || []);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategoriesAndRules();
  }, [fetchCategoriesAndRules]);

  const createCategory = async (name: string, icon: string): Promise<Category> => {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create category');
    }
    const created: Category = await res.json();
    fetchCategoriesAndRules();
    return created;
  };

  const renameCategory = async (id: string, name: string): Promise<void> => {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to rename category');
    fetchCategoriesAndRules();
  };

  const deleteCategory = async (id: string): Promise<void> => {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete category');
    }
    fetchCategoriesAndRules();
  };

  const createRule = async (
    keyword: string,
    category: string
  ): Promise<{ rule: Rule; updatedCount: number }> => {
    const res = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, category }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create rule');
    }
    const data = await res.json();
    fetchCategoriesAndRules();
    return data;
  };

  const deleteRule = async (id: string): Promise<void> => {
    const res = await fetch(`/api/rules/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete rule');
    fetchCategoriesAndRules();
  };

  return {
    categories,
    categoryIcons,
    rules,
    isLoading,
    error,
    refetch: fetchCategoriesAndRules,
    createCategory,
    renameCategory,
    deleteCategory,
    createRule,
    deleteRule,
  };
}
