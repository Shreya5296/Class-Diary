import { describe, it, expect, beforeEach } from 'vitest';
import { setupExtraClassTestEnvironment } from './extraClassBackendTestHarness';
// @ts-ignore
import PackageService from '../../02-backend/apps-script/packages/PackageService.gs';
// @ts-ignore
import ClassService from '../../02-backend/apps-script/classes/ClassService.gs';
// @ts-ignore
import ClassRepository from '../../02-backend/apps-script/classes/ClassRepository.gs';
// @ts-ignore
import ClassEntitlementService from '../../02-backend/apps-script/classes/ClassEntitlementService.gs';

describe('Backend Entitlement Expiry, Pure FIFO & Concurrency Locking (Iteration 1.4)', () => {
  let env: ReturnType<typeof setupExtraClassTestEnvironment>;

  beforeEach(() => {
    env = setupExtraClassTestEnvironment();
  });

  it('1. Fail closed: Classes_schedule fails closed when LockManager is unavailable', () => {
    ClassService._setLockManager(null);
    try {
      const res = ClassService.Classes_schedule(env.spreadsheet, {
        student_id: env.studentAId,
        scheduled_start: '2026-11-25T10:00:00.000Z',
        scheduled_end: '2026-11-25T11:00:00.000Z'
      }, env.actor);
      expect(res.success).toBe(false);
      expect(res.code).toBe('LOCK_UNAVAILABLE');
    } finally {
      // @ts-ignore
      ClassService._setLockManager(require('../../02-backend/apps-script/sheets/LockManager.gs'));
    }
  });

  it('2. Expiry eligibility: Expired package rejected; active renewal carry-forward honored', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'Expired Pack', purchased_classes: 3,
      start_date: '2026-09-01', end_date: '2026-10-01', status: 'EXPIRED'
    }, env.actor);

    const expiredRes = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, scheduled_start: '2026-11-25T10:00:00.000Z',
      scheduled_end: '2026-11-25T11:00:00.000Z', class_date: '2026-11-25'
    }, env.actor);
    expect(expiredRes.success).toBe(false);
    expect(expiredRes.code).toBe('INSUFFICIENT_PACKAGE_CREDITS');

    // Renewal created: 10 new classes. Unused 3 carry forward -> 13 available
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'Renewal Pack', purchased_classes: 10,
      start_date: '2026-11-01', end_date: '2026-12-31', status: 'ACTIVE'
    }, env.actor);

    const renewRes = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, scheduled_start: '2026-11-25T10:00:00.000Z', scheduled_end: '2026-11-25T11:00:00.000Z'
    }, env.actor);
    expect(renewRes.success).toBe(true);
    const bal = env.getBackendAvailableBalance(env.studentAId);
    expect(bal.totalPurchased).toBe(13);
    expect(bal.reserved).toBe(1);
    expect(bal.available).toBe(12);
  });

  it('3. Pure chronological FIFO: Mixed explicit and unattributed session history allocates correctly', () => {
    const pkg1 = PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'P1', purchased_classes: 2, start_date: '2026-01-01'
    }, env.actor).data;
    const pkg2 = PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'P2', purchased_classes: 5, start_date: '2026-02-01'
    }, env.actor).data;

    const s1 = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, package_id: pkg1.package_id, scheduled_start: '2026-01-10T10:00:00.000Z'
    }, env.actor).data;
    ClassService.Classes_complete(env.spreadsheet, { class_session_id: s1.session_id, attendance_status: 'ATTENDED' }, env.actor);

    const s2 = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, scheduled_start: '2026-01-15T10:00:00.000Z'
    }, env.actor).data;
    ClassService.Classes_complete(env.spreadsheet, { class_session_id: s2.session_id, attendance_status: 'ATTENDED' }, env.actor);

    const s3 = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, scheduled_start: '2026-02-10T10:00:00.000Z'
    }, env.actor).data;
    ClassService.Classes_complete(env.spreadsheet, { class_session_id: s3.session_id, attendance_status: 'ATTENDED' }, env.actor);

    const bal = env.getBackendAvailableBalance(env.studentAId);
    expect(bal.totalPurchased).toBe(7);
    expect(bal.consumed).toBe(3);
    expect(bal.available).toBe(4);
  });

  it('4. Concurrent lifecycle mutations: Completion vs cancellation race & duplicate prevention', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'Pack A', purchased_classes: 5
    }, env.actor);
    const cls = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, scheduled_start: '2026-11-26T10:00:00.000Z'
    }, env.actor).data;

    // Cancellation succeeds
    const cancelRes = ClassService.Classes_cancel(env.spreadsheet, {
      class_session_id: cls.session_id, cancellation_reason: 'Student sick'
    }, env.actor);
    expect(cancelRes.success).toBe(true);

    // Attempting to complete an already CANCELLED session fails closed with CONFLICT
    const compRes = ClassService.Classes_complete(env.spreadsheet, {
      class_session_id: cls.session_id, attendance_status: 'ATTENDED'
    }, env.actor);
    expect(compRes.success).toBe(false);
    expect(compRes.code).toBe('CONFLICT');

    // Duplicate cancellation returns idempotent success
    const dupCancel = ClassService.Classes_cancel(env.spreadsheet, {
      class_session_id: cls.session_id, cancellation_reason: 'Student sick'
    }, env.actor);
    expect(dupCancel.success).toBe(true);
  });

  it('5. Credit restoration concurrency safety: Duplicate restore rejected with CONFLICT', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'Pack B', purchased_classes: 2
    }, env.actor);
    const cls = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, scheduled_start: '2026-11-27T10:00:00.000Z'
    }, env.actor).data;

    // Complete class with late cancellation/deduction
    ClassService.Classes_cancel(env.spreadsheet, {
      class_session_id: cls.session_id, deduct_class: true, cancellation_reason: 'Late cancel'
    }, env.actor);
    expect(env.getBackendAvailableBalance(env.studentAId).available).toBe(1);

    // Restore credit 1st time -> succeeds
    const r1 = ClassService.Classes_restoreCredit(env.spreadsheet, { class_session_id: cls.session_id }, env.actor);
    expect(r1.success).toBe(true);
    expect(env.getBackendAvailableBalance(env.studentAId).available).toBe(2);

    // Duplicate restore -> rejected with CONFLICT (not deducted anymore)
    const r2 = ClassService.Classes_restoreCredit(env.spreadsheet, { class_session_id: cls.session_id }, env.actor);
    expect(r2.success).toBe(false);
    expect(r2.code).toBe('CONFLICT');
  });
});
