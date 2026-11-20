import { describe, it, expect, beforeEach } from 'vitest';
import { setupExtraClassTestEnvironment } from './extraClassBackendTestHarness';
// @ts-ignore
import PackageService from '../../02-backend/apps-script/packages/PackageService.gs';
// @ts-ignore
import ClassService from '../../02-backend/apps-script/classes/ClassService.gs';

describe('Backend Extra-Class Entitlement — Attendance & Cancellation (Tests 5–8)', () => {
  let env: ReturnType<typeof setupExtraClassTestEnvironment>;

  beforeEach(() => {
    env = setupExtraClassTestEnvironment();
  });

  it('Test 5 — Complete reserved class: reserved becomes 0, consumed increases by exactly 1', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: '1-Class Pack', purchased_classes: 1, plan_type: 'PACKAGE'
    }, env.actor);

    const sched = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId,
      scheduled_start: '2026-11-24T10:00:00.000Z',
      scheduled_end: '2026-11-24T11:00:00.000Z'
    }, env.actor);

    expect(env.getBackendAvailableBalance(env.studentAId).reserved).toBe(1);

    const compRes = ClassService.Classes_complete(env.spreadsheet, {
      class_session_id: sched.data.class_session_id,
      attendance_status: 'PRESENT',
      deduct_class: true
    }, env.actor);
    expect(compRes.success).toBe(true);

    const postCompBal = env.getBackendAvailableBalance(env.studentAId);
    expect(postCompBal.consumed).toBe(1);
    expect(postCompBal.reserved).toBe(0);
    expect(postCompBal.available).toBe(0);
  });

  it('Test 6 — Duplicate completion: complete same session twice consumes 1 credit only', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: '2-Class Pack', purchased_classes: 2, plan_type: 'PACKAGE'
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

    ClassService.Classes_complete(env.spreadsheet, {
      class_session_id: sched.data.class_session_id,
      attendance_status: 'PRESENT',
      deduct_class: true
    }, env.actor);

    const bal = env.getBackendAvailableBalance(env.studentAId);
    expect(bal.consumed).toBe(1);
    expect(bal.reserved).toBe(0);
    expect(bal.available).toBe(1);
  });

  it('Test 7 — Cancel pending class: releases reservation, available credit returns', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: '1-Class Pack', purchased_classes: 1, plan_type: 'PACKAGE'
    }, env.actor);

    const sched = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId,
      scheduled_start: '2026-11-24T10:00:00.000Z',
      scheduled_end: '2026-11-24T11:00:00.000Z'
    }, env.actor);
    expect(env.getBackendAvailableBalance(env.studentAId).available).toBe(0);

    const cancelRes = ClassService.Classes_cancel(env.spreadsheet, {
      class_session_id: sched.data.class_session_id,
      cancellation_reason: 'Student unwell',
      deduct_class: false
    }, env.actor);
    expect(cancelRes.success).toBe(true);

    const bal = env.getBackendAvailableBalance(env.studentAId);
    expect(bal.consumed).toBe(0);
    expect(bal.reserved).toBe(0);
    expect(bal.available).toBe(1);
  });

  it('Test 8 — Duplicate cancellation: cancelling same class twice does not restore extra credits', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: '1-Class Pack', purchased_classes: 1, plan_type: 'PACKAGE'
    }, env.actor);

    const sched = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId,
      scheduled_start: '2026-11-24T10:00:00.000Z',
      scheduled_end: '2026-11-24T11:00:00.000Z'
    }, env.actor);

    ClassService.Classes_cancel(env.spreadsheet, {
      class_session_id: sched.data.class_session_id,
      cancellation_reason: 'Student unwell',
      deduct_class: false
    }, env.actor);
    expect(env.getBackendAvailableBalance(env.studentAId).available).toBe(1);

    ClassService.Classes_cancel(env.spreadsheet, {
      class_session_id: sched.data.class_session_id,
      cancellation_reason: 'Student unwell duplicate',
      deduct_class: false
    }, env.actor);

    const bal = env.getBackendAvailableBalance(env.studentAId);
    expect(bal.consumed).toBe(0);
    expect(bal.reserved).toBe(0);
    expect(bal.available).toBe(1);
  });
});
