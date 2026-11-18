'use client';

import React, { useState } from 'react';
import { Category } from '@/types';

interface CategoryFormProps {
  onAdd: (name: string, icon: string, parentId?: string | null) => Promise<void>;
  onClose: () => void;
  categories?: Category[];
  initialParentId?: string | null;
}

export const CategoryForm: React.FC<CategoryFormProps> = ({
  onAdd,
  onClose,
  categories = [],
  initialParentId = null,
}) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [parentId, setParentId] = useState<string>(initialParentId || '');

  const topLevel = categories.filter((c) => !c.parentId);
  const isSub = !!parentId;

  const handleAdd = async () => {
    if (!name.trim()) return;
    await onAdd(name.trim(), icon.trim() || '✦', parentId || null);
    setName('');
    setIcon('');
    setParentId('');
    onClose();
  };

  return (
    <div className="inline-form" id="categoryForm">
      <div className="form-row">
        <div className="field">
          <label>CATEGORY NAME</label>
          <input
            id="newCategoryName"
            placeholder={isSub ? 'e.g. Sabi — my aunt' : 'e.g. Healthcare'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label>ICON</label>
          <input
            id="newCategoryIcon"
            maxLength={4}
            placeholder="💊"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
          />
        </div>
        <div className="field">
          <label>PARENT (OPTIONAL)</label>
          <select
            id="newCategoryParent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">No parent (main)</option>
            {topLevel.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.name}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="primary-btn" onClick={handleAdd}>
          Add
        </button>
      </div>
    </div>
  );
};
