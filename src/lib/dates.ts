import { Period } from '@/types';

/**
 * Shared date and month utilities for budgeting and reporting.
 * All functions use the real system clock unless an explicit `asOf` date is provided.
 */

export interface MonthBounds {
  month: string;           // YYYY-MM
  label: string;           // e.g. "November 2026"
  start: Date;             // First day 00:00:00 UTC
  end: Date;               // Last day 23:59:59.999 UTC
  daysInMonth: number;
}

export interface MonthProgress {
  month: string;
  label: string;
  asOf: Date;
  daysElapsed: number;          // 1-based day of month at `asOf`
  daysInMonth: number;
  daysLeft: number;             // daysInMonth - daysElapsed (>= 0)
  elapsedPct: number;           // daysElapsed / daysInMonth * 100, clamped 0-100
  state: 'future' | 'current' | 'past';
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return month;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function currentMonthKey(asOf = new Date()): string {
  return `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, '0')}`;
}

export function monthBounds(month: string = currentMonthKey()): MonthBounds {
  const [y, m] = month.split('-').map(Number);
  const year = Number.isFinite(y) ? y : new Date().getFullYear();
  const monthNum = Number.isFinite(m) ? Math.max(1, Math.min(12, m)) : new Date().getMonth() + 1;
  const start = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  return { month: `${year}-${String(monthNum).padStart(2, '0')}`, label: monthLabel(`${year}-${String(monthNum).padStart(2, '0')}`), start, end, daysInMonth };
}

export function monthProgress(month: string, asOf = new Date()): MonthProgress {
  const bounds = monthBounds(month);
  const asOfUtc = new Date(Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()));
  const startUtc = new Date(Date.UTC(bounds.start.getUTCFullYear(), bounds.start.getUTCMonth(), bounds.start.getUTCDate()));
  const endUtc = new Date(Date.UTC(bounds.end.getUTCFullYear(), bounds.end.getUTCMonth(), bounds.end.getUTCDate()));

  let daysElapsed: number;
  let state: MonthProgress['state'];

  if (asOfUtc < startUtc) {
    daysElapsed = 0;
    state = 'future';
  } else if (asOfUtc > endUtc) {
    daysElapsed = bounds.daysInMonth;
    state = 'past';
  } else {
    const diffMs = asOfUtc.getTime() - startUtc.getTime();
    daysElapsed = Math.floor(diffMs / 86400000) + 1; // 1-based
    state = 'current';
  }

  const daysLeft = Math.max(0, bounds.daysInMonth - daysElapsed);
  const elapsedPct = bounds.daysInMonth > 0 ? Math.min(100, Math.round((daysElapsed / bounds.daysInMonth) * 100)) : 0;

  return {
    month: bounds.month,
    label: bounds.label,
    asOf,
    daysElapsed,
    daysInMonth: bounds.daysInMonth,
    daysLeft,
    elapsedPct,
    state,
  };
}

/**
 * Return the last 12 months including the current month, most recent first.
 * Each entry is { value: 'YYYY-MM', label: 'Month YYYY' }.
 */
export function monthOptions(asOf = new Date()): { value: string; label: string }[] {
  const cur = currentMonthKey(asOf);
  const opts: { value: string; label: string }[] = [];
  const [y, m] = cur.split('-').map(Number);
  for (let i = 0; i < 12; i++) {
    const mm = m - i;
    const yy = y + Math.floor((mm - 1) / 12);
    const adjMonth = ((mm - 1) % 12) + 1;
    const val = `${yy}-${String(adjMonth).padStart(2, '0')}`;
    opts.push({ value: val, label: monthLabel(val) });
  }
  return opts;
}

export function todayISO(asOf = new Date()): string {
  return asOf.toISOString().slice(0, 10);
}

export function parsePeriodToBounds(period: Period, dateFrom?: string, dateTo?: string, asOf = new Date()): { from: Date; to: Date } {
  const now = new Date(asOf);
  const startOfDay = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
  const endOfDay = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999));

  let from: Date, to: Date;

  switch (period) {
    case 'today':
      from = startOfDay(now);
      to = endOfDay(now);
      break;
    case 'week':
      from = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
      to = endOfDay(now);
      break;
    case 'month':
      from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      to = endOfDay(now);
      break;
    case 'year':
      from = startOfDay(new Date(now.getFullYear(), 0, 1));
      to = endOfDay(now);
      break;
    case 'custom':
      from = dateFrom ? startOfDay(new Date(`${dateFrom}T00:00:00Z`)) : new Date(1970, 0, 1);
      to = dateTo ? endOfDay(new Date(`${dateTo}T23:59:59Z`)) : new Date(2099, 11, 31);
      break;
    default:
      from = new Date(1970, 0, 1);
      to = new Date(2099, 11, 31);
  }
  return { from, to };
}