'use client';

import React, { useState } from 'react';

interface CategoryFormProps {
  onAdd: (name: string, icon: string) => Promise<void>;
  onClose: () => void;
}

export const CategoryForm: React.FC<CategoryFormProps> = ({ onAdd, onClose }) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');

  const handleAdd = async () => {
    if (!name.trim()) return;
    await onAdd(name.trim(), icon.trim() || '✦');
    setName('');
    setIcon('');
    onClose();
  };

  return (
    <div className="inline-form" id="categoryForm">
      <div className="form-row">
        <div className="field">
          <label>CATEGORY NAME</label>
          <input
            id="newCategoryName"
            placeholder="e.g. Healthcare"
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
        <button type="button" className="primary-btn" onClick={handleAdd}>
          Add
        </button>
      </div>
    </div>
  );
};
