'use client';

import React, { useState } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { useUIState } from '@/context/UIContext';
import { CategoryList } from '@/components/categories/CategoryList';
import { CategoryForm } from '@/components/categories/CategoryForm';
import { RuleList } from '@/components/categories/RuleList';
import { RuleForm } from '@/components/categories/RuleForm';
import { Category } from '@/types';
import { ReloadButton } from '@/components/layout/ReloadButton';

export const dynamic = 'force-dynamic';

export default function CategoriesPage() {
  const {
    categories,
    categoryIcons,
    rules,
    createCategory,
    renameCategory,
    deleteCategory,
    createRule,
    deleteRule,
    loadCommonCategories,
  } = useCategories();

  const { showToast } = useUIState();

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [formParentId, setFormParentId] = useState<string | null>(null);

  const openCategoryForm = (parentId: string | null) => {
    setFormParentId(parentId);
    setShowCategoryForm(true);
  };

  const handleLoadCommon = async () => {
    try {
      const res = await loadCommonCategories();
      showToast(
        res.added.length
          ? `Added ${res.added.length} common categor${res.added.length === 1 ? 'y' : 'ies'}: ${res.added.join(', ')}`
          : 'Common categories are already loaded.'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to load common categories');
    }
  };

  const handleRename = async (cat: Category) => {
    const newName = window.prompt('Rename category', cat.name);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (
      !trimmed ||
      categories.some(
        (c) => c.id !== cat.id && c.name.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      showToast('Enter a unique category name.');
      return;
    }
    try {
      await renameCategory(cat.id, trimmed);
      showToast(
        'Category renamed. Existing transactions are not automatically changed in this prototype.'
      );
    } catch {
      showToast('Failed to rename category');
    }
  };

  const handleRemoveCategory = async (id: string, name: string) => {
    if (['Income', 'Internal transfer', 'Uncategorized'].includes(name)) {
      showToast('This system category cannot be removed.');
      return;
    }
    if (!window.confirm(`Remove category ${name}?`)) return;
    try {
      await deleteCategory(id);
      showToast('Category removed from the category list.');
    } catch (err: any) {
      showToast(err.message || 'Failed to remove category');
    }
  };

  const handleRemoveRule = async (id: string) => {
    try {
      await deleteRule(id);
      showToast('Rule removed.');
    } catch {
      showToast('Failed to remove rule');
    }
  };

  return (
    <div className="page-view management-page">
      <div className="management-head">
        <div>
          <h2>Categories & rules</h2>
          <p>
            Keep spending organized and teach Birrwise how to categorize
            familiar transactions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <ReloadButton />
          <button
            type="button"
            className="secondary-btn"
            onClick={handleLoadCommon}
          >
            ↓ Load common categories
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() =>
              showCategoryForm && formParentId === null
                ? setShowCategoryForm(false)
                : openCategoryForm(null)
            }
          >
            ＋ Add category
          </button>
        </div>
      </div>

      <div className="management-grid">
        <div className="manage-card">
          <h3>Categories</h3>
          <p className="help">
            Categories are used by transactions and monthly budgets.
          </p>
          <CategoryList
            categories={categories}
            categoryIcons={categoryIcons}
            onRename={handleRename}
            onRemove={handleRemoveCategory}
            onAddSub={(parent) => openCategoryForm(parent.id)}
          />
          {showCategoryForm && (
            <CategoryForm
              categories={categories}
              initialParentId={formParentId}
              key={formParentId || 'root'}
              onAdd={async (name, icon, parentId) => {
                try {
                  await createCategory(name, icon, parentId);
                  showToast(
                    parentId ? 'Subcategory added.' : 'Category added.'
                  );
                } catch (err: any) {
                  showToast(err.message || 'Failed to add category');
                }
              }}
              onClose={() => setShowCategoryForm(false)}
            />
          )}
        </div>

        <div className="manage-card">
          <h3>Auto-categorization rules</h3>
          <p className="help">
            Rules are checked against a transaction&apos;s description or
            counterparty. First matching rule wins in this demo.
          </p>
          <RuleList rules={rules} onRemove={handleRemoveRule} />
          {showRuleForm && (
            <RuleForm
              categories={categories}
              onAdd={async (keyword, category) => {
                try {
                  const res = await createRule(keyword, category);
                  showToast(
                    `Rule saved${
                      res.updatedCount
                        ? ` · ${res.updatedCount} similar transaction${
                            res.updatedCount > 1 ? 's' : ''
                          } updated`
                        : ''
                    }.`
                  );
                } catch (err: any) {
                  showToast(err.message || 'Failed to save rule');
                }
              }}
              onClose={() => setShowRuleForm(false)}
            />
          )}
          {!showRuleForm && (
            <button
              type="button"
              className="secondary-btn"
              style={{ marginTop: '12px' }}
              onClick={() => setShowRuleForm(true)}
            >
              ＋ Add rule
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
