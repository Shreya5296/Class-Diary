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

describe('Durable Eligibility & Accounting Scenarios (Iteration 1.8)', () => {
  let env: ReturnType<typeof setupExtraClassTestEnvironment>;

  beforeEach(() => {
    env = setupExtraClassTestEnvironment();
    delete (globalThis as any).__sessionMetaMap;
    delete (globalThis as any).__pkgMemoryMap;
  });

  it('Scenario A: Normal renewal carry-forward (12 purch, 9 cons, 3 rem + 12 new = 15)', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'Old Pack', purchased_classes: 12, start_date: '2026-01-01'
    }, env.actor);
    for (let i = 1; i <= 9; i++) {
      const cls = ClassService.Classes_schedule(env.spreadsheet, {
        student_id: env.studentAId, scheduled_start: `2026-01-${i < 10 ? '0' + i : i}T10:00:00.000Z`
      }, env.actor).data;
      ClassService.Classes_complete(env.spreadsheet, { class_session_id: cls.session_id, attendance_status: 'PRESENT' }, env.actor);
    }
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'New Pack', purchased_classes: 12, start_date: '2026-02-01'
    }, env.actor);

    const ent = ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId);
    expect(ent.valid).toBe(true);
    expect(ent.availableCredits).toBe(15);
  });

  it('Scenario B: Explicitly cancelled old package (3 rem forfeited; 9 cons stay allocated; new 12 = 12)', () => {
    const oldPkg = PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'Old Pack', purchased_classes: 12, start_date: '2026-01-01'
    }, env.actor).data;
    for (let i = 1; i <= 9; i++) {
      const cls = ClassService.Classes_schedule(env.spreadsheet, {
        student_id: env.studentAId, scheduled_start: `2026-01-${i < 10 ? '0' + i : i}T10:00:00.000Z`
      }, env.actor).data;
      ClassService.Classes_complete(env.spreadsheet, { class_session_id: cls.session_id, attendance_status: 'PRESENT' }, env.actor);
    }
    // Explicitly cancel old package in memory map
    (globalThis as any).__pkgMemoryMap[oldPkg.package_id].status = 'CANCELLED';
    (globalThis as any).__pkgMemoryMap[oldPkg.package_id].package_status = 'CANCELLED';

    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'New Pack', purchased_classes: 12, start_date: '2026-02-01'
    }, env.actor);

    const ent = ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId);
    expect(ent.valid).toBe(true);
    expect(ent.availableCredits).toBe(12); // Old 3 forfeited, new 12 intact
  });

  it('Scenario C: Exhausted old package (12 purch, 12 cons + 12 new = 12)', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'Exhausted Pack', purchased_classes: 12, start_date: '2026-01-01'
    }, env.actor);
    for (let i = 1; i <= 12; i++) {
      const cls = ClassService.Classes_schedule(env.spreadsheet, {
        student_id: env.studentAId, scheduled_start: `2026-01-${i < 10 ? '0' + i : i}T10:00:00.000Z`
      }, env.actor).data;
      ClassService.Classes_complete(env.spreadsheet, { class_session_id: cls.session_id, attendance_status: 'PRESENT' }, env.actor);
    }
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'New Pack', purchased_classes: 12, start_date: '2026-02-01'
    }, env.actor);

    const ent = ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId);
    expect(ent.availableCredits).toBe(12);
  });

  it('Scenario D: Only cancelled package -> bookable balance = 0', () => {
    const pkg = PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'Solo Cancelled', purchased_classes: 12, start_date: '2026-01-01', status: 'CANCELLED'
    }, env.actor).data;
    (globalThis as any).__pkgMemoryMap[pkg.package_id].status = 'CANCELLED';
    (globalThis as any).__pkgMemoryMap[pkg.package_id].package_status = 'CANCELLED';
    const ent = ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId);
    expect(ent.valid).toBe(false);
    expect(ent.availableCredits).toBe(0);
  });

  it('Scenario E: Cold-start eligibility from physical spreadsheet with memory maps cleared', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'Pack 1', purchased_classes: 5, start_date: '2026-01-01'
    }, env.actor);
    const cls = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, scheduled_start: '2026-01-10T10:00:00.000Z'
    }, env.actor).data;
    ClassService.Classes_complete(env.spreadsheet, { class_session_id: cls.session_id, attendance_status: 'PRESENT' }, env.actor);
    delete (globalThis as any).__sessionMetaMap;
    delete (globalThis as any).__pkgMemoryMap;
    const coldPkgs = PackageRepository.Packages_getByStudentId(env.spreadsheet, env.studentAId);
    const enriched = PackageService.Packages_enrichWithBalance(env.spreadsheet, coldPkgs);
    expect(enriched[0].consumed_classes).toBe(1);
    expect(enriched[0].remaining_classes).toBe(4);
    expect(ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId).availableCredits).toBe(4);
  });

  it('Scenario F: Duplicate package identity with identical start dates maps correctly by row', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'Twin A', purchased_classes: 5, start_date: '2026-08-01'
    }, env.actor);
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'Twin B', purchased_classes: 5, start_date: '2026-08-01'
    }, env.actor);
    for (let i = 1; i <= 6; i++) {
      const cls = ClassService.Classes_schedule(env.spreadsheet, {
        student_id: env.studentAId, scheduled_start: `2026-08-0${i}T10:00:00.000Z`
      }, env.actor).data;
      ClassService.Classes_complete(env.spreadsheet, { class_session_id: cls.session_id, attendance_status: 'ATTENDED' }, env.actor);
    }
    const pkgs = PackageRepository.Packages_getByStudentId(env.spreadsheet, env.studentAId);
    const enriched = PackageService.Packages_enrichWithBalance(env.spreadsheet, pkgs);
    expect(enriched.find((p: any) => p.package_name === 'Twin A').remaining_classes).toBe(0);
    expect(enriched.find((p: any) => p.package_name === 'Twin B').remaining_classes).toBe(4);
  });

  it('Scenario G: Late cancellation and restoration concurrency safety', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'Pack G', purchased_classes: 5, start_date: '2026-01-01'
    }, env.actor);
    const c = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, scheduled_start: '2026-01-10T10:00:00.000Z'
    }, env.actor).data;
    ClassService.Classes_cancel(env.spreadsheet, { class_session_id: c.session_id, deduct_class: true }, env.actor);
    expect(ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId).availableCredits).toBe(4);
    ClassService.Classes_restoreCredit(env.spreadsheet, { class_session_id: c.session_id }, env.actor);
    expect(ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId).availableCredits).toBe(5);
  });
});
