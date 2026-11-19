'use client';

import React, { useState } from 'react';
import { money } from '@/lib/utils';

interface SmsPreview {
  date: string;
  time: string;
  name: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  note: string;
  icon: string;
  account: { id: string; short: string; name: string };
  balanceBefore: number;
  balanceAfter: number;
  smsBalance?: number;
  duplicate: boolean;
  balanceMismatch?: { expected: number; stated: number };
}

interface SmsPasteCardProps {
  onIngested: () => void;
}

/**
 * Recover an SMS that never reached the webhook (phone offline, forwarding
 * failure, macro disabled). Uses the same server-side parser as the webhook,
 * so fees, balances and deduplication behave identically.
 */
export const SmsPasteCard: React.FC<SmsPasteCardProps> = ({ onIngested }) => {
  const [sender, setSender] = useState('Telebirr');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<SmsPreview | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (isPreview: boolean) => {
    if (!message.trim()) {
      setError('Paste the SMS text first.');
      return;
    }
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const res = await fetch('/api/sms/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, message, preview: isPreview }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to read this SMS');
      }

      if (data.duplicate) {
        setPreview(null);
        setStatus('This SMS is already in your ledger — duplicate skipped.');
        return;
      }

      if (isPreview) {
        setPreview(data.preview as SmsPreview);
      } else {
        const created = data.created;
        setPreview(null);
        setMessage('');
        setStatus(
          `Added ${money(created.amount)} to ${created.account.short} on ${created.date}.`
        );
        onIngested();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read this SMS');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="manage-card">
      <h3>Add a missed SMS</h3>
      <p className="help">
        Paste an SMS that never reached the webhook (connection outage, phone
        off, forwarding failure). The same parser runs — dates, service fees,
        VAT and the stated balance are read from the message. Pasting the same
        SMS twice is safe.
      </p>

      <div className="field">
        <label>SENDER</label>
        <input
          className="settings-input"
          value={sender}
          onChange={(e) => setSender(e.target.value)}
          placeholder="Telebirr, CBE, BOA…"
        />
      </div>

      <div className="field">
        <label>SMS TEXT</label>
        <textarea
          className="settings-input"
          rows={6}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setPreview(null);
            setError('');
            setStatus('');
          }}
          placeholder="Paste the full SMS here…"
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="primary-btn"
          onClick={() => submit(true)}
          disabled={busy || !message.trim()}
        >
          {busy && !preview ? 'Reading…' : 'Preview'}
        </button>
        {preview && !preview.duplicate && (
          <button
            type="button"
            className="primary-btn"
            onClick={() => submit(false)}
            disabled={busy}
          >
            {busy ? 'Adding…' : 'Add transaction'}
          </button>
        )}
        {(message || preview) && (
          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              setMessage('');
              setPreview(null);
              setError('');
              setStatus('');
            }}
            disabled={busy}
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="file-meta" style={{ color: 'var(--red)', marginTop: '10px' }}>
          {error}
        </div>
      )}
      {status && (
        <div className="file-meta" style={{ marginTop: '10px' }}>
          {status}
        </div>
      )}

      {preview && (
        <div
          style={{
            marginTop: '14px',
            padding: '12px',
            border: '1px solid var(--line)',
            borderRadius: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <strong>{preview.name}</strong>
            <strong>{money(preview.amount)}</strong>
          </div>
          <div className="file-meta" style={{ marginTop: '6px' }}>
            {preview.date} · {preview.time} · {preview.account.short} ·{' '}
            {preview.category} ·{' '}
            <span className={`category-tag ${preview.type}`}>{preview.type}</span>
          </div>
          <p className="help" style={{ margin: '8px 0 0' }}>
            {preview.note}
          </p>
          <div className="file-meta" style={{ marginTop: '8px' }}>
            Balance: {money(preview.balanceBefore)} →{' '}
            <strong>{money(preview.balanceAfter)}</strong>
            {preview.smsBalance !== undefined && (
              <> · SMS says {money(preview.smsBalance)}</>
            )}
          </div>
          {preview.smsBalance !== undefined &&
            Math.abs(preview.smsBalance - preview.balanceAfter) < 0.005 && (
              <div className="file-meta" style={{ marginTop: '4px', color: 'var(--green, #2f9e6f)' }}>
                ✓ Matches the balance stated in the SMS.
              </div>
            )}
          {preview.duplicate ? (
            <div style={{ marginTop: '8px', color: 'var(--amber)', fontSize: '11px' }}>
              This SMS is already in your ledger — it will not be added twice.
            </div>
          ) : (
            <>
              {preview.balanceMismatch && (
                <div style={{ marginTop: '8px', color: 'var(--amber)', fontSize: '10px', lineHeight: 1.5 }}>
                  The SMS balance differs from the app by{' '}
                  {money(
                    Math.abs(
                      preview.balanceMismatch.stated - preview.balanceMismatch.expected
                    )
                  )}
                  . Another SMS may also be missing — add missed messages oldest
                  first.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
