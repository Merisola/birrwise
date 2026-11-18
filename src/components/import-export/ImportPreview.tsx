'use client';

import React, { useState } from 'react';
import { ImportRow, ImportError, ImportStats } from '@/lib/import';
import { money } from '@/lib/utils';

interface ImportPreviewProps {
  rows: ImportRow[];
  errors: ImportError[];
  stats: ImportStats;
  duplicates: ImportRow[];
  onCommit: () => void;
  onClear: () => void;
  isSubmitting?: boolean;
}

export const ImportPreview: React.FC<ImportPreviewProps> = ({
  rows,
  errors,
  stats,
  duplicates,
  onCommit,
  onClear,
  isSubmitting = false,
}) => {
  if (rows.length === 0 && errors.length === 0 && duplicates.length === 0) return null;

  const [showAll, setShowAll] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);

  const displayRows = showAll ? rows : rows.slice(0, 20);

  return (
    <div id="importPreview">
      <div className="file-meta">
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span>
            <strong>{stats.valid}</strong> valid ·{' '}
            <strong style={{ color: 'var(--red)' }}>{stats.invalid}</strong> invalid ·{' '}
            <strong style={{ color: 'var(--amber)' }}>{stats.duplicates}</strong> duplicates
          </span>
          {rows.length > 20 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
              Show all {rows.length} rows
            </label>
          )}
        </div>
      </div>

      {errors.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', color: 'var(--red)' }}>
            <input type="checkbox" checked={showErrors} onChange={e => setShowErrors(e.target.checked)} />
            Show {errors.length} error{errors.length !== 1 ? 's' : ''}
          </label>
          {showErrors && (
            <div style={{ maxHeight: '200px', overflow: 'auto', marginTop: '8px', fontSize: '10px' }}>
              {errors.map((err, i) => (
                <div key={i} style={{ padding: '6px 8px', background: 'var(--red-soft)', borderRadius: '6px', marginBottom: '4px' }}>
                  <strong>Row {err.rowNumber}:</strong> {err.message}
                  <div style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>
                    {err.rawValues.join(' | ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {duplicates.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', color: 'var(--amber)' }}>
            <input type="checkbox" checked={showDuplicates} onChange={e => setShowDuplicates(e.target.checked)} />
            Show {duplicates.length} duplicate{duplicates.length !== 1 ? 's' : ''} (will be skipped)
          </label>
          {showDuplicates && (
            <div style={{ maxHeight: '150px', overflow: 'auto', marginTop: '8px', fontSize: '10px' }}>
              {duplicates.slice(0, 10).map((row, i) => (
                <div key={i} style={{ padding: '6px 8px', background: 'var(--amber-soft)', borderRadius: '6px', marginBottom: '4px' }}>
                  <strong>Row {row.rowNumber}:</strong> {row.name} · {money(row.amount)} · {row.date}
                </div>
              ))}
              {duplicates.length > 10 && <div style={{ color: 'var(--muted)', fontSize: '10px' }}>+{duplicates.length - 10} more</div>}
            </div>
          )}
        </div>
      )}

      <div style={{ overflow: 'auto', maxHeight: '400px' }}>
        <table className="preview-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Account</th>
              <th>Category</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i}>
                <td>{row.date}</td>
                <td>{row.time}</td>
                <td>{row.name}</td>
                <td>{money(row.amount)}</td>
                <td>{row.account}</td>
                <td>{row.category}</td>
                <td><span className={`category-tag ${row.type}`}>{row.type}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="primary-btn"
          onClick={onCommit}
          disabled={isSubmitting || rows.length === 0}
        >
          {isSubmitting ? 'Importing...' : `Import ${rows.length} transaction${rows.length !== 1 ? 's' : ''}`}
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={onClear}
          disabled={isSubmitting}
        >
          Clear
        </button>
      </div>
    </div>
  );
};