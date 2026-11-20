import { describe, it, expect, beforeEach } from 'vitest';
import { setupExtraClassTestEnvironment } from './extraClassBackendTestHarness';
// @ts-ignore
import PackageService from '../../02-backend/apps-script/packages/PackageService.gs';
// @ts-ignore
import PackageRepository from '../../02-backend/apps-script/packages/PackageRepository.gs';
// @ts-ignore
import ClassService from '../../02-backend/apps-script/classes/ClassService.gs';
// @ts-ignore
import ClassEntitlementService from '../../02-backend/apps-script/classes/ClassEntitlementService.gs';

describe('Unified Durable Package Allocation (Iteration 1.6)', () => {
  let env: ReturnType<typeof setupExtraClassTestEnvironment>;

  beforeEach(() => {
    env = setupExtraClassTestEnvironment();
    (globalThis as any).__sessionMetaMap = {};
  });

  it('Test A: Warm/Cold Equivalence across Packages_enrichWithBalance and checkBookingEntitlement', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'P1', purchased_classes: 3, start_date: '2026-01-01'
    }, env.actor);
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'P2', purchased_classes: 5, start_date: '2026-02-01'
    }, env.actor);

    for (let i = 1; i <= 4; i++) {
      const cls = ClassService.Classes_schedule(env.spreadsheet, {
        student_id: env.studentAId, scheduled_start: `2026-02-0${i}T10:00:00.000Z`
      }, env.actor).data;
      ClassService.Classes_complete(env.spreadsheet, {
        class_session_id: cls.session_id, attendance_status: 'PRESENT', deduct_class: true
      }, env.actor);
    }

    const warmPkgs = PackageRepository.Packages_getByStudentId(env.spreadsheet, env.studentAId);
    const warmEnriched = PackageService.Packages_enrichWithBalance(env.spreadsheet, warmPkgs);
    const warmEntitlement = ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId);
    delete (globalThis as any).__sessionMetaMap;
    const coldPkgs = PackageRepository.Packages_getByStudentId(env.spreadsheet, env.studentAId);
    const coldEnriched = PackageService.Packages_enrichWithBalance(env.spreadsheet, coldPkgs);
    const coldEntitlement = ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId);
    expect(coldEnriched).toEqual(warmEnriched);
    expect(coldEntitlement).toEqual(warmEntitlement);

    const p1 = coldEnriched.find((p: any) => p.package_name === 'P1');
    const p2 = coldEnriched.find((p: any) => p.package_name === 'P2');
    expect(p1.consumed_classes).toBe(3);
    expect(p1.remaining_classes).toBe(0);
    expect(p2.consumed_classes).toBe(1);
    expect(p2.remaining_classes).toBe(4);
    expect(coldEntitlement.availableCredits).toBe(4);
  });

  it('Test B: Mixed explicit metadata and unattributed sessions allocate deterministically via FIFO', () => {
    const p1 = PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'P1', purchased_classes: 2, start_date: '2026-01-01'
    }, env.actor).data;
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'P2', purchased_classes: 5, start_date: '2026-02-01'
    }, env.actor);

    const s1 = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, package_id: p1.package_id, scheduled_start: '2026-01-05T10:00:00.000Z'
    }, env.actor).data;
    ClassService.Classes_complete(env.spreadsheet, { class_session_id: s1.session_id, attendance_status: 'ATTENDED' }, env.actor);

    const s2 = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, scheduled_start: '2026-01-10T10:00:00.000Z'
    }, env.actor).data;
    ClassService.Classes_complete(env.spreadsheet, { class_session_id: s2.session_id, attendance_status: 'ATTENDED' }, env.actor);

    const s3 = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, scheduled_start: '2026-02-15T10:00:00.000Z'
    }, env.actor).data;
    ClassService.Classes_complete(env.spreadsheet, { class_session_id: s3.session_id, attendance_status: 'ATTENDED' }, env.actor);
    const enriched = PackageService.Packages_enrichWithBalance(env.spreadsheet, PackageRepository.Packages_getByStudentId(env.spreadsheet, env.studentAId));
    const p1Enr = enriched.find((p: any) => p.package_name === 'P1');
    const p2Enr = enriched.find((p: any) => p.package_name === 'P2');
    expect(p1Enr.remaining_classes).toBe(0);
    expect(p2Enr.remaining_classes).toBe(4);
    expect(ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId).availableCredits).toBe(4);
  });

  it('Test C: Multiple renewals across 3 chronological packages', () => {
    for (let p = 1; p <= 3; p++) {
      PackageService.Packages_create(env.spreadsheet, {
        student_id: env.studentAId, package_name: `Pack ${p}`, purchased_classes: 5, start_date: `2026-0${p}-01`
      }, env.actor);
    }
    for (let i = 1; i <= 12; i++) {
      const cls = ClassService.Classes_schedule(env.spreadsheet, {
        student_id: env.studentAId, scheduled_start: `2026-03-${i < 10 ? '0' + i : i}T10:00:00.000Z`
      }, env.actor).data;
      ClassService.Classes_complete(env.spreadsheet, { class_session_id: cls.session_id, attendance_status: 'ATTENDED' }, env.actor);
    }
    const enriched = PackageService.Packages_enrichWithBalance(env.spreadsheet, PackageRepository.Packages_getByStudentId(env.spreadsheet, env.studentAId));
    expect(enriched.find((p: any) => p.package_name === 'Pack 1').remaining_classes).toBe(0);
    expect(enriched.find((p: any) => p.package_name === 'Pack 2').remaining_classes).toBe(0);
    expect(enriched.find((p: any) => p.package_name === 'Pack 3').remaining_classes).toBe(3);
    expect(ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId).availableCredits).toBe(3);
  });

  it('Test D: Pending reservations deduct from available credits without increasing consumed', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'Pack A', purchased_classes: 5, start_date: '2026-01-01'
    }, env.actor);
    for (let i = 1; i <= 2; i++) {
      const c = ClassService.Classes_schedule(env.spreadsheet, {
        student_id: env.studentAId, scheduled_start: `2026-01-0${i}T10:00:00.000Z`
      }, env.actor).data;
      ClassService.Classes_complete(env.spreadsheet, { class_session_id: c.session_id, attendance_status: 'ATTENDED' }, env.actor);
    }
    ClassService.Classes_schedule(env.spreadsheet, { student_id: env.studentAId, scheduled_start: '2026-02-01T10:00:00.000Z' }, env.actor);
    ClassService.Classes_schedule(env.spreadsheet, { student_id: env.studentAId, scheduled_start: '2026-02-02T10:00:00.000Z' }, env.actor);

    const enriched = PackageService.Packages_enrichWithBalance(env.spreadsheet, PackageRepository.Packages_getByStudentId(env.spreadsheet, env.studentAId));
    expect(enriched[0].consumed_classes).toBe(2);
    expect(enriched[0].remaining_classes).toBe(3);

    const ent = ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId);
    expect(ent.availableCredits).toBe(1);
    expect(ClassService.Classes_schedule(env.spreadsheet, { student_id: env.studentAId, scheduled_start: '2026-02-03T10:00:00.000Z' }, env.actor).success).toBe(true);
    const over = ClassService.Classes_schedule(env.spreadsheet, { student_id: env.studentAId, scheduled_start: '2026-02-04T10:00:00.000Z' }, env.actor);
    expect(over.success).toBe(false);
    expect(over.code).toBe('INSUFFICIENT_PACKAGE_CREDITS');
  });

  it('Test E: Cold-start eligibility check operates deterministically from persisted records', () => {
    delete (globalThis as any).__sessionMetaMap;
    delete (globalThis as any).__pkgMemoryMap;
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'Past', purchased_classes: 2, start_date: '2025-01-01', end_date: '2025-02-01', status: 'EXPIRED'
    }, env.actor);
    expect(ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId).hasEntitlement).toBe(false);

    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'Active', purchased_classes: 4, start_date: '2026-01-01', end_date: '2027-01-01'
    }, env.actor);
    const ent = ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId);
    expect(ent.hasEntitlement).toBe(true);
    // Forfeited expired credits are excluded; only active package credits are available
    expect(ent.availableCredits).toBe(4);
  });
});
