'use client';

import React from 'react';
import { BudgetAlert } from '@/lib/budgets';
import { money } from '@/lib/utils';

interface BudgetAlertBannerProps {
  alerts: BudgetAlert[];
  onDismiss?: (budgetId: string) => void;
}

export const BudgetAlertBanner: React.FC<BudgetAlertBannerProps> = ({
  alerts,
  onDismiss,
}) => {
  if (alerts.length === 0) return null;

  const overAlerts = alerts.filter((a) => a.type === 'over');
  const nearAlerts = alerts.filter((a) => a.type === 'near');

  return (
    <div className="budget-alert-banner" role="alert" aria-live="polite">
      {overAlerts.length > 0 && (
        <div className="budget-alert danger">
          <div className="alert-icon">⚠</div>
          <div className="alert-content">
            <strong>
              {overAlerts.length === 1 ? 'Budget exceeded' : `${overAlerts.length} budgets exceeded`}
            </strong>
            <div className="alert-list">
              {overAlerts.slice(0, 3).map((a) => (
                <div key={a.budgetId} className="alert-item">
                  <span>{a.icon} {a.category}</span>
                  <span className="alert-detail">
                    {a.pct}% used · {a.left < 0 ? `over by ${money(-a.left)}` : `at limit`}
                  </span>
                </div>
              ))}
              {overAlerts.length > 3 && (
                <div className="alert-more">+{overAlerts.length - 3} more</div>
              )}
            </div>
          </div>
          {onDismiss && overAlerts.length === 1 && (
            <button
              type="button"
              className="alert-dismiss"
              onClick={() => onDismiss(overAlerts[0].budgetId)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {nearAlerts.length > 0 && (
        <div className="budget-alert warning">
          <div className="alert-icon">⚡</div>
          <div className="alert-content">
            <strong>
              {nearAlerts.length === 1 ? 'Approaching limit' : `${nearAlerts.length} budgets near limit`}
            </strong>
            <div className="alert-list">
              {nearAlerts.slice(0, 3).map((a) => (
                <div key={a.budgetId} className="alert-item">
                  <span>{a.icon} {a.category}</span>
                  <span className="alert-detail">
                    {a.pct}% used · {money(a.left)} remaining
                  </span>
                </div>
              ))}
              {nearAlerts.length > 3 && (
                <div className="alert-more">+{nearAlerts.length - 3} more</div>
              )}
            </div>
          </div>
          {onDismiss && nearAlerts.length === 1 && (
            <button
              type="button"
              className="alert-dismiss"
              onClick={() => onDismiss(nearAlerts[0].budgetId)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
};