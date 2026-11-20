/**
 * Accounting and occurrence calculations for one-time extra classes.
 * Preserves the total package commitment by safely suppressing the final
 * future recurring occurrence when an extra class is scheduled.
 */
import { ClassSession } from '../classes/classTypes';
import { Package } from '../packages/packageTypes';
import { WeeklyScheduleEntry, cleanTime } from '../classes/scheduleApi';

const DAY_MAP: Record<string, number> = {
  SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
};

export function isSessionDeductibleOrConsumed(session: ClassSession): boolean {
  if (session.deduct_class === true) return true;
  const sStatus = (session.session_status || session.status || '').toUpperCase();
  const aStatus = (session.attendance_status || '').toUpperCase();
  if (sStatus === 'CANCELLED' || aStatus === 'CANCELLED' || sStatus === 'SCHEDULED' || aStatus === 'NOT_MARKED') return false;
  if (sStatus === 'COMPLETED' || aStatus === 'PRESENT' || aStatus === 'ATTENDED') return session.deduct_class !== false;
  return false;
}

export function getPackageRemainingCredits(pkg: Package, sessions: ClassSession[], allPackages: Package[] = []): number {
  const sid = pkg.student_id;
  if (!sid) return 0;
  const studentPkgs = (allPackages.length > 0 ? allPackages : [pkg])
    .filter((p) => p.student_id === sid)
    .sort((a, b) => String(a.start_date || a.package_id || '').localeCompare(String(b.start_date || b.package_id || '')));

  const stuSessions = sessions.filter((s) => s.student_id === sid);
  const totalConsumed = stuSessions.filter(isSessionDeductibleOrConsumed).length;
  let remainingToDeduct = totalConsumed;
  let allocatedForThisPkg = 0;

  for (const sp of studentPkgs) {
    const spPurchased = Number(sp.classes_purchased !== undefined ? sp.classes_purchased : sp.total_classes) || 0;
    const allocated = Math.min(remainingToDeduct, spPurchased);
    const isTarget = (sp.package_id && pkg.package_id && sp.package_id === pkg.package_id) ||
      (sp.start_date && pkg.start_date && sp.start_date === pkg.start_date) || (studentPkgs.length === 1);
    if (isTarget) { allocatedForThisPkg = allocated; break; }
    remainingToDeduct = Math.max(0, remainingToDeduct - allocated);
  }
  const pkgPurchased = Number(pkg.classes_purchased !== undefined ? pkg.classes_purchased : pkg.total_classes) || 0;
  return Math.max(0, pkgPurchased - allocatedForThisPkg);
}

export function getStudentTotalRemainingCredits(studentId: string, packages: Package[], sessions: ClassSession[]): number {
  const studentPkgs = packages.filter((p) => p.student_id === studentId);
  if (!studentPkgs.length) return 0;
  const totalPurchased = studentPkgs.reduce((acc, p) => acc + (Number(p.classes_purchased !== undefined ? p.classes_purchased : p.total_classes) || 0), 0);
  const totalConsumed = sessions.filter((s) => s.student_id === studentId && isSessionDeductibleOrConsumed(s)).length;
  return Math.max(0, totalPurchased - totalConsumed);
}

export function getScheduledExtraClassCount(studentId: string, sessions: ClassSession[], todayStr: string): number {
  return sessions.filter((s) => {
    if (s.student_id !== studentId) return false;
    const sStatus = (s.session_status || s.status || '').toUpperCase();
    const aStatus = (s.attendance_status || '').toUpperCase();
    if (sStatus === 'CANCELLED' || aStatus === 'CANCELLED' || sStatus === 'COMPLETED' || aStatus === 'PRESENT') return false;
    const dStr = s.schedule_date || s.class_date || (s.scheduled_start ? s.scheduled_start.slice(0, 10) : '');
    return dStr >= todayStr || sStatus === 'SCHEDULED';
  }).length;
}

export function computeAllowedFutureRecurringDates(params: {
  todayStr: string; recurringDays: string[]; maxCount: number; replacedDates?: Set<string>;
}): string[] {
  const { todayStr, recurringDays, maxCount, replacedDates = new Set() } = params;
  if (maxCount <= 0 || !recurringDays.length || !todayStr) return [];
  const days = recurringDays.map((d) => DAY_MAP[d.trim().toUpperCase()]).filter((d) => d !== undefined);
  if (!days.length) return [];

  const [y, m, d] = todayStr.split('-').map(Number);
  const curr = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dates: string[] = [];
  let safety = 0;

  while (dates.length < maxCount && safety < 500) {
    if (days.includes(curr.getUTCDay())) {
      const cy = curr.getUTCFullYear();
      const cm = String(curr.getUTCMonth() + 1).padStart(2, '0');
      const cd = String(curr.getUTCDate()).padStart(2, '0');
      const dateString = `${cy}-${cm}-${cd}`;
      if (!replacedDates.has(dateString)) dates.push(dateString);
    }
    curr.setUTCDate(curr.getUTCDate() + 1);
    safety++;
  }
  return dates;
}

export function buildRecurringSuppressionMap(params: {
  packages: Package[]; recurringSchedules: WeeklyScheduleEntry[]; datedSessions: ClassSession[]; todayStr: string;
}): Map<string, string> {
  const { packages, recurringSchedules, datedSessions, todayStr } = params;
  const suppressionMap = new Map<string, string>();
  const studentIds = Array.from(new Set(packages.map((p) => p.student_id).filter(Boolean)));

  for (const sid of studentIds) {
    const studentScheds = recurringSchedules.filter((s) => s.student_id === sid && s.is_active !== false);
    const recurringDays = studentScheds.map((s) => s.day_of_week).filter(Boolean);
    if (!recurringDays.length) continue;

    const totalRemaining = getStudentTotalRemainingCredits(sid, packages, datedSessions);
    const extraClassesScheduled = getScheduledExtraClassCount(sid, datedSessions, todayStr);
    const allowedFutureRecurring = Math.max(0, totalRemaining - extraClassesScheduled);
    if (allowedFutureRecurring === 0) {
      suppressionMap.set(sid, '1970-01-01');
      continue;
    }

    const replacedDates = new Set<string>();
    for (const ds of datedSessions) {
      if (ds.student_id !== sid) continue;
      const sStatus = (ds.session_status || ds.status || '').toUpperCase();
      if (sStatus === 'CANCELLED') continue;
      const dStr = ds.schedule_date || ds.class_date || (ds.scheduled_start ? ds.scheduled_start.slice(0, 10) : '');
      const dTime = cleanTime(ds.schedule_time || ds.start_time || (ds.scheduled_start ? ds.scheduled_start.slice(11, 16) : ''));
      if (studentScheds.some((sch) => sch.day_of_week && DAY_MAP[sch.day_of_week.toUpperCase()] === new Date(dStr + 'T12:00:00Z').getUTCDay() && cleanTime(sch.start_time) === dTime)) {
        replacedDates.add(dStr);
      }
    }

    const futureDates = computeAllowedFutureRecurringDates({ todayStr, recurringDays, maxCount: allowedFutureRecurring, replacedDates });
    if (futureDates.length > 0) suppressionMap.set(sid, futureDates[futureDates.length - 1]);
  }

  return suppressionMap;
}
