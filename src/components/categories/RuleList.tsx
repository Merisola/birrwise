'use client';

import React from 'react';
import { Rule } from '@/types';

interface RuleListProps {
  rules: Rule[];
  onRemove: (id: string) => void;
}

export const RuleList: React.FC<RuleListProps> = ({ rules, onRemove }) => {
  if (rules.length === 0) {
    return (
      <div className="empty-state">
        No rules yet. Add one to automate categorization.
      </div>
    );
  }

  return (
    <div id="ruleList">
      {rules.map((r) => (
        <div key={r.id} className="manage-row">
          <div className="manage-row-main">
            <strong>Description contains “{r.keyword}”</strong>
            <small>Categorize as {r.category}</small>
          </div>
          <button
            type="button"
            className="small-action danger"
            onClick={() => onRemove(r.id)}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
};
