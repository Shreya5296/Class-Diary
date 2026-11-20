import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupExtraClassTestEnvironment } from './extraClassBackendTestHarness';

const ClassService = require('../../02-backend/apps-script/classes/ClassService.gs');
const PackageService = require('../../02-backend/apps-script/packages/PackageService.gs');
const ClassRepository = require('../../02-backend/apps-script/classes/ClassRepository.gs');
const { registerClassOperations } = require('../../02-backend/apps-script/classes/ClassHandlers.gs');

describe('Batch Write Exception Transparency & Write Outcome Uncertainty', () => {
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

  it('reports PARTIAL_BATCH_FAILURE with writeOutcomeUnknown when second write throws', () => {
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
    const s2Row = ClassRepository.Classes_getAll(env.spreadsheet).find((s: any) => s.class_session_id === s2Id)._rowIndex;

    const originalRepoUpdate = ClassRepository.Classes_update;
    ClassRepository.Classes_update = (ss: any, id: any, updates: any) => {
      if (Number(id) === s2Row || (updates && Number(updates._rowIndex) === s2Row)) {
        throw new Error('Sheets timeout on row ' + s2Row);
      }
      return originalRepoUpdate(ss, id, updates);
    };

    try {
      const res = registry['classes.batchUpdate']({
        spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
        payload: { updates: [{ class_session_id: s1Id, notes: 'Persisted 1' }, { class_session_id: s2Id, notes: 'Failed 2' }] }
      });
      expect(res.success).toBe(false);
      expect(res.code).toBe('PARTIAL_BATCH_FAILURE');
      expect(res.partialChangesOccurred).toBe(true);
      expect(res.writeOutcomeUnknown).toBe(true);
      expect(res.successfulCount).toBe(1);
      expect(res.successfulSessions).toEqual([s1Id]);
      expect(res.failedSessions).toEqual([s2Id]);
      expect(ClassRepository.Classes_getById(env.spreadsheet, s1Id).session_notes).toBe('Persisted 1');
    } finally {
      ClassRepository.Classes_update = originalRepoUpdate;
    }
  });

  it('does not falsely claim zero changes when first write persists before throwing', () => {
    const s1 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-20T10:00:00.000Z', scheduled_end: '2026-11-20T11:00:00.000Z' }
    });
    const s1Id = s1.data.class_session_id;

    const originalRepoUpdate = ClassRepository.Classes_update;
    ClassRepository.Classes_update = (ss: any, id: any, updates: any) => {
      originalRepoUpdate(ss, id, updates); // Write successfully persists in sheet
      throw new Error('Connection reset after socket write');
    };

    try {
      const res = registry['classes.batchUpdate']({
        spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
        payload: { updates: [{ class_session_id: s1Id, notes: 'Actually Persisted Note' }] }
      });
      expect(res.success).toBe(false);
      expect(res.code).toBe('BATCH_UPDATE_FAILED');
      expect(res.writeOutcomeUnknown).toBe(true);
      expect(res.partialChangesOccurred).toBeUndefined(); // does not falsely claim zero changes
      expect(res.message).toContain('Write outcome is uncertain');
      // Confirmed write actually made it to the sheet despite the error
      expect(ClassRepository.Classes_getById(env.spreadsheet, s1Id).session_notes).toBe('Actually Persisted Note');
    } finally {
      ClassRepository.Classes_update = originalRepoUpdate;
    }
  });

  it('reports zero changes when first write returns null from repository contract', () => {
    const s1 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-20T10:00:00.000Z', scheduled_end: '2026-11-20T11:00:00.000Z' }
    });
    const s1Id = s1.data.class_session_id;

    const originalRepoUpdate = ClassRepository.Classes_update;
    ClassRepository.Classes_update = () => null; // Contract guarantees no write occurred

    try {
      const res = registry['classes.batchUpdate']({
        spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
        payload: { updates: [{ class_session_id: s1Id, notes: 'Unwritten Note' }] }
      });
      expect(res.success).toBe(false);
      expect(res.code).toBe('BATCH_UPDATE_FAILED');
      expect(res.partialChangesOccurred).toBe(false); // accurately claims zero changes
      expect(res.writeOutcomeUnknown).toBeUndefined();
      expect(res.successfulCount).toBe(0);
      expect(ClassRepository.Classes_getById(env.spreadsheet, s1Id).session_notes).toBe('');
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
    expect(res.writeOutcomeUnknown).toBeUndefined();
  });
});
