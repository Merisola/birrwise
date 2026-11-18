'use client';

import React from 'react';
import { Category } from '@/types';
import { buildCategoryGroups } from '@/lib/categories';

const SYSTEM = ['Income', 'Internal transfer', 'Uncategorized'];

interface CategoryListProps {
  categories: Category[];
  categoryIcons: Record<string, string>;
  onRename: (cat: Category) => void;
  onRemove: (id: string, name: string) => void;
  onAddSub?: (parent: Category) => void;
}

export const CategoryList: React.FC<CategoryListProps> = ({
  categories,
  categoryIcons,
  onRename,
  onRemove,
  onAddSub,
}) => {
  const groups = buildCategoryGroups(categories);

  const renderRow = (cat: Category, isSub: boolean) => (
    <div
      key={cat.id}
      className={`manage-row${isSub ? ' manage-row-sub' : ''}`}
    >
      <div className="merchant-icon">
        {categoryIcons[cat.name] || cat.icon || '✦'}
      </div>
      <div className="manage-row-main">
        <strong>{cat.name}</strong>
        <small>
          {isSub ? 'Subcategory' : 'Main category'}
          {SYSTEM.includes(cat.name) ? ' · system' : ''}
        </small>
      </div>
      <div className="manage-row-actions">
        {!isSub && onAddSub && !SYSTEM.includes(cat.name) && (
          <button
            type="button"
            className="small-action"
            onClick={() => onAddSub(cat)}
            title={`Add a subcategory under ${cat.name}`}
          >
            ＋ Sub
          </button>
        )}
        <button
          type="button"
          className="small-action"
          onClick={() => onRename(cat)}
        >
          Rename
        </button>
        <button
          type="button"
          className="small-action danger"
          onClick={() => onRemove(cat.id, cat.name)}
        >
          Remove
        </button>
      </div>
    </div>
  );

  return (
    <div id="categoryList">
      {groups.map(({ main, subs }) => (
        <div key={main.id} className="category-group">
          {renderRow(main, false)}
          {subs.map((s) => renderRow(s, true))}
        </div>
      ))}
    </div>
  );
};
