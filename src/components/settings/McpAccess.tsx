'use client';

import React, { useState } from 'react';
import { Settings } from '@/types';

interface McpAccessProps {
  settings: Settings;
  refetch: () => Promise<void>;
}

/**
 * AI (MCP) access card: enable/disable the endpoint, reveal/rotate the key,
 * copy client setup snippets. The raw key is kept only in component state.
 */
export const McpAccess: React.FC<McpAccessProps> = ({ settings, refetch }) => {
  const enabled = settings.mcpEnabled ?? false;
  const hasKey = settings.hasMcpKey ?? false;
  const preview = settings.mcpKeyPreview ?? null;

  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState('');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const endpoint = `${origin}/api/mcp`;
  const secretUrl = revealedKey ? `${origin}/api/mcp/${revealedKey}` : null;

  const act = async (action: 'enable' | 'disable' | 'rotate' | 'reveal') => {
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/settings/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Request failed');
      if (action === 'enable') {
        if (data.generated && data.key) setRevealedKey(data.key);
        setMessage('MCP enabled.');
      } else if (action === 'disable') {
        setMessage('MCP disabled.');
        setRevealedKey(null);
      } else if (action === 'rotate') {
        if (data.key) setRevealedKey(data.key);
        setMessage('New key generated — the old key no longer works.');
      } else if (action === 'reveal') {
        if (data.key) setRevealedKey(revealedKey ? null : data.key);
      }
      await refetch();
    } catch (err: any) {
      setMessage(err?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string, tag: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(tag);
    window.setTimeout(() => setCopied(''), 1600);
  };

  const claudeConfig = `{
  "mcpServers": {
    "birrwise": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${origin}/api/mcp", "--header", "Authorization: Bearer YOUR_KEY"]
    }
  }
}`;

  return (
    <div className="manage-card">
      <h3>
        AI (MCP) access{' '}
        <span
          className="tx-label"
          style={{
            marginLeft: 8,
            background: enabled ? '#e6f7ec' : '#f4f3f7',
            color: enabled ? '#0f7b3d' : '#6b6b76',
          }}
        >
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </h3>
      <p className="help">
        Let AI assistants (Claude Desktop, ChatGPT) read your ledger and help
        manage it over a key-protected endpoint. Off by default.
      </p>

      <div className="setting-line">
        <div>
          <strong>Enable MCP endpoint</strong>
          <small>One switch for /api/mcp. Everything is key-protected.</small>
        </div>
        <input
          className="toggle"
          type="checkbox"
          id="mcpEnabledToggle"
          checked={enabled}
          disabled={busy}
          onChange={(e) => act(e.target.checked ? 'enable' : 'disable')}
        />
      </div>

      <div className="field" style={{ marginTop: 10 }}>
        <label>ENDPOINT (Bearer)</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="settings-input" readOnly value={endpoint} />
          <button type="button" className="secondary-btn" onClick={() => copy(endpoint, 'ep')}>
            {copied === 'ep' ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="field">
        <label>SECRET URL (Claude Desktop / ChatGPT)</label>
        <input
          className="settings-input"
          readOnly
          value={secretUrl ?? `${origin}/api/mcp/${preview ?? '••••••••••••••••'}`}
          title={secretUrl ?? 'Reveal the key to see the full secret URL'}
        />
        <small className="help" style={{ display: 'block', marginTop: 4 }}>
          For clients that cannot send an Authorization header. Treat it like a
          password. Rotating the key kills the old URL instantly.
        </small>
      </div>

      <div className="field">
        <label>API KEY</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input
            className="settings-input"
            readOnly
            style={{ flex: 1, minWidth: 180 }}
            value={revealedKey ?? preview ?? 'No key yet — enable MCP to generate one'}
          />
          <button
            type="button"
            className="secondary-btn"
            disabled={busy || !hasKey}
            onClick={() => act('reveal')}
          >
            {revealedKey ? 'Hide' : 'Reveal'}
          </button>
          {revealedKey && (
            <button type="button" className="secondary-btn" onClick={() => copy(revealedKey, 'key')}>
              {copied === 'key' ? 'Copied ✓' : 'Copy'}
            </button>
          )}
          <button
            type="button"
            className="secondary-btn"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Generate a new key? The current key stops working immediately.')) {
                act('rotate');
              }
            }}
          >
            {hasKey ? 'Rotate key' : 'Generate key'}
          </button>
        </div>
        {message && <small style={{ display: 'block', marginTop: 6 }}>{message}</small>}
      </div>

      <div className="field">
        <label>WHAT AI CAN DO</label>
        <ul className="help" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>READ everything: summary, accounts, transactions, budgets, categories, rules, settings.</li>
          <li>WRITE freely: budgets, categories, rules, accounts, app settings.</li>
          <li>TRANSACTIONS + ALL DELETES: 2-step — the AI stages a preview, you approve, then it confirms.</li>
        </ul>
      </div>

      <details style={{ marginTop: 4 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          Claude Desktop setup
        </summary>
        <p className="help" style={{ marginTop: 6 }}>
          Open <code>claude_desktop_config.json</code>, paste this, restart Claude,
          and replace <code>YOUR_KEY</code> with your key (or use the Secret URL
          as a custom connector with no authentication):
        </p>
        <pre
          style={{
            background: '#f7f6fc',
            borderRadius: 10,
            padding: 10,
            fontSize: 11,
            overflowX: 'auto',
          }}
        >
          {claudeConfig}
        </pre>
        <button type="button" className="secondary-btn" onClick={() => copy(claudeConfig, 'cfg')}>
          {copied === 'cfg' ? 'Copied ✓' : 'Copy config'}
        </button>
        <p className="help" style={{ marginTop: 8 }}>
          ChatGPT: Settings → Connectors → Add custom connector → paste the
          Secret URL, choose <em>no authentication</em>. If ChatGPT rejects it,
          OAuth would be required — say the word.
        </p>
      </details>
    </div>
  );
};
