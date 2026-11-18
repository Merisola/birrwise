'use client';

import React, { useEffect, useState } from 'react';
import { useUIState } from '@/context/UIContext';
import { monthOptions, monthLabel, todayISO } from '@/lib/dates';

interface TopbarProps {
  reviewCount?: number;
}

export const Topbar: React.FC<TopbarProps> = ({ reviewCount = 0 }) => {
  const { currentMonth, setMonth, openCashModal, goReview, currentPage } =
    useUIState();
  const [greeting, setGreeting] = useState('Good afternoon 👋');
  const [todayStr, setTodayStr] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    const g =
      h < 12
        ? 'Good morning'
        : h < 18
        ? 'Good afternoon'
        : 'Good evening';
    setGreeting(`${g} 👋`);
  }, []);

  useEffect(() => {
    setTodayStr(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
  }, []);

  const monthOpts = monthOptions();

  if (currentPage !== 'Overview') {
    return null;
  }

  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">{todayStr}</div>
        <div className="page-title" id="greet">
          {greeting}
        </div>
      </div>
      <div className="top-actions">
        <select
          className="month-select"
          id="monthSel"
          aria-label="Select month"
          value={currentMonth}
          onChange={(e) => setMonth(e.target.value)}
        >
          {monthOpts.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          className="icon-btn"
          title="Needs review"
          aria-label="Needs review"
          onClick={goReview}
        >
          ♧
          {reviewCount > 0 && <i className="dot" id="bellDot" />}
        </button>
        <button className="primary-btn" onClick={openCashModal}>
          ＋ Add cash spend
        </button>
      </div>
    </header>
  );
};