import { describe, it, expect, beforeEach } from 'vitest';
import { setupExtraClassTestEnvironment } from './extraClassBackendTestHarness';
// @ts-ignore
import PackageRepository from '../../02-backend/apps-script/packages/PackageRepository.gs';
// @ts-ignore
import RenewalService from '../../02-backend/apps-script/packages/RenewalService.gs';
// @ts-ignore
import ClassService from '../../02-backend/apps-script/classes/ClassService.gs';

describe('Backend Extra-Class Entitlement — Renewals & Multi-Student (Tests 12–15)', () => {
  let env: ReturnType<typeof setupExtraClassTestEnvironment>;

  beforeEach(() => {
    env = setupExtraClassTestEnvironment();
  });

  it('Test 12 — Package renewal (3 + 12 = 15) with pending reservations', () => {
    PackageRepository.Packages_insert(env.spreadsheet, {
      student_id: env.studentAId, student_name: 'Alice Smith', plan_type: 'PACKAGE',
      currency: 'INR', package_price: 12000, classes_purchased: 12, start_date: '2026-08-01', status: 'ACTIVE'
    });

    for (let i = 1; i <= 9; i++) {
      const d = i < 10 ? `0${i}` : `${i}`;
      const sched = ClassService.Classes_schedule(env.spreadsheet, {
        student_id: env.studentAId, scheduled_start: `2026-08-${d}T10:00:00.000Z`, scheduled_end: `2026-08-${d}T11:00:00.000Z`
      }, env.actor);
      ClassService.Classes_complete(env.spreadsheet, {
        class_session_id: sched.data.class_session_id, attendance_status: 'PRESENT', deduct_class: true
      }, env.actor);
    }

    let bal = env.getBackendAvailableBalance(env.studentAId);
    expect(bal.consumed).toBe(9);
    expect(bal.available).toBe(3);

    const renRes = RenewalService.Packages_renew(env.spreadsheet, {
      student_id: env.studentAId, new_classes_purchased: 12, plan_type: 'PACKAGE',
      package_price: 12000, currency: 'INR', idempotency_key: 'idemp_ren_alice'
    }, env.actor);
    expect(renRes.success).toBe(true);

    bal = env.getBackendAvailableBalance(env.studentAId);
    expect(bal.available).toBe(15);
    expect(bal.consumed).toBe(9);

    ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, scheduled_start: '2026-11-24T10:00:00.000Z', scheduled_end: '2026-11-24T11:00:00.000Z'
    }, env.actor);
    ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, scheduled_start: '2026-11-26T14:00:00.000Z', scheduled_end: '2026-11-26T15:00:00.000Z'
    }, env.actor);

    bal = env.getBackendAvailableBalance(env.studentAId);
    expect(bal.consumed).toBe(9);
    expect(bal.reserved).toBe(2);
    expect(bal.available).toBe(13);
  });

  it('Test 13 — Multiple students: complete isolation between Student A and Student B', () => {
    PackageRepository.Packages_insert(env.spreadsheet, {
      student_id: env.studentAId, student_name: 'Alice', plan_type: 'PACKAGE', classes_purchased: 1, status: 'ACTIVE'
    });
    PackageRepository.Packages_insert(env.spreadsheet, {
      student_id: env.studentBId, student_name: 'Bob', plan_type: 'PACKAGE', classes_purchased: 5, status: 'ACTIVE'
    });

    ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, scheduled_start: '2026-11-24T10:00:00.000Z', scheduled_end: '2026-11-24T11:00:00.000Z'
    }, env.actor);

    expect(env.getBackendAvailableBalance(env.studentAId).available).toBe(0);
    expect(env.getBackendAvailableBalance(env.studentBId).available).toBe(5);

    const sBRes = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentBId, scheduled_start: '2026-11-24T12:00:00.000Z', scheduled_end: '2026-11-24T13:00:00.000Z'
    }, env.actor);
    expect(sBRes.success).toBe(true);
    expect(env.getBackendAvailableBalance(env.studentBId).available).toBe(4);
  });

  it('Test 14 — Different packages: chronological consumption across packages', () => {
    PackageRepository.Packages_insert(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'Old Pack', classes_purchased: 2, start_date: '2026-01-01', status: 'ACTIVE'
    });
    PackageRepository.Packages_insert(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'New Pack', classes_purchased: 3, start_date: '2026-06-01', status: 'ACTIVE'
    });

    const bal = env.getBackendAvailableBalance(env.studentAId);
    expect(bal.totalPurchased).toBe(5);
    expect(bal.available).toBe(5);

    for (let i = 1; i <= 5; i++) {
      const res = ClassService.Classes_schedule(env.spreadsheet, {
        student_id: env.studentAId, scheduled_start: `2026-11-2${i}T10:00:00.000Z`, scheduled_end: `2026-11-2${i}T11:00:00.000Z`
      }, env.actor);
      expect(res.success).toBe(true);
    }

    expect(env.getBackendAvailableBalance(env.studentAId).reserved).toBe(5);
    expect(env.getBackendAvailableBalance(env.studentAId).available).toBe(0);

    const overRes = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, scheduled_start: '2026-11-29T10:00:00.000Z', scheduled_end: '2026-11-29T11:00:00.000Z'
    }, env.actor);
    expect(overRes.success).toBe(false);
    expect(overRes.code).toBe('INSUFFICIENT_PACKAGE_CREDITS');
  });

  it('Test 15 — Existing normal dated sessions follow existing entitlement rules without corrupting reservations', () => {
    PackageRepository.Packages_insert(env.spreadsheet, {
      student_id: env.studentAId, classes_purchased: 3, plan_type: 'PACKAGE', status: 'ACTIVE'
    });

    const s1 = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, scheduled_start: '2026-11-24T10:00:00.000Z', scheduled_end: '2026-11-24T11:00:00.000Z'
    }, env.actor);
    expect(s1.success).toBe(true);
    expect(env.getBackendAvailableBalance(env.studentAId).available).toBe(2);

    const s2 = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, scheduled_start: '2026-11-25T10:00:00.000Z', scheduled_end: '2026-11-25T11:00:00.000Z'
    }, env.actor);
    expect(s2.success).toBe(true);
    expect(env.getBackendAvailableBalance(env.studentAId).available).toBe(1);
  });
});
