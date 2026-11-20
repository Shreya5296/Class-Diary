import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupExtraClassTestEnvironment } from './extraClassBackendTestHarness';

const ClassService = require('../../02-backend/apps-script/classes/ClassService.gs');
const PackageService = require('../../02-backend/apps-script/packages/PackageService.gs');
const ClassRepository = require('../../02-backend/apps-script/classes/ClassRepository.gs');
const { registerClassOperations } = require('../../02-backend/apps-script/classes/ClassHandlers.gs');

describe('Extra Class Lifecycle Protection & Partial Failure Handling', () => {
  let env: ReturnType<typeof setupExtraClassTestEnvironment>;
  const registry: Record<string, Function> = {};
  const mockRouter = { registerOperation: (name: string, fn: Function) => { registry[name] = fn; } };

  beforeEach(() => {
    env = setupExtraClassTestEnvironment();
    registerClassOperations(mockRouter);
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'P10', classes_purchased: 10,
      start_date: '2026-11-01', end_date: '2026-12-31', package_status: 'ACTIVE'
    }, env.actor);
  });

  afterEach(() => {
    ClassService._setLockManager(require('../../02-backend/apps-script/sheets/LockManager.gs'));
  });

  it('rejects generic update attempting to modify lifecycle or credit fields', () => {
    const s1 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-20T10:00:00.000Z', scheduled_end: '2026-11-20T11:00:00.000Z' }
    });
    const sid = s1.data.class_session_id;

    for (const payload of [
      { class_session_id: sid, session_status: 'COMPLETED' },
      { class_session_id: sid, attendance_status: 'PRESENT' },
      { class_session_id: sid, deduct_class: true },
      { class_session_id: sid, status: 'CANCELLED' },
      { class_session_id: sid, outcome: 'ATTENDED' }
    ]) {
      const res = registry['classes.update']({ spreadsheet: env.spreadsheet, actorId: env.actor.actorId, payload });
      expect(res.success).toBe(false);
      expect(res.code).toBe('LIFECYCLE_OPERATION_REQUIRED');
    }

    const fresh = ClassRepository.Classes_getById(env.spreadsheet, sid);
    expect(fresh.session_status).toBe('SCHEDULED');
    expect(fresh.attendance_status).toBe('NOT_MARKED');
    expect(fresh.deduct_class).toBe(false);
  });

  it('rejects batch update containing lifecycle fields before performing any writes', () => {
    const s1 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-20T10:00:00.000Z', scheduled_end: '2026-11-20T11:00:00.000Z' }
    });
    const s2 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-21T10:00:00.000Z', scheduled_end: '2026-11-21T11:00:00.000Z' }
    });

    const bRes = registry['classes.batchUpdate']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: {
        updates: [
          { class_session_id: s1.data.class_session_id, notes: 'Valid note' },
          { class_session_id: s2.data.class_session_id, attendance_status: 'PRESENT' }
        ]
      }
    });
    expect(bRes.success).toBe(false);
    expect(bRes.code).toBe('LIFECYCLE_OPERATION_REQUIRED');

    expect(ClassRepository.Classes_getById(env.spreadsheet, s1.data.class_session_id).session_notes).toBe('');
    expect(ClassRepository.Classes_getById(env.spreadsheet, s2.data.class_session_id).attendance_status).toBe('NOT_MARKED');
  });

  it('reports explicit PARTIAL_BATCH_FAILURE when a repository write fails after earlier writes succeeded', () => {
    const s1 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-20T10:00:00.000Z', scheduled_end: '2026-11-20T11:00:00.000Z' }
    });
    const s2 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-21T10:00:00.000Z', scheduled_end: '2026-11-21T11:00:00.000Z' }
    });

    const all = ClassRepository.Classes_getAll(env.spreadsheet);
    const s2Row = all.find((s: any) => s.class_session_id === s2.data.class_session_id)._rowIndex;
    const originalRepoUpdate = ClassRepository.Classes_update;
    ClassRepository.Classes_update = (ss: any, id: any, updates: any) => {
      if (Number(id) === s2Row || (updates && Number(updates._rowIndex) === s2Row)) return null;
      return originalRepoUpdate(ss, id, updates);
    };

    try {
      const res = registry['classes.batchUpdate']({
        spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
        payload: {
          updates: [
            { class_session_id: s1.data.class_session_id, notes: 'Session 1 Note' },
            { class_session_id: s2.data.class_session_id, notes: 'Session 2 Note' }
          ]
        }
      });
      expect(res.success).toBe(false);
      expect(res.code).toBe('PARTIAL_BATCH_FAILURE');
      expect(res.partialChangesOccurred).toBe(true);
      expect(res.successfulCount).toBe(1);
      expect(res.failedCount).toBe(1);
      expect(res.successfulSessions).toContain(s1.data.class_session_id);
    } finally {
      ClassRepository.Classes_update = originalRepoUpdate;
    }
  });

  it('dedicated operations succeed under lock and properly adjust credit balances', () => {
    const s1 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-20T10:00:00.000Z', scheduled_end: '2026-11-20T11:00:00.000Z' }
    });
    const sid = s1.data.class_session_id;

    // 1. Dedicated completion consumes 1 credit
    const comp = registry['classes.complete']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { class_session_id: sid, attendance_status: 'PRESENT' }
    });
    expect(comp.success).toBe(true);
    expect(env.getBackendAvailableBalance(env.studentAId).consumed).toBe(1);

    // 2. Dedicated restoration restores credit
    const rest = registry['classes.restoreCredit']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { class_session_id: sid }
    });
    expect(rest.success).toBe(true);
    expect(env.getBackendAvailableBalance(env.studentAId).consumed).toBe(0);

    // 3. Dedicated cancellation respects cancellation rules
    const canc = registry['classes.cancel']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { class_session_id: sid, cancellation_reason: 'Timely student reschedule', waive_credit: true }
    });
    expect(canc.success).toBe(true);
    expect(env.getBackendAvailableBalance(env.studentAId).consumed).toBe(0);
  });
});
