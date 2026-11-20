import { describe, it, expect } from 'vitest';
import {
  buildRecurringSuppressionMap,
  computeAllowedFutureRecurringDates,
  getPackageRemainingCredits,
  getStudentTotalRemainingCredits,
} from '../../src/domains/calendar/extraClassAccounting';
import { generateCalendarEvents } from '../../src/domains/dashboard/calendarEventGenerator';
import { ClassSession } from '../../src/domains/classes/classTypes';
import { Package } from '../../src/domains/packages/packageTypes';
import { handleMockClassRestoreCredit } from '../../src/api/mockClassOperations';
import {
  mockStudent1,
  mockPackage1,
  mockPackage2,
  recurringAlice,
  recurringBob,
  pastSessionsAlice,
} from './extraClassTestFixtures';

describe('Frontend Extra-Class Reconciliation & Lifecycle (Tests 11–15)', () => {
  it('Test 11 — Cancellation: correct recurring occurrence returns upon cancellation', () => {
    const extra: ClassSession = { session_id: 'ex_c', student_id: 'stu_alice', schedule_date: '2026-11-24', start_time: '15:00', status: 'SCHEDULED', session_status: 'SCHEDULED', attendance_status: 'NOT_MARKED', deduct_class: false };

    const mapActive = buildRecurringSuppressionMap({
      packages: [mockPackage1], recurringSchedules: [recurringAlice],
      datedSessions: [...pastSessionsAlice, extra], todayStr: '2026-11-24',
    });
    expect(mapActive.get('stu_alice')).toBe('2026-12-28');

    const mapCancelled = buildRecurringSuppressionMap({
      packages: [mockPackage1], recurringSchedules: [recurringAlice],
      datedSessions: [...pastSessionsAlice, { ...extra, session_status: 'CANCELLED', status: 'CANCELLED' }], todayStr: '2026-11-24',
    });
    expect(mapCancelled.get('stu_alice')).toBe('2027-01-04');
  });

  it('Test 12 — Rescheduling: moving an extra class reconciles without duplicating occurrences', () => {
    const rescheduledSession: ClassSession = {
      session_id: 'resched_1', student_id: 'stu_alice', schedule_date: '2026-11-26', start_time: '14:00', duration_minutes: 60,
      status: 'SCHEDULED', session_status: 'SCHEDULED', attendance_status: 'NOT_MARKED', deduct_class: false,
    };

    const events = generateCalendarEvents({
      datedSessions: [...pastSessionsAlice, rescheduledSession], recurringSchedules: [recurringAlice],
      students: [mockStudent1], packages: [mockPackage1],
      weekDates: ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'],
      activeTz: 'Asia/Kolkata',
    });

    expect(events.filter((e) => (e.schedule_date || '').startsWith('2026-11-24'))).toHaveLength(0);
    const thurs = events.filter((e) => (e.schedule_date || '').startsWith('2026-11-26'));
    expect(thurs).toHaveLength(1);
    expect(thurs[0].session_id).toBe('resched_1');
  });

  it('Test 13 — Different students: verifies complete isolation between students', () => {
    const extraAlice: ClassSession = { session_id: 'ex_a', student_id: 'stu_alice', schedule_date: '2026-11-24', start_time: '15:00', duration_minutes: 60, status: 'SCHEDULED', session_status: 'SCHEDULED', attendance_status: 'NOT_MARKED', deduct_class: false };

    const suppressionMap = buildRecurringSuppressionMap({
      packages: [mockPackage1, mockPackage2], recurringSchedules: [recurringAlice, recurringBob],
      datedSessions: [...pastSessionsAlice, extraAlice], todayStr: '2026-11-24',
    });

    const bobAllowed = computeAllowedFutureRecurringDates({
      todayStr: '2026-11-24', recurringDays: ['WEDNESDAY'], maxCount: 8,
    });
    expect(suppressionMap.get('stu_bob')).toBe(bobAllowed[7]);
    expect(getPackageRemainingCredits(mockPackage2, [extraAlice])).toBe(8);
  });

  it('Test 14 — Different packages: renewal credits preserve future occurrences across package boundaries', () => {
    const p1: Package = { package_id: 'pkg_1', student_id: 'stu_alice', classes_purchased: 4, start_date: '2026-10-01' };
    const p2: Package = { package_id: 'pkg_2', student_id: 'stu_alice', classes_purchased: 6, start_date: '2026-11-01' };
    const allPkgs = [p1, p2];

    const totalAvail = getStudentTotalRemainingCredits('stu_alice', allPkgs, pastSessionsAlice);
    expect(totalAvail).toBe(6);

    const extra: ClassSession = { session_id: 'ex_bound', student_id: 'stu_alice', schedule_date: '2026-11-24', start_time: '15:00', status: 'SCHEDULED', session_status: 'SCHEDULED', attendance_status: 'NOT_MARKED', deduct_class: false };

    const suppressionMap = buildRecurringSuppressionMap({
      packages: allPkgs, recurringSchedules: [recurringAlice],
      datedSessions: [...pastSessionsAlice, extra], todayStr: '2026-11-24',
    });
    expect(suppressionMap.get('stu_alice')).toBe('2026-12-28');
  });

  it('Test 15 — Backend integrity: duplicate restore credit attempt returns CONFLICT', () => {
    const res = handleMockClassRestoreCredit({ session_id: 'cls_401' });
    expect(res).toEqual({
      success: false, code: 'CONFLICT', message: 'Can only restore credits for sessions with deducted class',
    });
  });
});
