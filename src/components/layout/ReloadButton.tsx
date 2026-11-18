'use client';

import React, { useState } from 'react';
import { useUIState } from '@/context/UIContext';

/**
 * Global "reload everything" button — re-fetches all data hooks
 * (transactions, accounts, budgets, categories, settings) without
 * losing page state like filters or search.
 */
export const ReloadButton: React.FC<{ className?: string }> = ({ className }) => {
  const { refreshAll } = useUIState();
  const [spinning, setSpinning] = useState(false);

  const reload = () => {
    refreshAll();
    setSpinning(true);
    window.setTimeout(() => setSpinning(false), 700);
  };

  return (
    <button
      type="button"
      className={`icon-btn reload-btn${spinning ? ' is-spinning' : ''}${className ? ` ${className}` : ''}`}
      aria-label="Reload data"
      title="Reload data"
      onClick={reload}
    >
      <span className="reload-glyph" aria-hidden="true">↻</span>
    </button>
  );
};
