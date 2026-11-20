import { ClassSession } from '../classes/classTypes';

export function isSessionAttendanceOverdue(
  session: ClassSession,
  nowMs: number,
  _activeTz = 'Asia/Kolkata'
): boolean {
  const sStatus = (session.session_status || session.status || '').toUpperCase();
  const aStatus = (session.attendance_status || '').toUpperCase();
  if (sStatus === 'CANCELLED' || aStatus === 'CANCELLED') return false;
  if (sStatus === 'COMPLETED' || aStatus === 'ATTENDED' || aStatus === 'PRESENT' || aStatus === 'NO_SHOW' || aStatus.startsWith('ABSENT')) {
    return false;
  }

  let startMs: number | null = null;
  const rawStart = session.scheduled_start || session.start_time;
  if (rawStart && String(rawStart).includes('T')) {
    const d = new Date(rawStart);
    if (!isNaN(d.getTime())) startMs = d.getTime();
  } else {
    const dateStr = session.schedule_date || session.class_date;
    const timeStr = session.schedule_time || session.start_time;
    if (dateStr && timeStr) {
      const d = new Date(`${String(dateStr).trim()}T${String(timeStr).trim()}:00`);
      if (!isNaN(d.getTime())) startMs = d.getTime();
    }
  }

  if (startMs === null) return false;
  const durationMin = Number(session.duration_minutes) || 60;
  const endMs = startMs + durationMin * 60 * 1000;
  const gracePeriodMs = 15 * 60 * 1000; // 15-minute grace period
  return nowMs > endMs + gracePeriodMs;
}

export interface FeeAlertCheckResult {
  isAlert: boolean;
  reason: string;
  severity: 'danger' | 'warning';
  urgency: 'critical' | 'upcoming';
}

export function checkFeeAlert(
  fee: {
    fee_id?: string;
    id?: string;
    amount_due?: number;
    outstanding_balance?: number;
    status?: string;
    due_date?: string;
    currency?: string;
  },
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
  if (!dueDate) {
    if (status === 'OVERDUE') {
      return { isAlert: true, reason: `Fee overdue: ${amtStr}`, severity: 'danger', urgency: 'critical' };
    }
    return null;
  }

  if (dueDate < todayKey || status === 'OVERDUE') {
    return { isAlert: true, reason: `Fee overdue: ${amtStr}`, severity: 'danger', urgency: 'critical' };
  }

  // Check if within 7 calendar days
  const todayMs = new Date(todayKey).getTime();
  const dueMs = new Date(dueDate).getTime();
  const diffDays = Math.round((dueMs - todayMs) / (1000 * 60 * 60 * 24));

  if (diffDays >= 0 && diffDays <= 7) {
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
