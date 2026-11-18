'use client';

import React, { useState } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import { useUIState } from '@/context/UIContext';
import { ImportDropzone } from '@/components/import-export/ImportDropzone';
import { ImportPreview } from '@/components/import-export/ImportPreview';
import { ExportButtons } from '@/components/import-export/ExportButtons';
import { parseImportFile, ImportRow, ImportError, ImportStats } from '@/lib/import';

export default function ImportExportPage() {
  const { transactions, refetch: refetchTransactions } = useTransactions({
    period: 'all',
  });
  const { accounts, refetch: refetchAccounts } = useAccounts();
  const { showToast } = useUIState();

  const [pendingRows, setPendingRows] = useState<ImportRow[]>([]);
  const [previewErrors, setPreviewErrors] = useState<ImportError[]>([]);
  const [previewStats, setPreviewStats] = useState<ImportStats>({ total: 0, valid: 0, invalid: 0, duplicates: 0 });
  const [previewDuplicates, setPreviewDuplicates] = useState<ImportRow[]>([]);
  const [importStatus, setImportStatus] = useState(
    'Your file is processed securely via local Next.js API routes.'
  );
  const [isImporting, setIsImporting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const handleFileSelect = async (file: File) => {
    setIsParsing(true);
    setImportStatus(`${file.name} · Parsing...`);
    try {
      const text = await file.text();
      const existingForDedupe = transactions.map(t => ({
        date: t.date,
        time: t.time,
        name: t.name,
        amount: t.amount,
        account: typeof t.account === 'string' ? t.account : t.account?.short || t.account?.name || 'Cash',
        type: t.type,
      }));

      const result = parseImportFile(text, {
        dateFormat: 'DD/MM/YYYY',
        existingTransactions: existingForDedupe,
      });

      setPendingRows(result.rows);
      setPreviewErrors(result.errors);
      setPreviewStats(result.stats);
      setPreviewDuplicates(result.duplicates);
      setImportStatus(`${file.name} · Preview ready`);
      showToast(`${result.stats.valid} valid rows found. ${result.stats.duplicates} duplicates will be skipped.`);
    } catch (e) {
      showToast('Failed to read CSV file');
      setImportStatus('Error reading file');
    } finally {
      setIsParsing(false);
    }
  };

  const handleClear = () => {
    setPendingRows([]);
    setPreviewErrors([]);
    setPreviewStats({ total: 0, valid: 0, invalid: 0, duplicates: 0 });
    setPreviewDuplicates([]);
    setImportStatus('Your file is processed securely via local Next.js API routes.');
  };

  const handleCommit = async () => {
    if (pendingRows.length === 0) return;
    setIsImporting(true);
    try {
      const res = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: pendingRows }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }
      const data = await res.json();

      handleClear();
      setImportStatus(
        `${data.imported} transactions imported, ${data.skippedDuplicates} duplicates skipped.`
      );
      showToast(`${data.imported} transactions imported.`);
      if (data.unmatchedAccounts?.length) {
        showToast(`Unmatched accounts: ${data.unmatchedAccounts.join(', ')}`);
      }
      refetchTransactions();
      refetchAccounts();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to import transactions');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="page-view management-page">
      <div className="management-head">
        <div>
          <h2>Import & export</h2>
          <p>
            Bring transaction history in, or take your records with you. No data
            lock-in nonsense.
          </p>
        </div>
      </div>

      <div className="management-grid">
        <div className="manage-card">
          <h3>Import transactions</h3>
          <p className="help">
            Upload a CSV with columns: date, description, amount, account,
            category, type. Also supports bank CSV with debit/credit columns and
            SMS backup exports (SMS Backup & Restore format). Positive amounts
            are income unless type is specified.
          </p>
          <ImportDropzone onFileSelect={handleFileSelect} isProcessing={isParsing} />
          <ImportPreview
            rows={pendingRows}
            errors={previewErrors}
            stats={previewStats}
            duplicates={previewDuplicates}
            onCommit={handleCommit}
            onClear={handleClear}
            isSubmitting={isImporting}
          />
          <div className="file-meta" id="importStatus">
            {importStatus}
          </div>
        </div>

        <ExportButtons transactions={transactions} accounts={accounts} />
      </div>
    </div>
  );
}