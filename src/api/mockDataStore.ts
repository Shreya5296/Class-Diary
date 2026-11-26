import { ApiResponse } from './apiResponse';
import {
  MOCK_STUDENTS, MOCK_FEES, MOCK_PAYMENTS, MOCK_CLASSES,
  MOCK_PACKAGES, MOCK_NOTES, MOCK_SCHEDULES, createMockStudent,
  updateMockPackage, scheduleMockClass,
} from './mockDataInitial';
import {
  handleMockClassRecordAttendance,
  handleMockClassCancel,
  handleMockClassRestoreCredit,
  handleMockClassUpdate,
} from './mockClassOperations';
import { handleMockRenewal } from './mockRenewalOperations';
import { handleMockGenerateForPackage } from './mockPackageClassGenerator';
import { handleMockCreatePackage, handleMockRecordPayment } from './mockFinancialOperations';

export function handleMockApiRequest<T>(operation: string, payload: Record<string, unknown>, reqId: string): ApiResponse<T> {
  const meta = { requestId: reqId, timestamp: new Date().toISOString() };
  if (operation === 'dashboard.overview') {
    return { ok: true, data: { activeStudentsCount: 3, classesUpcoming7Days: 2, outstandingFeesTotal: 50000, currency: 'INR' } as T, meta };
  }
  if (operation === 'dashboard.combined') {
    return {
      ok: true,
      data: {
        overview: { activeStudentsCount: 3, classesUpcoming7Days: 2, outstandingFeesTotal: 50000, currency: 'INR' },
        classes: MOCK_CLASSES, schedules: Object.values(MOCK_SCHEDULES).flat(),
        students: MOCK_STUDENTS, packages: MOCK_PACKAGES, fees: MOCK_FEES,
      } as T,
      meta,
    };
  }
  if (operation === 'finances.combined') {
    return {
      ok: true,
      data: {
        summary: { totalInvoiced: 216800, totalBilled: 216800, totalCollected: 166800, totalReceived: 166800, totalOutstanding: 50000, currency: 'INR' },
        payments: MOCK_PAYMENTS, packages: MOCK_PACKAGES,
      } as T,
      meta,
    };
  }
  if (operation === 'students.list') {
    const q = String(payload.query || '').toLowerCase();
    const st = String(payload.status || '');
    let res = [...MOCK_STUDENTS];
    if (st) res = res.filter(s => s.status === st);
    if (q) res = res.filter(s => s.student_name.toLowerCase().includes(q) || s.student_email.toLowerCase().includes(q));
    return { ok: true, data: res as T, meta };
  }
  if (operation === 'students.create') {
    return { ok: true, data: createMockStudent(payload) as T, meta };
  }
  if (operation === 'students.update') {
    const sid = String(payload.student_id || payload.studentId || '');
    const ex = MOCK_STUDENTS.find(s => s.student_id === sid);
    if (ex) {
      const p = { ...payload };
      if (!p.student_phone && ex.student_phone) delete p.student_phone;
      if (!p.student_email && ex.student_email) delete p.student_email;
      if (!p.notes && (ex as Record<string, unknown>).notes) delete p.notes;
      if (p.primary_meeting_link !== undefined) ex.primary_meeting_link = String(p.primary_meeting_link).trim();
      Object.assign(ex, p);
    }
    return { ok: true, data: (ex || { ...MOCK_STUDENTS[0], ...payload }) as T, meta };
  }
  if (operation === 'fees.list') {
    const sid = payload.student_id as string | undefined;
    return { ok: true, data: (sid ? MOCK_FEES.filter(f => f.student_id === sid) : MOCK_FEES) as T, meta };
  }
  if (operation === 'payments.list') {
    const sid = payload.student_id as string | undefined;
    return { ok: true, data: (sid ? MOCK_PAYMENTS.filter(p => p.student_id === sid) : MOCK_PAYMENTS) as T, meta };
  }
  if (operation === 'classes.list') {
    const sid = payload.student_id as string | undefined;
    const scope = payload.scope as string | undefined;
    let list = sid ? MOCK_CLASSES.filter(c => c.student_id === sid) : MOCK_CLASSES;
    if (scope === 'upcoming' || scope === 'past') {
      const now = new Date().toISOString();
      list = list.filter(c => {
        const item = c as Record<string, any>;
        const start = item.scheduled_start || (item.schedule_date && item.schedule_time ? `${item.schedule_date}T${item.schedule_time}` : item.start_time);
        const isUp = (start && start >= now) || item.session_status === 'SCHEDULED' || item.status === 'SCHEDULED';
        return scope === 'upcoming' ? isUp : !isUp;
      });
    }
    return { ok: true, data: list as T, meta };
  }
  if (operation === 'classes.schedule') return { ok: true, data: scheduleMockClass(payload) as T, meta };
  if (operation === 'classes.recordAttendance' || operation === 'classes.complete') {
    return { ok: true, data: handleMockClassRecordAttendance(payload) as T, meta };
  }
  if (operation === 'classes.cancel') {
    return { ok: true, data: handleMockClassCancel(payload) as T, meta };
  }
  if (operation === 'classes.restoreCredit') {
    return { ok: true, data: handleMockClassRestoreCredit(payload) as T, meta };
  }
  if (operation === 'classes.update') {
    return { ok: true, data: handleMockClassUpdate(payload) as T, meta };
  }
  if (operation === 'classes.generateForPackage') {
    return { ok: true, data: handleMockGenerateForPackage(payload) as T, meta };
  }
  if (operation === 'packages.list') return { ok: true, data: MOCK_PACKAGES as T, meta };
  if (operation === 'packages.update') return { ok: true, data: updateMockPackage(payload) as T, meta };
  if (operation === 'packages.create') {
    return { ok: true, data: handleMockCreatePackage(payload) as T, meta };
  }
  if (operation === 'packages.getBalance') return { ok: true, data: { totalPurchased: 12, totalConsumed: 4, remainingBalance: 8 } as T, meta };
  if (operation === 'schedules.list') {
    const sid = String(payload.student_id || payload.studentId || '');
    const data = sid ? (MOCK_SCHEDULES[sid] || []) : Object.values(MOCK_SCHEDULES).flat();
    return { ok: true, data: data as T, meta };
  }
  if (operation === 'schedules.save') {
    const sid = String(payload.student_id || payload.studentId || '');
    const list = (payload.schedules || payload.entries || []) as unknown[];
    MOCK_SCHEDULES[sid] = list;
    return { ok: true, data: list as T, meta };
  }
  if (operation === 'notes.list') return { ok: true, data: MOCK_NOTES as T, meta };
  if (operation === 'reports.financialSummary') {
    return {
      ok: true,
      data: { totalInvoiced: 216800, totalBilled: 216800, totalCollected: 166800, totalReceived: 166800, totalOutstanding: 50000, currency: 'INR' } as T,
      meta
    };
  }
  if (operation === 'payments.record') {
    return { ok: true, data: handleMockRecordPayment(payload) as T, meta };
  }
  if (operation === 'packages.renew' || operation === 'students.renew') {
    return handleMockRenewal<T>(payload, reqId);
  }
  if (operation === 'system.health') {
    return { ok: true, data: { appsScriptConnected: true, schemaVersion: 2, appEnv: 'mock', activeSpreadsheetTabs: 7 } as T, meta };
  }
  return { ok: true, data: { success: true } as T, meta };
}
