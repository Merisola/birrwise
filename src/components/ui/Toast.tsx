'use client';

import React from 'react';
import { useUIState } from '@/context/UIContext';

export const Toast: React.FC = () => {
  const { toast, hideToast } = useUIState();

  if (!toast) return <div className="toast" id="toast" />;

  return (
    <div className="toast show" id="toast">
      <span>{toast.message}</span>
      {toast.actions?.map((act, i) => (
        <button
          key={i}
          type="button"
          onClick={() => {
            act.onClick();
            hideToast();
          }}
        >
          {act.label}
        </button>
      ))}
    </div>
  );
};
