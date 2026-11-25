import { getSavedTimezone } from './userPreferences';

function parseIsoDate(isoString: string | null | undefined): Date | null {
  if (!isoString) return null;
  const clean = String(isoString).trim().replace(/T\s+(\d:)/, 'T0$1');
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(isoString: string | null | undefined, timeZone?: string): string {
  if (!isoString) return '—';
  if (typeof isoString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoString.trim())) {
    const [yStr, mStr, dStr] = isoString.trim().split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const d = parseInt(dStr, 10);
    if (m < 1 || m > 12 || d < 1 || d > 31) return '—';
    const checkDate = new Date(Date.UTC(y, m - 1, d));
    if (isNaN(checkDate.getTime()) || checkDate.getUTCDate() !== d || checkDate.getUTCMonth() !== m - 1) {
      return '—';
    }
    return `${dStr}-${mStr}-${yStr}`;
  }
  const date = parseIsoDate(isoString);
  if (!date) return '—';
  try {
    const tz = timeZone || getSavedTimezone();
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return formatter.format(date).replace(/\//g, '-');
  } catch {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
  }
}

export function formatDateTime(isoString: string | null | undefined, timeZone?: string): string {
  const date = parseIsoDate(isoString);
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: timeZone || getSavedTimezone(),
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return '—';
  }
}

export function formatTimeOnly(isoString: string | null | undefined, timeZone?: string): string {
  const date = parseIsoDate(isoString);
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: timeZone || getSavedTimezone(),
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return '—';
  }
}

export function toInputDateFormat(date: Date = new Date(), timeZone?: string): string {
  try {
    const tz = timeZone || getSavedTimezone();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}

export function isPastDate(dateString: string): boolean {
  if (!dateString) return false;
  const target = new Date(dateString);
  const now = new Date();
  return target.getTime() < now.getTime();
}

export function formatDateDdMmYyyy(input: string | Date | null | undefined): string {
  if (!input) return '—';
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    const [y, m, d] = input.trim().split('-');
    return `${d}/${m}/${y}`;
  }
  const date = input instanceof Date ? input : parseIsoDate(input);
  if (!date) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}
