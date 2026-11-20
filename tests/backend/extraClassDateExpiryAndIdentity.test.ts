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

describe('Date-Based Expiry & Row Identity Matching (Iteration 1.9)', () => {
  let env: ReturnType<typeof setupExtraClassTestEnvironment>;

  beforeEach(() => {
    env = setupExtraClassTestEnvironment();
    delete (globalThis as any).__sessionMetaMap;
    delete (globalThis as any).__pkgMemoryMap;
  });

  it('verifies physical row identity matching with identical start dates and plans', () => {
    PackageRepository.Packages_insert(env.spreadsheet, {
      student_id: env.studentAId, plan_type: 'PACKAGE', classes_purchased: 5, start_date: '2026-08-01'
    });
    PackageRepository.Packages_insert(env.spreadsheet, {
      student_id: env.studentAId, plan_type: 'PACKAGE', classes_purchased: 5, start_date: '2026-08-01'
    });

    for (let i = 1; i <= 6; i++) {
      const cls = ClassService.Classes_schedule(env.spreadsheet, {
        student_id: env.studentAId, scheduled_start: `2026-08-0${i}T10:00:00.000Z`
      }, env.actor).data;
      ClassService.Classes_complete(env.spreadsheet, { class_session_id: cls.session_id, attendance_status: 'ATTENDED' }, env.actor);
    }

    delete (globalThis as any).__sessionMetaMap;
    delete (globalThis as any).__pkgMemoryMap;

    const persistedPkgs = PackageRepository.Packages_getByStudentId(env.spreadsheet, env.studentAId);
    expect(persistedPkgs.length).toBe(2);
    expect(persistedPkgs[0]._rowIndex).toBe(2);
    expect(persistedPkgs[1]._rowIndex).toBe(3);

    // Verify both enriched records independently
    const enr1 = PackageService.Packages_enrichWithBalance(env.spreadsheet, persistedPkgs[0]);
    const enr2 = PackageService.Packages_enrichWithBalance(env.spreadsheet, persistedPkgs[1]);

    expect(enr1.consumed_classes).toBe(5);
    expect(enr1.remaining_classes).toBe(0);
    expect(enr2.consumed_classes).toBe(1);
    expect(enr2.remaining_classes).toBe(4);
  });

  it('verifies end_date policy: end_date represents projected last class, not credit forfeiture', () => {
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, plan_type: 'PACKAGE', purchased_classes: 10, start_date: '2026-01-01', end_date: '2026-06-30'
    }, env.actor);

    for (let i = 1; i <= 4; i++) {
      const cls = ClassService.Classes_schedule(env.spreadsheet, {
        student_id: env.studentAId, scheduled_start: `2026-01-0${i}T10:00:00.000Z`
      }, env.actor).data;
      ClassService.Classes_complete(env.spreadsheet, { class_session_id: cls.session_id, attendance_status: 'PRESENT' }, env.actor);
    }

    delete (globalThis as any).__sessionMetaMap;
    delete (globalThis as any).__pkgMemoryMap;

    // In existing business rules, end_date does not forfeit unconsumed credits
    const onDate = ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId, null, null, '2026-06-30');
    expect(onDate.valid).toBe(true);
    expect(onDate.availableCredits).toBe(6);

    const pastDate = ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId, null, null, '2026-07-01');
    expect(pastDate.valid).toBe(true);
    expect(pastDate.availableCredits).toBe(6);
  });

  it('verifies historical FIFO allocation remains unchanged when older package is explicitly EXPIRED', () => {
    const oldPkg = PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, plan_type: 'PACKAGE', purchased_classes: 10, start_date: '2026-01-01', end_date: '2026-06-30'
    }, env.actor).data;

    for (let i = 1; i <= 4; i++) {
      const cls = ClassService.Classes_schedule(env.spreadsheet, {
        student_id: env.studentAId, scheduled_start: `2026-01-0${i}T10:00:00.000Z`
      }, env.actor).data;
      ClassService.Classes_complete(env.spreadsheet, { class_session_id: cls.session_id, attendance_status: 'PRESENT' }, env.actor);
    }

    // Now mark old package as EXPIRED
    (globalThis as any).__pkgMemoryMap = (globalThis as any).__pkgMemoryMap || {};
    (globalThis as any).__pkgMemoryMap[oldPkg.package_id] = Object.assign({}, oldPkg, { status: 'EXPIRED', package_status: 'EXPIRED' });

    // Solo expired package forfeits remaining 6 credits -> 0 bookable credits
    const soloExpired = ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId, null, null, '2026-07-01');
    expect(soloExpired.valid).toBe(false);
    expect(soloExpired.availableCredits).toBe(0);

    // Now add an active renewal package of 10 classes
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, plan_type: 'PACKAGE', purchased_classes: 10, start_date: '2026-07-01', end_date: '2026-12-31'
    }, env.actor);

    // Entitlement with active renewal package: 10 credits from new package; 4 historical sessions remain allocated to Package 1
    const ent = ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId, null, null, '2026-07-05');
    expect(ent.valid).toBe(true);
    expect(ent.availableCredits).toBe(10);
    expect(ent.consumed).toBe(4);

    const pkgs = PackageRepository.Packages_getByStudentId(env.spreadsheet, env.studentAId);
    const enriched = PackageService.Packages_enrichWithBalance(env.spreadsheet, pkgs);
    const p1 = enriched.find((p: any) => p._rowIndex === 2);
    const p2 = enriched.find((p: any) => p._rowIndex === 3);
    expect(p1.consumed_classes).toBe(4);
    expect(p1.consumed_classes).toBe(4);
    expect(p1.remaining_classes).toBe(6);
    expect(p2.consumed_classes).toBe(0);
    expect(p2.remaining_classes).toBe(10);
  });
});
