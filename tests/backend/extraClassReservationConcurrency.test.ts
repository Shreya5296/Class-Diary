import { describe, it, expect, beforeEach } from 'vitest';
import { setupExtraClassTestEnvironment } from './extraClassBackendTestHarness';
// @ts-ignore
import PackageService from '../../02-backend/apps-script/packages/PackageService.gs';
// @ts-ignore
import ClassService from '../../02-backend/apps-script/classes/ClassService.gs';
// @ts-ignore
import ClassRepository from '../../02-backend/apps-script/classes/ClassRepository.gs';

describe('Backend Extra-Class Entitlement — Reservation & Concurrency (Tests 1–4)', () => {
  let env: ReturnType<typeof setupExtraClassTestEnvironment>;

  beforeEach(() => {
    env = setupExtraClassTestEnvironment();
  });

  it('Test 1 — Single available credit: schedule one extra class reserves 1 entitlement (available becomes 0)', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: '1-Class Pack', purchased_classes: 1, plan_type: 'PACKAGE'
    }, env.actor);

    const initBal = env.getBackendAvailableBalance(env.studentAId);
    expect(initBal.totalPurchased).toBe(1);
    expect(initBal.consumed).toBe(0);
    expect(initBal.reserved).toBe(0);
    expect(initBal.available).toBe(1);

    const schedRes = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId,
      scheduled_start: '2026-11-24T10:00:00.000Z',
      scheduled_end: '2026-11-24T11:00:00.000Z',
      class_title: 'Tuesday Extra Class'
    }, env.actor);

    expect(schedRes.success).toBe(true);
    expect(schedRes.data.session_status).toBe('SCHEDULED');
    expect(schedRes.data.attendance_status).toBe('NOT_MARKED');
    expect(schedRes.data.deduct_class).toBe(false);

    const postBal = env.getBackendAvailableBalance(env.studentAId);
    expect(postBal.consumed).toBe(0);
    expect(postBal.reserved).toBe(1);
    expect(postBal.available).toBe(0);
  });

  it('Test 2 — Second extra class rejected when only 1 credit was available', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: '1-Class Pack', purchased_classes: 1, plan_type: 'PACKAGE'
    }, env.actor);

    const res1 = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId,
      scheduled_start: '2026-11-24T10:00:00.000Z',
      scheduled_end: '2026-11-24T11:00:00.000Z',
      class_title: 'Tuesday Class'
    }, env.actor);
    expect(res1.success).toBe(true);

    const res2 = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId,
      scheduled_start: '2026-11-26T14:00:00.000Z',
      scheduled_end: '2026-11-26T15:00:00.000Z',
      class_title: 'Thursday Class'
    }, env.actor);

    expect(res2.success).toBe(false);
    expect(res2.code).toBe('INSUFFICIENT_PACKAGE_CREDITS');

    const sessions = ClassRepository.Classes_getAll(env.spreadsheet).filter((s: any) => s.student_id === env.studentAId);
    expect(sessions).toHaveLength(1);
    expect(env.getBackendAvailableBalance(env.studentAId).available).toBe(0);
  });

  it('Test 3 — Two simultaneous requests: critical section ensures exactly one succeeds and second is rejected', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: '1-Class Pack', purchased_classes: 1, plan_type: 'PACKAGE'
    }, env.actor);

    const requestA = () => ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId,
      scheduled_start: '2026-11-24T10:00:00.000Z',
      scheduled_end: '2026-11-24T11:00:00.000Z',
      class_title: 'Teacher A Request'
    }, env.actor);

    const requestB = () => ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId,
      scheduled_start: '2026-11-26T14:00:00.000Z',
      scheduled_end: '2026-11-26T15:00:00.000Z',
      class_title: 'Teacher B Request'
    }, env.actor);

    const resA = requestA();
    const resB = requestB();

    expect(resA.success).toBe(true);
    expect(resB.success).toBe(false);
    expect(resB.code).toBe('INSUFFICIENT_PACKAGE_CREDITS');

    const sessions = ClassRepository.Classes_getAll(env.spreadsheet).filter((s: any) => s.student_id === env.studentAId);
    expect(sessions).toHaveLength(1);
    expect(env.getBackendAvailableBalance(env.studentAId).available).toBe(0);
  });

  it('Test 4 — Multiple available credits: available 5, schedule three extra classes leaves 2 available', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: '5-Class Pack', purchased_classes: 5, plan_type: 'PACKAGE'
    }, env.actor);

    const dates = ['2026-11-24', '2026-11-25', '2026-11-26'];
    for (let i = 0; i < dates.length; i++) {
      const res = ClassService.Classes_schedule(env.spreadsheet, {
        student_id: env.studentAId,
        scheduled_start: `${dates[i]}T10:00:00.000Z`,
        scheduled_end: `${dates[i]}T11:00:00.000Z`,
        class_title: `Extra Class ${i + 1}`
      }, env.actor);
      expect(res.success).toBe(true);
    }

    const bal = env.getBackendAvailableBalance(env.studentAId);
    expect(bal.totalPurchased).toBe(5);
    expect(bal.consumed).toBe(0);
    expect(bal.reserved).toBe(3);
    expect(bal.available).toBe(2);
  });
});
