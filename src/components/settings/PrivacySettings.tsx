'use client';

import React from 'react';

export const PrivacySettings: React.FC = () => {
  return (
    <div className="manage-card">
      <h3>Privacy & security</h3>
      <p className="help">
        The prototype does not connect to a live server or bank account.
      </p>

      <div className="setting-line">
        <div>
          <strong>Local SQLite database</strong>
          <small>
            Data is persisted securely in your local SQLite / Prisma backend.
          </small>
        </div>
        <span className="status-dot" />
      </div>

      <div className="setting-line">
        <div>
          <strong>API route protection</strong>
          <small>
            Server-side API routes process all ledger operations securely.
          </small>
        </div>
        <span className="status-dot" />
      </div>

      <div className="data-note">
        For production, use encrypted transport, server-side secrets,
        least-privilege access, secure backups and explicit consent for SMS
        access. Never store an API key in frontend JavaScript.
      </div>
    </div>
  );
};
