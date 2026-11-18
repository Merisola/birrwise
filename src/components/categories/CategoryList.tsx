'use client';

import React from 'react';
import { Category } from '@/types';

interface CategoryListProps {
  categories: Category[];
  categoryIcons: Record<string, string>;
  onRename: (cat: Category) => void;
  onRemove: (id: string, name: string) => void;
}

export const CategoryList: React.FC<CategoryListProps> = ({
  categories,
  categoryIcons,
  onRename,
  onRemove,
}) => {
  return (
    <div id="categoryList">
      {categories.map((c) => (
        <div key={c.id} className="manage-row">
          <div className="merchant-icon">
            {categoryIcons[c.name] || c.icon || '✦'}
          </div>
          <div className="manage-row-main">
            <strong>{c.name}</strong>
            <small>Transaction category</small>
          </div>
          <div className="manage-row-actions">
            <button
              type="button"
              className="small-action"
              onClick={() => onRename(c)}
            >
              Rename
            </button>
            <button
              type="button"
              className="small-action danger"
              onClick={() => onRemove(c.id, c.name)}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
