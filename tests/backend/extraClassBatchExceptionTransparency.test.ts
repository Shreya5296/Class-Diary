import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupExtraClassTestEnvironment } from './extraClassBackendTestHarness';

const ClassService = require('../../02-backend/apps-script/classes/ClassService.gs');
const PackageService = require('../../02-backend/apps-script/packages/PackageService.gs');
const ClassRepository = require('../../02-backend/apps-script/classes/ClassRepository.gs');
const { registerClassOperations } = require('../../02-backend/apps-script/classes/ClassHandlers.gs');

describe('Batch Write Exception Transparency & Partial Failure Handling', () => {
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

  it('reports PARTIAL_BATCH_FAILURE when second write throws an exception', () => {
    const s1 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-20T10:00:00.000Z', scheduled_end: '2026-11-20T11:00:00.000Z' }
    });
    const s2 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-21T10:00:00.000Z', scheduled_end: '2026-11-21T11:00:00.000Z' }
    });

    const s1Id = s1.data.class_session_id;
    const s2Id = s2.data.class_session_id;
    const all = ClassRepository.Classes_getAll(env.spreadsheet);
    const s2Row = all.find((s: any) => s.class_session_id === s2Id)._rowIndex;

    const originalRepoUpdate = ClassRepository.Classes_update;
    ClassRepository.Classes_update = (ss: any, id: any, updates: any) => {
      if (Number(id) === s2Row || (updates && Number(updates._rowIndex) === s2Row)) {
        throw new Error('Google Sheets Service Unavailable on row ' + s2Row);
      }
      return originalRepoUpdate(ss, id, updates);
    };

    try {
      const res = registry['classes.batchUpdate']({
        spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
        payload: {
          updates: [
            { class_session_id: s1Id, notes: 'Persisted Note 1' },
            { class_session_id: s2Id, notes: 'Failed Note 2' }
          ]
        }
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('PARTIAL_BATCH_FAILURE');
      expect(res.partialChangesOccurred).toBe(true);
      expect(res.successfulCount).toBe(1);
      expect(res.failedCount).toBe(1);
      expect(res.successfulSessions).toEqual([s1Id]);
      expect(res.failedSessions).toEqual([s2Id]);
      expect(res.message).toContain('Google Sheets Service Unavailable');
      expect(res.data).toHaveLength(1);

      // Verify first update remains persisted
      const fresh1 = ClassRepository.Classes_getById(env.spreadsheet, s1Id);
      expect(fresh1.session_notes).toBe('Persisted Note 1');
      // Verify second session was untouched
      const fresh2 = ClassRepository.Classes_getById(env.spreadsheet, s2Id);
      expect(fresh2.session_notes).toBe('');
    } finally {
      ClassRepository.Classes_update = originalRepoUpdate;
    }
  });

  it('reports BATCH_UPDATE_FAILED when the first write throws an exception', () => {
    const s1 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-20T10:00:00.000Z', scheduled_end: '2026-11-20T11:00:00.000Z' }
    });
    const s2 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-21T10:00:00.000Z', scheduled_end: '2026-11-21T11:00:00.000Z' }
    });

    const s1Id = s1.data.class_session_id;
    const s2Id = s2.data.class_session_id;

    const originalRepoUpdate = ClassRepository.Classes_update;
    ClassRepository.Classes_update = () => {
      throw new Error('Immediate sheet write exception on first row');
    };

    try {
      const res = registry['classes.batchUpdate']({
        spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
        payload: {
          updates: [
            { class_session_id: s1Id, notes: 'Note 1' },
            { class_session_id: s2Id, notes: 'Note 2' }
          ]
        }
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('BATCH_UPDATE_FAILED');
      expect(res.partialChangesOccurred).toBe(false);
      expect(res.successfulCount).toBe(0);
      expect(res.failedCount).toBe(1);
      expect(res.successfulSessions).toEqual([]);
      expect(res.failedSessions).toEqual([s1Id]);
      expect(res.data).toEqual([]);

      // Verify neither update was persisted
      expect(ClassRepository.Classes_getById(env.spreadsheet, s1Id).session_notes).toBe('');
      expect(ClassRepository.Classes_getById(env.spreadsheet, s2Id).session_notes).toBe('');
    } finally {
      ClassRepository.Classes_update = originalRepoUpdate;
    }
  });

  it('preserves script lock failure boundary without misrepresenting it as write failure', () => {
    const mockLockManager = {
      withLock: () => ({ success: false, code: 'CONFLICT', message: 'Could not acquire script lock within timeout; try again' })
    };
    ClassService._setLockManager(mockLockManager);

    const res = registry['classes.batchUpdate']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { updates: [{ class_session_id: 'any_id', notes: 'Note' }] }
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe('CONFLICT');
    expect(res.partialChangesOccurred).toBeUndefined();
  });
});
