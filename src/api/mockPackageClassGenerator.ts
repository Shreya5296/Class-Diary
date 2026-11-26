import { MOCK_STUDENTS, MOCK_PACKAGES, MOCK_CLASSES, MOCK_SCHEDULES } from './mockDataInitial';
import { ClassSession } from '../domains/classes/classTypes';
import { WeeklyScheduleEntry } from '../domains/classes/scheduleApi';
import { parseCanonicalScheduleString } from '../domains/students/scheduleFormatter';
import { generateProposedSessions } from '../domains/classes/classGenerator';
import { getSessionStartTimestamp } from '../domains/classes/sessionFutureValidator';

export function handleMockGenerateForPackage(payload: Record<string, unknown>) {
  const sid = String(payload.student_id || '');
  const stu = MOCK_STUDENTS.find((s) => s.student_id === sid);
  const pkg = MOCK_PACKAGES.find((p) => p.student_id === sid && p.status === 'ACTIVE') || MOCK_PACKAGES.find((p) => p.student_id === sid);
  if (!pkg) {
    return { success: false, code: 'RECORD_NOT_FOUND', message: 'No package found for student' };
  }

  const classesList = MOCK_CLASSES as unknown as ClassSession[];
  const nowMs = payload.current_time ? new Date(payload.current_time as string | number).getTime() : Date.now();
  const now = new Date(nowMs);
  const todayStr = now.toISOString().slice(0, 10);

  if (payload.regenerate_future) {
    for (let i = classesList.length - 1; i >= 0; i--) {
      const c = classesList[i];
      if (c.student_id === sid) {
        const sStartMs = getSessionStartTimestamp(c, 'Asia/Kolkata');
        const isFuture = sStartMs !== null && sStartMs > nowMs;
        const isUncompleted = (c.session_status === 'SCHEDULED' || !c.session_status) && (c.attendance_status === 'NOT_MARKED' || !c.attendance_status);
        if (isFuture && isUncompleted) {
          classesList.splice(i, 1);
        }
      }
    }
  }

  const allStudentClasses = classesList.filter((c) => c.student_id === sid);
  const consumingStudentClasses = allStudentClasses.filter((c) => {
    const sStatus = String(c.session_status || c.status || '').toUpperCase();
    if (sStatus === 'CANCELLED') return false;
    const rawDeduct = (c as any).deduct_class;
    const isDeduct = rawDeduct === true || rawDeduct === 'true' || rawDeduct === 'TRUE';
    const sStartMs = getSessionStartTimestamp(c, 'Asia/Kolkata');
    const isFuture = sStartMs !== null && sStartMs > nowMs;
    const isFutureScheduled = (sStatus === 'SCHEDULED' || !sStatus) && (c.attendance_status === 'NOT_MARKED' || !c.attendance_status) && isFuture;
    return isFutureScheduled || isDeduct;
  });

  const totalPurchased = Number(pkg.classes_purchased || pkg.total_classes || 0);
  const classesNeeded = Math.max(0, totalPurchased - consumingStudentClasses.length);

  if (classesNeeded <= 0) {
    return {
      success: true, count: 0, createdCount: 0, totalPurchased, existingCount: consumingStudentClasses.length,
      lastClassDate: null, message: 'All package classes are already generated (0 new classes)',
    };
  }

  let scheds: WeeklyScheduleEntry[] = (MOCK_SCHEDULES[sid] as WeeklyScheduleEntry[]) || [];
  if ((!scheds || scheds.length === 0) && pkg.class_schedule) {
    scheds = parseCanonicalScheduleString(String(pkg.class_schedule), Number(pkg.class_duration) || 60);
  }
  if (!scheds || scheds.length === 0) {
    return { success: false, code: 'VALIDATION_ERROR', message: 'No weekly schedule configured' };
  }

  const pkgStartDate = pkg.start_date ? String(pkg.start_date) : '';
  const startDateStr = (!pkgStartDate || pkgStartDate < todayStr) ? todayStr : pkgStartDate;
  const proposed = generateProposedSessions(
    scheds, startDateStr, classesNeeded, allStudentClasses, sid, Number(pkg.class_duration) || 60
  );

  const lastClassDate = proposed.length > 0 ? proposed[proposed.length - 1].dateStr : null;

  if (payload.dry_run) {
    return {
      success: true, dry_run: true, count: proposed.length, createdCount: proposed.length,
      totalPurchased, existingCount: consumingStudentClasses.length, lastClassDate,
    };
  }

  const created: ClassSession[] = [];
  for (const p of proposed) {
    const newSession: ClassSession = {
      session_id: `${sid}__${p.dateStr}__${p.startTime}`,
      class_session_id: `${sid}__${p.dateStr}__${p.startTime}`,
      student_id: sid,
      student_name: stu?.student_name || 'Student',
      schedule_date: p.dateStr,
      schedule_time: p.startTime,
      start_time: p.startTime,
      scheduled_start: p.scheduledStart,
      scheduled_end: p.scheduledEnd,
      duration_minutes: p.durationMinutes,
      status: 'SCHEDULED',
      session_status: 'SCHEDULED',
      attendance_status: 'NOT_MARKED',
      deduct_class: false,
      class_credit_effect: 'PENDING',
      package_id: pkg.package_id ? String(pkg.package_id) : undefined,
    };
    classesList.push(newSession);
    created.push(newSession);
  }

  return {
    success: true, count: created.length, createdCount: created.length,
    totalPurchased, existingCount: consumingStudentClasses.length, lastClassDate, data: created,
  };
}
