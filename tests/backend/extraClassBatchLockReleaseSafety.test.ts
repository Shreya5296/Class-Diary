import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupExtraClassTestEnvironment } from './extraClassBackendTestHarness';

const ClassService = require('../../02-backend/apps-script/classes/ClassService.gs');
const PackageService = require('../../02-backend/apps-script/packages/PackageService.gs');
const ClassRepository = require('../../02-backend/apps-script/classes/ClassRepository.gs');
const LockManager = require('../../02-backend/apps-script/sheets/LockManager.gs');
const { registerClassOperations } = require('../../02-backend/apps-script/classes/ClassHandlers.gs');

describe('Batch Lock Release Failure Safety & Outcome Preservation', () => {
  let env: ReturnType<typeof setupExtraClassTestEnvironment>;
  const registry: Record<string, Function> = {};
  const mockRouter = { registerOperation: (n: string, fn: Function) => { registry[n] = fn; } };
  const origLS = (globalThis as any).LockService;

  beforeEach(() => {
    env = setupExtraClassTestEnvironment();
    registerClassOperations(mockRouter);
    ClassService._setLockManager(LockManager);
    LockManager._resetLockState();
    PackageService.Packages_create(env.spreadsheet, {
      student_id: env.studentAId, package_name: 'P10', classes_purchased: 10,
      start_date: '2026-11-01', end_date: '2026-12-31', package_status: 'ACTIVE'
    }, env.actor);
  });

  afterEach(() => {
    (globalThis as any).LockService = origLS;
    LockManager._resetLockState();
    ClassService._setLockManager(LockManager);
  });

  it('preserves successful batch mutation and reports lockReleaseFailed when releaseLock throws', () => {
    const s1 = registry['classes.schedule']({ spreadsheet: env.spreadsheet, actorId: env.actor.actorId, payload: { student_id: env.studentAId, scheduled_start: '2026-11-20T10:00:00.000Z' } });
    const s2 = registry['classes.schedule']({ spreadsheet: env.spreadsheet, actorId: env.actor.actorId, payload: { student_id: env.studentAId, scheduled_start: '2026-11-21T10:00:00.000Z' } });

    (globalThis as any).LockService = {
      getScriptLock: () => ({ tryLock: () => true, releaseLock: () => { throw new Error('LockService release timeout'); } })
    };

    const res = registry['classes.batchUpdate']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { updates: [{ class_session_id: s1.data.class_session_id, notes: 'Persisted Note 1' }, { class_session_id: s2.data.class_session_id, notes: 'Persisted Note 2' }] }
    });

    expect(res.success).toBe(true);
    expect(res.count).toBe(2);
    expect(res.lockReleaseFailed).toBe(true);
    expect(res.lockReleaseError).toContain('LockService release timeout');
    expect(ClassRepository.Classes_getById(env.spreadsheet, s1.data.class_session_id).session_notes).toBe('Persisted Note 1');
    expect(ClassRepository.Classes_getById(env.spreadsheet, s2.data.class_session_id).session_notes).toBe('Persisted Note 2');
  });

  it('preserves partial batch failure details and reports lockReleaseFailed when release throws', () => {
    const s1 = registry['classes.schedule']({ spreadsheet: env.spreadsheet, actorId: env.actor.actorId, payload: { student_id: env.studentAId, scheduled_start: '2026-11-20T10:00:00.000Z' } });
    const s2 = registry['classes.schedule']({ spreadsheet: env.spreadsheet, actorId: env.actor.actorId, payload: { student_id: env.studentAId, scheduled_start: '2026-11-21T10:00:00.000Z' } });

    const s2Row = ClassRepository.Classes_getAll(env.spreadsheet).find((s: any) => s.class_session_id === s2.data.class_session_id)._rowIndex;
    const origRepoUpdate = ClassRepository.Classes_update;
    ClassRepository.Classes_update = (ss: any, id: any, upd: any) => {
      if (Number(id) === s2Row || (upd && Number(upd._rowIndex) === s2Row)) return null;
      return origRepoUpdate(ss, id, upd);
    };

    (globalThis as any).LockService = {
      getScriptLock: () => ({ tryLock: () => true, releaseLock: () => { throw new Error('Release deadlock exception'); } })
    };

    try {
      const res = registry['classes.batchUpdate']({
        spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
        payload: { updates: [{ class_session_id: s1.data.class_session_id, notes: 'Saved Note 1' }, { class_session_id: s2.data.class_session_id, notes: 'Dropped Note 2' }] }
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('PARTIAL_BATCH_FAILURE');
      expect(res.partialChangesOccurred).toBe(true);
      expect(res.successfulCount).toBe(1);
      expect(res.successfulSessions).toEqual([s1.data.class_session_id]);
      expect(res.failedSessions).toEqual([s2.data.class_session_id]);
      expect(res.lockReleaseFailed).toBe(true);
      expect(res.lockReleaseError).toContain('Release deadlock exception');
      expect(ClassRepository.Classes_getById(env.spreadsheet, s1.data.class_session_id).session_notes).toBe('Saved Note 1');
    } finally {
      ClassRepository.Classes_update = origRepoUpdate;
    }
  });

  it('preserves EXECUTION_ERROR and release failure when mutation callback and releaseLock both throw', () => {
    const origGetAll = ClassRepository.Classes_getAll;
    ClassRepository.Classes_getAll = () => { throw new Error('Database read crash inside batch'); };

    (globalThis as any).LockService = {
      getScriptLock: () => ({ tryLock: () => true, releaseLock: () => { throw new Error('Secondary release lock failure'); } })
    };

    try {
      const res = registry['classes.batchUpdate']({
        spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
        payload: { updates: [{ class_session_id: 's_1', notes: 'Note' }] }
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('EXECUTION_ERROR');
      expect(res.message).toBe('Database read crash inside batch');
      expect(res.lockReleaseFailed).toBe(true);
      expect(res.lockReleaseError).toContain('Secondary release lock failure');
      expect(LockManager._getLockDepth()).toBe(0);
    } finally {
      ClassRepository.Classes_getAll = origGetAll;
    }
  });

  it('prevents all mutations when lock acquisition fails', () => {
    (globalThis as any).LockService = { getScriptLock: () => ({ tryLock: () => false, releaseLock: () => {} }) };
    const res = registry['classes.batchUpdate']({ spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { updates: [{ class_session_id: 'any_session', notes: 'Should not write' }] } });
    expect(res.success).toBe(false);
    expect(res.code).toBe('CONFLICT');
    expect(res.lockReleaseFailed).toBeUndefined();
  });

  it('handles callback exceptions properly with execution error', () => {
    (globalThis as any).LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
    const res = LockManager.withLock(5000, () => { throw new Error('Callback boom'); });
    expect(res.success).toBe(false);
    expect(res.code).toBe('EXECUTION_ERROR');
    expect(res.message).toBe('Callback boom');
    expect(LockManager._getLockDepth()).toBe(0);
  });

  it('completes normal callback and lock release without release errors', () => {
    (globalThis as any).LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
    const res = LockManager.withLock(5000, () => ({ success: true, count: 5 }));
    expect(res.success).toBe(true);
    expect(res.result.count).toBe(5);
    expect(res.lockReleaseFailed).toBeUndefined();
    expect(LockManager._getLockDepth()).toBe(0);
  });
});
