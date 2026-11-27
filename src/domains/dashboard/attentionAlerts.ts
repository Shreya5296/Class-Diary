import { Student } from '../students/studentTypes';
import { toInputDateFormat } from '../../lib/dateFormat';
import { getLatestCompletedClassDate, isStudentActive } from '../students/studentStatusClassifier';
import {
  isSessionAttendanceOverdue, checkFeeAlert, formatAlertClassDate, checkPackageFeeAlert,
} from './attentionAlertsHelpers';
import { calculateStudentOutstanding } from '../finances/studentOutstanding';
import { getSessionDate } from '../classes/sessionTimeNormalizer';
import { AttentionAlert, AttentionAlertParams, AttentionCategory, AttentionUrgency } from './attentionAlertTypes';

export type { AttentionAlert, AttentionAlertParams, AttentionCategory, AttentionUrgency };

const SEV: Record<string, number> = { danger: 1, warning: 2, info: 3 };

export function generateAttentionAlerts(params: AttentionAlertParams): AttentionAlert[] {
  const {
    students = [], schedules = [], meetingLinks = [], packages = [],
    payments = [], sessions = [], fees = [], activeTz = 'Asia/Kolkata',
    referenceDateStr, currentTimestampMs = Date.now(),
  } = params;

  const todayKey = referenceDateStr || toInputDateFormat(new Date(currentTimestampMs), activeTz);
  const studentMap = new Map<string, Student>(students.map((s) => [s.student_id, s]));

  const activeStudents = students.filter((stu) => {
    const st = (stu.status || '').trim().toUpperCase();
    if (st === 'ARCHIVED' || st === 'INACTIVE') return false;
    if (sessions.length > 0) {
      const last = getLatestCompletedClassDate(sessions, stu.student_id, activeTz);
      if (!isStudentActive(stu, { lastCompletedDate: last, referenceDateStr: todayKey })) return false;
    }
    return true;
  });

  const alertsMap = new Map<string, AttentionAlert>();
  const packageFeeStudentIds = new Set<string>();

  // 1. Unmarked Attendance (Category C)
  for (const sess of sessions) {
    if (isSessionAttendanceOverdue(sess, currentTimestampMs, activeTz)) {
      const sid = sess.student_id;
      const sName = sess.student_name || studentMap.get(sid)?.student_name || sid;
      const sessId = sess.session_id || sess.class_session_id || `${sid}__${sess.schedule_date || ''}__${sess.schedule_time || ''}`;
      const rawDate = getSessionDate(sess, activeTz);
      alertsMap.set(`alert_att_${sessId}`, {
        id: `alert_att_${sessId}`, studentId: sid, studentName: sName,
        reason: 'Attendance not marked', severity: 'warning',
        actionLabel: 'Mark Attendance', targetSection: 'classes',
        student: studentMap.get(sid), category: 'attendance', urgency: 'pending',
        sessionId: sessId, session: sess, classDate: rawDate, formattedClassDate: formatAlertClassDate(rawDate),
      });
    }
  }

  // 2. Fee Reminders: Active student package outstanding check
  for (const stu of activeStudents) {
    const sid = stu.student_id;
    const sName = stu.student_name || stu.full_name || sid;
    const balances = calculateStudentOutstanding(packages, payments, sid);
    const outstandingBalances = balances.filter((b) => b.outstanding > 0);
    if (outstandingBalances.length === 0) continue;

    const stuPkgs = packages.filter((p) => p.student_id === sid && String(p.status || (p as any).package_status || '').toUpperCase() !== 'VOID' && String(p.status || (p as any).package_status || '').toUpperCase() !== 'CANCELLED');
    const dueDates = stuPkgs.map((p) => p.next_due_date).filter(Boolean) as string[];

    for (const b of outstandingBalances) {
      const res = checkPackageFeeAlert(b.outstanding, b.currency, dueDates, todayKey, activeTz);
      if (res) {
        alertsMap.set(`alert_fee_${sid}`, {
          id: `alert_fee_${sid}`, studentId: sid, studentName: sName,
          reason: res.reason, severity: res.severity, actionLabel: 'View Fees', targetSection: 'finances',
          student: stu, category: 'fee', urgency: res.urgency,
        });
        packageFeeStudentIds.add(sid);
        break;
      }
    }
  }

  // Legacy fees list fallback (skip if student already has a new package fee alert or is inactive/archived)
  for (const fee of fees) {
    const sid = fee.student_id || 'unknown';
    if (packageFeeStudentIds.has(sid)) continue;
    const student = studentMap.get(sid);
    const st = (student?.status || '').trim().toUpperCase();
    if (st === 'ARCHIVED' || st === 'INACTIVE') continue;
    const res = checkFeeAlert(fee, todayKey);
    if (res) {
      const sName = student?.student_name || fee.student_name || sid;
      const feeId = fee.fee_id || fee.id || `f_${sid}`;
      alertsMap.set(`alert_fee_${feeId}`, {
        id: `alert_fee_${feeId}`, studentId: sid, studentName: sName,
        reason: res.reason, severity: res.severity, actionLabel: 'View Fees', targetSection: 'finances',
        student: student, category: 'fee', urgency: res.urgency,
      });
    }
  }

  // Active student checks: Category A & Category D
  for (const stu of activeStudents) {
    const sid = stu.student_id;
    const sName = stu.student_name || stu.full_name || sid;
    const stuPkgs = packages.filter((p) => p.student_id === sid && p.status !== 'VOID' && p.status !== 'CANCELLED');
    if (stuPkgs.length > 0) {
      let totalPurchased = 0, totalConsumed = 0;
      for (const p of stuPkgs) {
        totalPurchased += Number(p.classes_purchased !== undefined ? p.classes_purchased : p.total_classes) || 0;
        totalConsumed += Number(p.consumed_classes !== undefined ? p.consumed_classes : p.classes_consumed) || 0;
      }
      const remaining = Math.max(0, totalPurchased - totalConsumed);
      if (remaining <= 3) {
        const reason = remaining === 0 ? 'No classes remaining — renewal required.' : `Only ${remaining} ${remaining === 1 ? 'class' : 'classes'} remaining — renewal pending.`;
        alertsMap.set(`alert_balance_${sid}`, {
          id: `alert_balance_${sid}`, studentId: sid, studentName: sName, reason,
          severity: remaining === 0 ? 'danger' : 'warning', actionLabel: 'Renew Package', targetSection: 'finances', student: stu,
          category: 'renewal', urgency: remaining === 0 ? 'critical' : 'pending',
        });
      }
    }

    const link = meetingLinks.find((l) => l.student_id === sid);
    const hasLink = Boolean((stu.primary_meeting_link && stu.primary_meeting_link.trim()) || link?.meeting_link_1?.trim() || link?.meeting_link_2?.trim() || link?.meeting_url?.trim());
    if (!hasLink) {
      alertsMap.set(`alert_link_${sid}`, {
        id: `alert_link_${sid}`, studentId: sid, studentName: sName, reason: 'Meeting link not configured',
        severity: 'warning', actionLabel: 'Configure Link', targetSection: 'students', student: stu, category: 'schedule', urgency: 'pending',
      });
    }

    if (!schedules.some((sch) => sch.student_id === sid && sch.is_active !== false)) {
      alertsMap.set(`alert_sched_${sid}`, {
        id: `alert_sched_${sid}`, studentId: sid, studentName: sName, reason: 'No class schedule configured',
        severity: 'warning', actionLabel: 'Set Schedule', targetSection: 'students', student: stu, category: 'schedule', urgency: 'pending',
      });
    }
  }

  return Array.from(alertsMap.values()).sort((a, b) => {
    const diff = (SEV[a.severity] ?? 9) - (SEV[b.severity] ?? 9);
    return diff !== 0 ? diff : a.studentName.localeCompare(b.studentName);
  });
}
