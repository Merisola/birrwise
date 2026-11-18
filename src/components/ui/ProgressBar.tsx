import React from 'react';

interface ProgressBarProps {
  pct: number;
  color?: string;
  variant?: 'progress' | 'budget-track' | 'pace-track';
  showTick?: boolean;
  tickPct?: number;
  showThreshold?: boolean;
  thresholdPct?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  pct,
  color,
  variant = 'progress',
  showTick = false,
  tickPct = 53,
  showThreshold = false,
  thresholdPct = 80,
}) => {
  const clamped = Math.min(Math.max(pct, 0), 100);
  const thresholdClamped = Math.min(Math.max(thresholdPct, 0), 100);

  return (
    <div className="pw">
      <div className={variant} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={`${clamped}% used`}>
        <span
          style={{
            width: `${clamped}%`,
            ...(color ? { background: color } : {}),
          }}
        />
        {showThreshold && (
          <i
            className="threshold-marker"
            style={{ left: `${thresholdClamped}%` }}
            title={`${thresholdPct}% threshold`}
            aria-hidden="true"
          />
        )}
      </div>
      {showTick && (
        <i
          className="tick"
          style={{ left: `${Math.min(tickPct, 100)}%` }}
          title="Month elapsed"
          aria-hidden="true"
        />
      )}
    </div>
  );
};