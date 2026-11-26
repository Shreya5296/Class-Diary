import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupExtraClassTestEnvironment } from './extraClassBackendTestHarness';

const ClassService = require('../../02-backend/apps-script/classes/ClassService.gs');
const PackageService = require('../../02-backend/apps-script/packages/PackageService.gs');
const ClassRepository = require('../../02-backend/apps-script/classes/ClassRepository.gs');
const { registerClassOperations } = require('../../02-backend/apps-script/classes/ClassHandlers.gs');

describe('Extra Class Update Identity Integrity & Lock Enforcement', () => {
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

  it('1 & 3: rejects updating session A using session B row index or overriding row identity', () => {
    const s1 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-20T10:00:00.000Z', scheduled_end: '2026-11-20T11:00:00.000Z' }
    });
    const s2 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-21T10:00:00.000Z', scheduled_end: '2026-11-21T11:00:00.000Z' }
    });
    const all = ClassRepository.Classes_getAll(env.spreadsheet);
    const s1Row = all.find((s: any) => s.class_session_id === s1.data.class_session_id)._rowIndex;
    const s2Row = all.find((s: any) => s.class_session_id === s2.data.class_session_id)._rowIndex;
    expect(s1Row).not.toBe(s2Row);

    const mismatch = registry['classes.update']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { class_session_id: s1.data.class_session_id, _rowIndex: s2Row, session_notes: 'Corrupt' }
    });
    expect(mismatch.success).toBe(false);
    expect(mismatch.code).toBe('IDENTITY_CONFLICT');
    expect(ClassRepository.Classes_getById(env.spreadsheet, s2.data.class_session_id).session_notes).not.toBe('Corrupt');
  });

  it('2: rejects requests attempting to mutate student_id on an existing session', () => {
    const s1 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-20T10:00:00.000Z', scheduled_end: '2026-11-20T11:00:00.000Z' }
    });
    const hijacked = registry['classes.update']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { class_session_id: s1.data.class_session_id, student_id: env.studentBId, session_notes: 'Hijacked' }
    });
    expect(hijacked.success).toBe(false);
    expect(hijacked.code).toBe('FORBIDDEN_MUTATION');
    expect(ClassRepository.Classes_getById(env.spreadsheet, s1.data.class_session_id).student_id).toBe(env.studentAId);
  });

  it('4 & 5: batch update enforces identity rules and avoids partial writes on failure', () => {
    const s1 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-20T10:00:00.000Z', scheduled_end: '2026-11-20T11:00:00.000Z' }
    });

    const batchRes = registry['classes.batchUpdate']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: {
        updates: [
          { class_session_id: s1.data.class_session_id, session_notes: 'Valid note' },
          { class_session_id: 'non_existent_session', session_notes: 'Invalid note' }
        ]
      }
    });
    expect(batchRes.success).toBe(false);
    expect(batchRes.code).toBe('RECORD_NOT_FOUND');
    expect(ClassRepository.Classes_getById(env.spreadsheet, s1.data.class_session_id).session_notes).toBe('');
  });

  it('6 & 7: scalar invocation acquires lock; lock contention blocks writes safely', () => {
    const s1 = registry['classes.schedule']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { student_id: env.studentAId, scheduled_start: '2026-11-20T10:00:00.000Z', scheduled_end: '2026-11-20T11:00:00.000Z' }
    });

    // Contention: tryLock fails because lock is currently held by another operation
    ClassService._setLockManager({
      withLock: () => ({ success: false, code: 'CONFLICT', message: 'Active lock contention' })
    });
    const scalarRes = ClassService.Classes_update(env.spreadsheet, s1.data.class_session_id, { session_notes: 'Under Contention' });
    expect(scalarRes.success).toBe(false);
    expect(scalarRes.code).toBe('CONFLICT');
    expect(ClassRepository.Classes_getById(env.spreadsheet, s1.data.class_session_id).session_notes).toBe('');

    // Restore lock and confirm scalar invocation succeeds under lock
    ClassService._setLockManager(require('../../02-backend/apps-script/sheets/LockManager.gs'));
    const successRes = ClassService.Classes_update(env.spreadsheet, s1.data.class_session_id, { session_notes: 'Now Under Lock' });
    expect(successRes.success).toBe(true);
    expect(ClassRepository.Classes_getById(env.spreadsheet, s1.data.class_session_id).session_notes).toBe('Now Under Lock');
  });

  it('8 & 9: credit balances remain accurate after complete, restore, cancel, and update', () => {
    const sched = ClassService.Classes_schedule(env.spreadsheet, {
      student_id: env.studentAId, scheduled_start: '2026-11-24T10:00:00.000Z', scheduled_end: '2026-11-24T11:00:00.000Z'
    }, env.actor);
    const sid = sched.data.class_session_id;
    expect(env.getBackendAvailableBalance(env.studentAId).reserved).toBe(1);

    const upd = registry['classes.update']({
      spreadsheet: env.spreadsheet, actorId: env.actor.actorId,
      payload: { class_session_id: sid, session_notes: 'Mid-term prep' }
    });
    expect(upd.success).toBe(true);
    expect(env.getBackendAvailableBalance(env.studentAId).reserved).toBe(1);

    const comp = ClassService.Classes_complete(env.spreadsheet, { class_session_id: sid, attendance_status: 'PRESENT' }, env.actor);
    expect(comp.success).toBe(true);
    expect(env.getBackendAvailableBalance(env.studentAId).consumed).toBe(1);

    const rest = ClassService.Classes_restoreCredit(env.spreadsheet, { class_session_id: sid }, env.actor);
    expect(rest.success).toBe(true);
    expect(env.getBackendAvailableBalance(env.studentAId).consumed).toBe(0);

    const canc = ClassService.Classes_cancel(env.spreadsheet, { class_session_id: sid, cancellation_reason: 'Rescheduled', deduct_class: false }, env.actor);
    expect(canc.success).toBe(true);
    expect(env.getBackendAvailableBalance(env.studentAId).consumed).toBe(0);
    expect(env.getBackendAvailableBalance(env.studentAId).available).toBe(10);
  });
});
