import { describe, it, expect, beforeEach } from 'vitest';
import { setupExtraClassTestEnvironment } from './extraClassBackendTestHarness';
// @ts-ignore
import PackageService from '../../02-backend/apps-script/packages/PackageService.gs';
// @ts-ignore
import ClassService from '../../02-backend/apps-script/classes/ClassService.gs';

describe('Backend Extra-Class Entitlement — Restoration & Rescheduling (Tests 9–11)', () => {
  let env: ReturnType<typeof setupExtraClassTestEnvironment>;

  beforeEach(() => {
    env = setupExtraClassTestEnvironment();
  });

  it('Test 9 — Completed class restoration: restores one credit exactly', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: '1-Class Pack', purchased_classes: 1, plan_type: 'PACKAGE'
    }, env.actor);

    const sched = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId,
      scheduled_start: '2026-11-24T10:00:00.000Z',
      scheduled_end: '2026-11-24T11:00:00.000Z'
    }, env.actor);

    ClassService.Classes_complete(env.spreadsheet, {
      class_session_id: sched.data.class_session_id,
      attendance_status: 'PRESENT',
      deduct_class: true
    }, env.actor);

    expect(env.getBackendAvailableBalance(env.studentAId).consumed).toBe(1);
    expect(env.getBackendAvailableBalance(env.studentAId).available).toBe(0);

    const restRes = ClassService.Classes_restoreCredit(env.spreadsheet, {
      class_session_id: sched.data.class_session_id
    }, env.actor);

    expect(restRes.success).toBe(true);
    expect(restRes.data.deduct_class).toBe(false);

    const bal = env.getBackendAvailableBalance(env.studentAId);
    expect(bal.consumed).toBe(0);
    expect(bal.available).toBe(1);
  });

  it('Test 10 — Duplicate restoration rejected with CONFLICT', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: '1-Class Pack', purchased_classes: 1, plan_type: 'PACKAGE'
    }, env.actor);

    const sched = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId,
      scheduled_start: '2026-11-24T10:00:00.000Z',
      scheduled_end: '2026-11-24T11:00:00.000Z'
    }, env.actor);

    ClassService.Classes_complete(env.spreadsheet, {
      class_session_id: sched.data.class_session_id,
      attendance_status: 'PRESENT',
      deduct_class: true
    }, env.actor);

    const r1 = ClassService.Classes_restoreCredit(env.spreadsheet, {
      class_session_id: sched.data.class_session_id
    }, env.actor);
    expect(r1.success).toBe(true);

    const r2 = ClassService.Classes_restoreCredit(env.spreadsheet, {
      class_session_id: sched.data.class_session_id
    }, env.actor);
    expect(r2.success).toBe(false);
    expect(r2.code).toBe('CONFLICT');

    const bal = env.getBackendAvailableBalance(env.studentAId);
    expect(bal.consumed).toBe(0);
    expect(bal.available).toBe(1);
  });

  it('Test 11 — Reschedule: updating date/time preserves reservation count without duplicating', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: '1-Class Pack', purchased_classes: 1, plan_type: 'PACKAGE'
    }, env.actor);

    const sched = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId,
      scheduled_start: '2026-11-24T10:00:00.000Z',
      scheduled_end: '2026-11-24T11:00:00.000Z'
    }, env.actor);
    expect(env.getBackendAvailableBalance(env.studentAId).reserved).toBe(1);

    const updRes = ClassService.Classes_update(env.spreadsheet, {
      class_session_id: sched.data.class_session_id,
      scheduled_start: '2026-11-26T14:00:00.000Z',
      scheduled_end: '2026-11-26T15:00:00.000Z',
      schedule_date: '2026-11-26',
      schedule_time: '14:00'
    }, env.actor);
    expect(updRes.success).toBe(true);

    const bal = env.getBackendAvailableBalance(env.studentAId);
    expect(bal.reserved).toBe(1);
    expect(bal.available).toBe(0);
  });
});
