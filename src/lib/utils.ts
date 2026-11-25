import { Transaction } from '@/types';
import { monthProgress, todayISO, currentMonthKey } from './dates';

export const fmt = (n: number | string): string =>
  'ETB ' +
  Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const money = (n: number | string): string =>
  'ETB ' +
  Number(n || 0).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  });

export const mins = (t?: string | null): number => {
  const x = /(\d+):(\d+)\s*(AM|PM)/i.exec(t || '');
  return x
    ? ((+x[1] % 12) + (x[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + +x[2]
    : 0;
};

export const key = (t: { date: string; time?: string | null }): string =>
  (t.date || '').slice(0, 10) + String(mins(t.time)).padStart(4, '0');

export const nowT = (): string =>
  new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export const fdate = (t: { date: string; time?: string | null }): string => {
  const dStr = (t.date || '').slice(0, 10);
  const today = todayISO();
  if (dStr === today) {
    return 'Today, ' + (t.time || '');
  }
  try {
    const d = new Date(dStr + 'T12:00:00');
    return (
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      (t.time ? ', ' + t.time : '')
    );
  } catch {
    return dStr + (t.time ? ', ' + t.time : '');
  }
};

export const cls = (short: string): string =>
  ({ BOA: 'boa', CBE: 'cbe', Telebirr: 'tele' })[short] || 'cash';

/** @deprecated Use monthProgress from '@/lib/dates' instead */
export const elapsed = (curMonth: string = currentMonthKey(), startDay = 7): number => {
  const prog = monthProgress(curMonth, startDay);
  return prog.elapsedPct / 100;
};

/** @deprecated Use monthProgress from '@/lib/dates' instead */
export const daysLeft = (curMonth: string = currentMonthKey(), startDay = 7): number => {
  const prog = monthProgress(curMonth, startDay);
  return prog.daysLeft;
};

export const escapeHTML = (v: unknown): string => {
  const AMP = String.fromCharCode(38); // &
  const map: Record<string, string> = {
    [AMP]: AMP + 'amp;',
    '<': AMP + 'lt;',
    '>': AMP + 'gt;',
    '"': AMP + 'quot;',
    "'": AMP + '#39;',
  };
  return String(v ?? '').replace(/[&<>"']/g, (ch) => map[ch] || ch);
};

export const csvCell = (v: unknown): string =>
  '"' + String(v ?? '').replace(/"/g, '""') + '"';

export const downloadBlob = (
  content: string,
  name: string,
  type: string
): void => {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  // Defer revoke to allow the download to start
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const accountShort = (
  account?: Transaction['account'] | string | null
): string => {
  if (!account) return 'Cash';
  return typeof account === 'string' ? account : account.short || account.name || 'Cash';
};

/**
 * Label for the account column. Two-row transfers (BOA out + Telebirr in) have
 * no toAccount, so derive the counterparty from the linked group — or from the
 * name ("Transfer to Telebirr") when the sibling is filtered out.
 */
export const transferAccountLabel = (
  t: Transaction,
  all?: Transaction[]
): string => {
  const acct = accountShort(t.account);
  if (t.type !== 'transfer') return acct;

  if (t.toAccount) {
    return `${acct} → ${accountShort(t.toAccount)}`;
  }

  if (t.transferGroupId && all) {
    const sibling = all.find(
      (x) =>
        x.id !== t.id &&
        x.transferGroupId === t.transferGroupId &&
        x.type === 'transfer' &&
        x.accountId !== t.accountId
    );
    if (sibling) {
      const other = accountShort(sibling.account);
      return t.transferDirection === 'in'
        ? `${acct} ← ${other}`
        : `${acct} → ${other}`;
    }
  }

  const match = /^Transfer (to|from)\s+(.+)$/i.exec(t.name || '');
  if (match) {
    return match[1].toLowerCase() === 'to'
      ? `${acct} → ${match[2]}`
      : `${acct} ← ${match[2]}`;
  }

  return acct;
};

export const rawSMS = (t: {
  date: string;
  time?: string | null;
  account?: string | { short?: string; name?: string };
  name: string;
  amount: number;
  type: string;
}): string => {
  const dStr = (t.date || '').slice(0, 10);
  const d = dStr.split('-').reverse().join('/');
  const a = Number(t.amount).toFixed(2);
  const acct =
    typeof t.account === 'string'
      ? t.account
      : t.account?.short || t.account?.name || 'Cash';

  if (acct === 'Cash') {
    return 'Manual entry. Cash purchases have no SMS.';
  }
  if (acct === 'Telebirr') {
    if (t.type === 'income') {
      return `You have received ETB ${a} from ${t.name} on ${d} ${t.time || ''}.`;
    }
    if (t.type === 'transfer') {
      return `You have received ETB ${a} by transaction number ${t.name} on ${d} ${t.time || ''}.`;
    }
    return `You have paid ETB ${a} to ${t.name} on ${d} ${t.time || ''}.`;
  }
  if (t.type === 'transfer') {
    return `Internal transfer of ETB ${a} on ${d} ${t.time || ''}.`;
  }
  return `Your account has been ${
    t.type === 'income' ? 'credited' : 'debited'
  } with ETB ${a}. Ref: ${t.name}. ${d} ${t.time || ''}.`;
};