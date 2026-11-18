'use client';

import React, { ChangeEvent, DragEvent, useRef, useState } from 'react';

interface ImportDropzoneProps {
  onFileSelect: (file: File) => void;
  isProcessing?: boolean;
}

export const ImportDropzone: React.FC<ImportDropzoneProps> = ({
  onFileSelect,
  isProcessing = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    // Reset input so same file can be selected again
    if (e.target) e.target.value = '';
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (isProcessing) return;

    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
      onFileSelect(file);
    }
  };

  const handleClick = () => {
    if (!isProcessing) inputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={`import-drop ${isDragOver ? 'drag-over' : ''} ${isProcessing ? 'processing' : ''}`}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label="Choose CSV file to import"
      style={{ cursor: isProcessing ? 'not-allowed' : 'pointer' }}
    >
      <input
        ref={inputRef}
        id="csvFile"
        type="file"
        accept=".csv,text/csv,.txt,text/plain"
        style={{ display: 'none' }}
        onChange={handleChange}
        disabled={isProcessing}
      />
      <div style={{ fontSize: '25px' }}>{isProcessing ? '⏳' : '⇧'}</div>
      <strong>{isProcessing ? 'Processing...' : 'Choose a CSV file'}</strong>
      <p>CSV or TXT files · Drag and drop or click to browse</p>
      {isProcessing && <div className="spinner" />}
    </div>
  );
};