'use client';

import React, { useState, useEffect } from 'react';
import { useUIState } from '@/context/UIContext';
import { useCategories } from '@/hooks/useCategories';
import { BudgetWithSpending } from '@/types';
import { CategorySelectOptions } from '@/components/ui/CategorySelectOptions';

interface BudgetModalProps {
  budgets: BudgetWithSpending[];
  onCreateBudget: (data: { category: string; limit: number }) => Promise<void>;
  onUpdateBudget: (id: string, limit: number) => Promise<void>;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  budgets,
  onCreateBudget,
  onUpdateBudget,
}) => {
  const {
    budgetModalOpen,
    setBudgetModalOpen,
    editingBudgetId,
    setEditingBudgetId,
    showToast,
  } = useUIState();

  const { categories } = useCategories();
  const firstCategory = categories.find((c) => !c.parentId)?.name || '';
  const budgetable = categories.filter(
    (c) => !['Income', 'Internal transfer'].includes(c.name)
  );

  const [category, setCategory] = useState(firstCategory);
  const [limit, setLimit] = useState('');

  const editingBudget = budgets.find((b) => b.id === editingBudgetId);

  useEffect(() => {
    if (editingBudget) {
      setCategory(editingBudget.category);
      setLimit(String(editingBudget.limit));
    } else {
      setCategory((prev) => prev || firstCategory);
      setLimit('');
    }
  }, [editingBudget, budgetModalOpen, firstCategory]);

  if (!budgetModalOpen) return null;

  const handleClose = () => {
    setBudgetModalOpen(false);
    setEditingBudgetId(null);
  };

  const handleSave = async () => {
    const numLimit = Number(limit);
    if (!numLimit || numLimit <= 0) {
      showToast('Enter a valid monthly limit.');
      return;
    }
    if (!editingBudget && !category) {
      showToast('Pick a category first.');
      return;
    }

    try {
      if (editingBudget) {
        await onUpdateBudget(editingBudget.id, numLimit);
      } else {
        if (budgets.some((b) => b.category === category)) {
          showToast('A budget already exists for this category. Edit the existing one.');
          return;
        }
        await onCreateBudget({ category, limit: numLimit });
      }
      handleClose();
      showToast('Budget saved.');
    } catch (err: any) {
      showToast(err.message || 'Failed to save budget.');
    }
  };

  return (
    <div
      className={`modal-backdrop ${budgetModalOpen ? 'show' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="modal">
        <h3>
          {editingBudget
            ? `Edit ${editingBudget.category} budget`
            : 'Create a budget'}
        </h3>
        <p>Set a monthly spending limit for a category.</p>

        <div className="field">
          <label>CATEGORY</label>
          <select
            value={category}
            disabled={!!editingBudget}
            onChange={(e) => setCategory(e.target.value)}
          >
            {budgetable.length === 0 && <option value="">Loading...</option>}
            {editingBudget &&
              !budgetable.some((c) => c.name === editingBudget.category) && (
                <option value={editingBudget.category}>
                  {editingBudget.category}
                </option>
              )}
            <CategorySelectOptions categories={budgetable} />
          </select>
          <p className="help" style={{ marginTop: '6px' }}>
            Budgeting a main category also counts its subcategories.
          </p>
        </div>

        <div className="field">
          <label>MONTHLY LIMIT (ETB)</label>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 3000"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </div>

        <div className="budget-modal-note">
          Budgets are tracked by category and reset each month. Your existing
          transactions are not changed when you edit a limit.
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={handleClose}>
            Cancel
          </button>
          <button type="button" className="primary-btn" onClick={handleSave}>
            Save budget
          </button>
        </div>
      </div>
    </div>
  );
};
