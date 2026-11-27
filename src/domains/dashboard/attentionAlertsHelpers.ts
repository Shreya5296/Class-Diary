import { ClassSession } from '../classes/classTypes';
import { formatCurrency } from '../../lib/currencyFormat';
import { toInputDateFormat } from '../../lib/dateFormat';
import { getSessionStartTimestamp } from '../classes/sessionFutureValidator';

export function isSessionAttendanceOverdue(
  session: ClassSession,
  nowMs: number,
  activeTz = 'Asia/Kolkata'
): boolean {
  const sStatus = (session.session_status || session.status || '').toUpperCase();
  const aStatus = (session.attendance_status || '').toUpperCase();
  if (sStatus === 'CANCELLED' || aStatus === 'CANCELLED') return false;
  if (
    sStatus === 'COMPLETED' ||
    aStatus === 'ATTENDED' ||
    aStatus === 'PRESENT' ||
    aStatus === 'NO_SHOW' ||
    aStatus.startsWith('ABSENT')
  ) {
    return false;
  }
  const startMs = getSessionStartTimestamp(session, activeTz);
  if (startMs === null) return false;
  const durMin = Number(session.duration_minutes) || 60;
  const endMs = startMs + durMin * 60 * 1000;
  return nowMs > endMs;
}

export interface FeeAlertCheckResult {
  isAlert: boolean;
  reason: string;
  severity: 'danger' | 'warning';
  urgency: 'critical' | 'upcoming';
}

export function checkFeeAlert(
  fee: { fee_id?: string; id?: string; amount_due?: number; outstanding_balance?: number; status?: string; due_date?: string; currency?: string },
  todayKey: string
): FeeAlertCheckResult | null {
  const status = (fee.status || '').toUpperCase();
  if (status === 'PAID' || status === 'CANCELLED' || status === 'VOID') return null;
  const amt = Number(fee.outstanding_balance ?? fee.amount_due ?? 0);
  if (amt <= 0 && status !== 'OVERDUE') return null;

  const cur = fee.currency || 'INR';
  const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : '₹';
  const amtStr = `${sym}${amt.toLocaleString()}`;
  const dueDate = fee.due_date ? String(fee.due_date).slice(0, 10) : '';

  if (!dueDate || dueDate < todayKey || status === 'OVERDUE') {
    if (status === 'OVERDUE' || (dueDate && dueDate < todayKey)) {
      return { isAlert: true, reason: `Fee overdue: ${amtStr}`, severity: 'danger', urgency: 'critical' };
    }
    return null;
  }

  // Changed window from 7 days to 10 calendar days
  const todayMs = new Date(todayKey).getTime();
  const dueMs = new Date(dueDate).getTime();
  const diffDays = Math.round((dueMs - todayMs) / (1000 * 60 * 60 * 24));
  if (diffDays >= 0 && diffDays <= 10) {
    return { isAlert: true, reason: `Fee due on ${dueDate}: ${amtStr}`, severity: 'warning', urgency: 'upcoming' };
  }
  return null;
}

export function formatAlertClassDate(dateKey?: string): string {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey.trim())) return '';
  const [y, m, d] = dateKey.trim().split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(utcDate);
  } catch {
    return dateKey;
  }
}

export interface PackageFeeAlertResult {
  isAlert: boolean;
  reason: string;
  severity: 'danger' | 'warning';
  urgency: 'critical' | 'pending';
}

export function formatAlertDdMmYyyy(dateStr: string, activeTz: string = 'Asia/Kolkata'): string {
  const s = String(dateStr || '').trim();
  const clean = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? s
    : (!isNaN(new Date(s).getTime()) ? toInputDateFormat(new Date(s), activeTz) : s.slice(0, 10));
  const parts = clean.split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : clean;
}

export function checkPackageFeeAlert(
  outstanding: number, currency: string, dueDates: string[], todayKey: string, activeTz: string = 'Asia/Kolkata'
): PackageFeeAlertResult | null {
  if (outstanding <= 0) return null;
  const formattedAmt = formatCurrency(outstanding, true, currency);
  const validDates = dueDates
    .map((d) => {
      const s = String(d || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const dt = new Date(s);
      return !isNaN(dt.getTime()) ? toInputDateFormat(dt, activeTz) : '';
    })
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();

  if (validDates.length === 0) {
    return { isAlert: true, reason: `Fee outstanding: ${formattedAmt} (no due date set)`, severity: 'warning', urgency: 'pending' };
  }

  const earliestDue = validDates[0];
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const [dy, dm, dd] = earliestDue.split('-').map(Number);
  const diffDays = Math.round((Date.UTC(dy, dm - 1, dd) - Date.UTC(ty, tm - 1, td)) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    return { isAlert: true, reason: `Fee overdue: ${formattedAmt} (was due ${formatAlertDdMmYyyy(earliestDue, activeTz)})`, severity: 'danger', urgency: 'critical' };
  }
  if (diffDays <= 10) {
    return { isAlert: true, reason: `Fee due in ${diffDays} days: ${formattedAmt}`, severity: 'warning', urgency: 'pending' };
  }
  return null;
}
