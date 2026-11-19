import { Period } from '@/types';

/**
 * Shared date and month utilities for budgeting and reporting.
 * Timezone: Africa/Addis_Ababa (UTC+3, no DST) for day-boundary math.
 * Stored dates are Gregorian. The pay cycle start day is configurable (1-28, default 7).
 * Transactions are stored at noon UTC on their Gregorian day, so UTC-midnight bounds compare correctly.
 */

const ET_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3, no DST

/** Y/M/D (1-based month) of the current moment in Ethiopia time. */
function todayETParts(asOf = new Date()): { y: number; m: number; d: number } {
  const et = new Date(asOf.getTime() + ET_OFFSET_MS);
  return { y: et.getUTCFullYear(), m: et.getUTCMonth() + 1, d: et.getUTCDate() };
}

export interface MonthBounds {
  month: string;           // YYYY-MM
  label: string;           // e.g. "7 Nov 2026 – 6 Dec 2026" (or "December 2026" when startDay=1)
  start: Date;             // cycle start day 00:00:00 UTC
  end: Date;               // cycle end day 23:59:59.999 UTC (day before next cycle start)
  daysInMonth: number;     // calendar days in the labeled month
  daysInCycle: number;     // length of the cycle
}

export interface MonthProgress {
  month: string;
  label: string;
  asOf: Date;
  daysElapsed: number;          // 1-based day of cycle at `asOf`
  daysInMonth: number;          // cycle length (== calendar length when startDay=1)
  daysLeft: number;             // daysInMonth - daysElapsed (>= 0)
  elapsedPct: number;           // daysElapsed / daysInMonth * 100, integer 0-100
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

function shortMonth(mIndex0: number): string {
  return MONTH_NAMES[mIndex0].slice(0, 3);
}

/** Clamp the cycle start day to 1-28. */
export function clampStartDay(startDay?: number | null): number {
  const n = Number(startDay);
  if (!Number.isFinite(n) || n < 1) return 7;
  return Math.min(28, Math.floor(n)) || 7;
}

/**
 * Current cycle month key (YYYY-MM). If the ET calendar day is before the
 * cycle start day, the ongoing cycle belongs to the previous calendar month.
 */
export function currentMonthKey(asOf = new Date(), startDay = 7): string {
  const s = clampStartDay(startDay);
  const { y, m, d } = todayETParts(asOf);
  let cy = y, cm = m;
  if (d < s) {
    cm = m - 1;
    if (cm < 1) { cm = 12; cy = y - 1; }
  }
  return `${cy}-${String(cm).padStart(2, '0')}`;
}

export function monthBounds(month: string = currentMonthKey(), startDay = 7): MonthBounds {
  const s = clampStartDay(startDay);
  const [rawY, rawM] = month.split('-').map(Number);
  const y = Number.isFinite(rawY) ? rawY : new Date().getUTCFullYear();
  const m = Number.isFinite(rawM) ? Math.max(1, Math.min(12, rawM)) : new Date().getUTCMonth() + 1;
  const start = new Date(Date.UTC(y, m - 1, s, 0, 0, 0, 0));
  let nm = m + 1, ny = y;
  if (nm > 12) { nm = 1; ny = y + 1; }
  const end = new Date(Date.UTC(ny, nm - 1, s, 0, 0, 0, 0) - 1);
  const daysInCycle = Math.round((end.getTime() - start.getTime() + 1) / 86400000);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getDate();
  const key = `${y}-${String(m).padStart(2, '0')}`;
  const label = s === 1
    ? monthLabel(key)
    : `${s} ${shortMonth(m - 1)} ${y} – ${end.getUTCDate()} ${shortMonth(end.getUTCMonth())} ${end.getUTCFullYear()}`;
  return { month: key, label, start, end, daysInMonth, daysInCycle };
}

export function monthProgress(month: string, startDay = 7, asOf = new Date()): MonthProgress {
  const s = clampStartDay(startDay);
  const bounds = monthBounds(month, s);
  const asOfParts = todayETParts(asOf);
  const asOfUtc = Date.UTC(asOfParts.y, asOfParts.m - 1, asOfParts.d);
  const startUtc = Date.UTC(bounds.start.getUTCFullYear(), bounds.start.getUTCMonth(), bounds.start.getUTCDate());
  const endUtc = Date.UTC(bounds.end.getUTCFullYear(), bounds.end.getUTCMonth(), bounds.end.getUTCDate());

  let daysElapsed: number;
  let state: MonthProgress['state'];
  if (asOfUtc < startUtc) {
    daysElapsed = 0;
    state = 'future';
  } else if (asOfUtc > endUtc) {
    daysElapsed = bounds.daysInCycle;
    state = 'past';
  } else {
    daysElapsed = Math.floor((asOfUtc - startUtc) / 86400000) + 1;
    state = 'current';
  }

  const daysLeft = Math.max(0, bounds.daysInCycle - daysElapsed);
  const elapsedPct = bounds.daysInCycle > 0 ? Math.min(100, Math.round((daysElapsed / bounds.daysInCycle) * 100)) : 0;

  return {
    month: bounds.month,
    label: bounds.label,
    asOf,
    daysElapsed,
    daysInMonth: bounds.daysInCycle,
    daysLeft,
    elapsedPct,
    state,
  };
}

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

/** Today's ISO date (YYYY-MM-DD) in Ethiopia time. */
export function todayISO(asOf = new Date()): string {
  const { y, m, d } = todayETParts(asOf);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Whole calendar days between two instants, counted in Ethiopia-time calendar
 * days (ignore times of day). Negative when `to` is before `from`.
 */
export function etDaysBetween(from: Date, to: Date = new Date()): number {
  const fromDay = Date.parse(`${todayISO(from)}T00:00:00Z`);
  const toDay = Date.parse(`${todayISO(to)}T00:00:00Z`);
  return Math.floor((toDay - fromDay) / 86400000);
}

/**
 * Up to `count` most recent completed cycle keys (YYYY-MM), newest first.
 * The current (ongoing) cycle is never included.
 */
export function completedCycleKeys(asOf = new Date(), startDay = 7, count = 3): string[] {
  const cur = currentMonthKey(asOf, startDay);
  let [y, m] = cur.split('-').map(Number);
  const keys: string[] = [];
  while (keys.length < count && y > 1970) {
    m -= 1;
    if (m < 1) { m = 12; y -= 1; }
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return keys;
}

/**
 * Most recent completed cycles that are eligible for averages. A cycle is
 * eligible only when it started on or after the first recorded transaction
 * (ET calendar day) — history that began mid-cycle cannot supply a full
 * cycle of data. Newest first.
 */
export function eligibleCycleKeys(
  firstTransactionDate: Date | null,
  asOf = new Date(),
  startDay = 7,
  count = 3
): string[] {
  if (!firstTransactionDate) return [];
  const firstISO = todayISO(firstTransactionDate);
  return completedCycleKeys(asOf, startDay, count).filter(
    (key) => todayISO(monthBounds(key, startDay).start) >= firstISO
  );
}

const dayStartUTC = (isoDate: string): Date => new Date(`${isoDate}T00:00:00.000Z`);
const dayEndUTC = (isoDate: string): Date => new Date(`${isoDate}T23:59:59.999Z`);

export function parsePeriodToBounds(
  period: Period,
  dateFrom?: string | null,
  dateTo?: string | null,
  startDay = 7
): { from: Date; to: Date } {
  const s = clampStartDay(startDay);
  const { y, m, d } = todayETParts();
  const todayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const todayEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

  switch (period) {
    case 'today':
      return { from: todayStart, to: todayEnd };
    case 'week': {
      const from = new Date(todayStart.getTime() - 6 * 86400000);
      return { from, to: todayEnd };
    }
    case 'month': {
      const key = currentMonthKey(new Date(), s);
      const bounds = monthBounds(key, s);
      return { from: bounds.start, to: bounds.end };
    }
    case 'year':
      return { from: new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0)), to: todayEnd };
    case 'custom': {
      const from = dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ? dayStartUTC(dateFrom) : new Date(Date.UTC(1970, 0, 1));
      const to = dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? dayEndUTC(dateTo) : new Date(Date.UTC(2099, 11, 31, 23, 59, 59, 999));
      return { from, to };
    }
    default:
      return { from: new Date(Date.UTC(1970, 0, 1)), to: new Date(Date.UTC(2099, 11, 31, 23, 59, 59, 999)) };
  }
}
