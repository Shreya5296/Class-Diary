import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupExtraClassTestEnvironment } from './extraClassBackendTestHarness';

const ClassService = require('../../02-backend/apps-script/classes/ClassService.gs');
const ClassEntitlementService = require('../../02-backend/apps-script/classes/ClassEntitlementService.gs');
const PackageService = require('../../02-backend/apps-script/packages/PackageService.gs');
const PackageRepository = require('../../02-backend/apps-script/packages/PackageRepository.gs');
const { registerClassOperations } = require('../../02-backend/apps-script/classes/ClassHandlers.gs');

describe('Extra Class Mutation Lock Boundary & Package Identity', () => {
  let env: ReturnType<typeof setupExtraClassTestEnvironment>;
  const registry: Record<string, Function> = {};
  const mockRouter = { registerOperation: (name: string, fn: Function) => { registry[name] = fn; } };

  beforeEach(() => {
    env = setupExtraClassTestEnvironment();
    registerClassOperations(mockRouter);
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'Pack 10', classes_purchased: 10,
      start_date: '2026-11-01', end_date: '2026-12-31', package_status: 'ACTIVE'
    }, env.actor);
  });

  afterEach(() => {
    ClassService._setLockManager(require('../../02-backend/apps-script/sheets/LockManager.gs'));
    ClassEntitlementService._setPackageRepository(PackageRepository);
  });

  it('routes classes.update and classes.batchUpdate under lock boundary', () => {
    const s1 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-20T10:00:00.000Z', scheduled_end: '2026-11-20T11:00:00.000Z' }
    });
    const s2 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-21T10:00:00.000Z', scheduled_end: '2026-11-21T11:00:00.000Z' }
    });
    expect(s1.success && s2.success).toBe(true);

    const updRes = registry['classes.update']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { class_session_id: s1.data.class_session_id, session_notes: 'Updated lesson plan' }
    });
    expect(updRes.success).toBe(true);
    expect(updRes.data.session_notes).toBe('Updated lesson plan');

    const bUpdRes = registry['classes.batchUpdate']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { updates: [{ class_session_id: s2.data.class_session_id, notes: 'Batch note' }] }
    });
    expect(bUpdRes.success).toBe(true);
    expect(bUpdRes.count).toBe(1);
    expect(bUpdRes.data[0].session_notes).toBe('Batch note');

    // Dedicated completion records attendance under lock
    const compRes = registry['classes.complete']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { class_session_id: s1.data.class_session_id, attendance_status: 'PRESENT' }
    });
    expect(compRes.success).toBe(true);
    expect(compRes.data.session_status).toBe('COMPLETED');
    expect(compRes.data.deduct_class).toBe(true);

    const bal = env.getBackendAvailableBalance(env.studentAId);
    expect(bal.consumed).toBe(1);
    expect(bal.reserved).toBe(1);
    expect(bal.available).toBe(8);
  });

  it('fails closed when LockManager is unavailable or locks fail', () => {
    ClassService._setLockManager(null);
    const failUpdate = registry['classes.update']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { class_session_id: 'any_id', notes: 'test' }
    });
    expect(failUpdate.success).toBe(false);
    expect(failUpdate.code).toBe('LOCK_UNAVAILABLE');

    const failBatch = registry['classes.batchUpdate']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { updates: [{ class_session_id: 'any_id' }] }
    });
    expect(failBatch.success).toBe(false);
    expect(failBatch.code).toBe('LOCK_UNAVAILABLE');
  });

  it('preserves twin package row identity in memory overlay without misattribution', () => {
    const sheet = env.spreadsheet.getSheetByName('Packages');
    sheet.appendRow([
      env.studentAId, 'Twin Pkg A', 'Standard', 5, 500, 'PAID', '2026-11-01', '2026-12-31', '', 'ACTIVE', '', ''
    ]);
    const row2Idx = sheet.getLastRow();
    sheet.appendRow([
      env.studentAId, 'Twin Pkg B', 'Standard', 5, 500, 'PAID', '2026-11-01', '2026-12-31', '', 'ACTIVE', '', ''
    ]);
    const row3Idx = sheet.getLastRow();
    expect(row2Idx).not.toBe(row3Idx);

    // In-memory overlay marks ONLY row 2 as CANCELLED
    (globalThis as any).__pkgMemoryMap = {
      'mem_row_2': {
        student_id: env.studentAId,
        _rowIndex: row2Idx,
        start_date: '2026-11-01',
        plan_type: 'Standard',
        status: 'CANCELLED',
        package_status: 'CANCELLED'
      }
    };

    const entitlement = ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentAId);
    expect(entitlement.valid).toBe(true);
    expect(entitlement.hasEntitlement).toBe(true);
    expect(entitlement.available).toBeGreaterThan(0);

    const studentPkgs = PackageRepository.Packages_getByStudentId(env.spreadsheet, env.studentAId);
    const enrichedRow2 = PackageService.Packages_enrichWithBalance(env.spreadsheet, studentPkgs.find((p: any) => p._rowIndex === row2Idx));
    const enrichedRow3 = PackageService.Packages_enrichWithBalance(env.spreadsheet, studentPkgs.find((p: any) => p._rowIndex === row3Idx));
    expect(enrichedRow2._rowIndex).toBe(row2Idx);
    expect(enrichedRow3._rowIndex).toBe(row3Idx);
  });

  it('allows date/plan fallback when row indices are genuinely absent', () => {
    (globalThis as any).__pkgMemoryMap = {
      'mem_synth': {
        student_id: env.studentBId,
        start_date: '2026-11-01',
        plan_type: 'Standard',
        status: 'CANCELLED',
        package_status: 'CANCELLED'
      }
    };

    const pkgNoRow = {
      student_id: env.studentBId,
      start_date: '2026-11-01',
      plan_type: 'Standard',
      classes_purchased: 5
    };
    ClassEntitlementService._setPackageRepository({
      Packages_getByStudentId: () => [pkgNoRow]
    });

    const entitlement = ClassEntitlementService.checkBookingEntitlement(env.spreadsheet, env.studentBId);
    expect(entitlement.valid).toBe(false);
    expect(entitlement.code).toBe('INSUFFICIENT_PACKAGE_CREDITS');
  });
});
