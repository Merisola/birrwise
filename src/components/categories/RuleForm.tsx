'use client';

import React, { useState } from 'react';
import { Category } from '@/types';
import { CategorySelectOptions } from '@/components/ui/CategorySelectOptions';

interface RuleFormProps {
  categories: Category[];
  onAdd: (keyword: string, category: string) => Promise<void>;
  onClose: () => void;
}

export const RuleForm: React.FC<RuleFormProps> = ({
  categories,
  onAdd,
  onClose,
}) => {
  const allowedCategories = categories.filter(
    (c) => !['Income', 'Internal transfer', 'Uncategorized'].includes(c.name)
  );

  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState(
    allowedCategories[0]?.name || 'Transport'
  );

  const handleSave = async () => {
    if (!keyword.trim() || !category) return;
    await onAdd(keyword.trim(), category);
    setKeyword('');
    onClose();
  };

  return (
    <div className="inline-form" id="ruleForm">
      <div className="field">
        <label>IF DESCRIPTION CONTAINS</label>
        <input
          id="ruleKeyword"
          placeholder="e.g. TOMOCA"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>
      <div className="form-row">
        <div className="field">
          <label>THEN CATEGORY</label>
          <select
            id="ruleCategory"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <CategorySelectOptions categories={allowedCategories} />
          </select>
        </div>
        <button type="button" className="primary-btn" onClick={handleSave}>
          Save rule
        </button>
      </div>
    </div>
  );
};
