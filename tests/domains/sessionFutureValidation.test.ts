import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isFutureSession, getSessionStartTimestamp } from '../../src/domains/classes/sessionFutureValidator';
import { MockSpreadsheet } from '../mocks/MockSpreadsheet';
// @ts-ignore
import SheetRegistry from '../../02-backend/apps-script/sheets/SheetRegistry.gs';
// @ts-ignore
import SpreadsheetBootstrap from '../../02-backend/apps-script/sheets/SpreadsheetBootstrap.gs';
// @ts-ignore
import StudentService from '../../02-backend/apps-script/students/StudentService.gs';
// @ts-ignore
import PackageService from '../../02-backend/apps-script/packages/PackageService.gs';
// @ts-ignore
import PackageRepository from '../../02-backend/apps-script/packages/PackageRepository.gs';
// @ts-ignore
import ClassService from '../../02-backend/apps-script/classes/ClassService.gs';
// @ts-ignore
import ClassRepository from '../../02-backend/apps-script/classes/ClassRepository.gs';

describe('Prompt A: Block Attended on Future Classes & isFutureSession predicate', () => {
  describe('isFutureSession predicate unit tests', () => {
    it('class 1 minute in the future = true, 1 minute in the past = false', () => {
      const now = new Date('2026-11-26T12:00:00.000Z');
      const oneMinFuture = new Date(now.getTime() + 60 * 1000).toISOString();
      const oneMinPast = new Date(now.getTime() - 60 * 1000).toISOString();

      expect(isFutureSession({ scheduled_start: oneMinFuture }, now)).toBe(true);
      expect(isFutureSession({ scheduled_start: oneMinPast }, now)).toBe(false);
    });

    it('class 1 hour in the past = false', () => {
      const now = new Date('2026-11-26T12:00:00.000Z');
      const oneHourPast = new Date(now.getTime() - 3600 * 1000).toISOString();
      expect(isFutureSession({ scheduled_start: oneHourPast }, now)).toBe(false);
    });

    it('handles session with schedule_date and schedule_time in Asia/Kolkata', () => {
      // 2026-11-26 18:30:00 IST is 2026-11-26T13:00:00.000Z
      const session = { schedule_date: '2026-11-26', schedule_time: '18:30' };
      const beforeClass = new Date('2026-11-26T12:59:00.000Z');
      const afterClass = new Date('2026-11-26T13:01:00.000Z');

      expect(isFutureSession(session, beforeClass, 'Asia/Kolkata')).toBe(true);
      expect(isFutureSession(session, afterClass, 'Asia/Kolkata')).toBe(false);
    });

    it('returns false for empty or null session', () => {
      expect(isFutureSession(null)).toBe(false);
      expect(isFutureSession(undefined)).toBe(false);
      expect(isFutureSession({})).toBe(false);
    });
  });

  describe('Backend protection in ClassService.Classes_complete', () => {
    let spreadsheet: MockSpreadsheet;
    const actor = { actorId: 'usr_admin', email: 'admin@example.com', requestId: 'req_future_test' };
    let studentId: string;
    let pkgId: string;

    beforeEach(() => {
      spreadsheet = new MockSpreadsheet();
      SpreadsheetBootstrap.bootstrapSpreadsheet(spreadsheet, SheetRegistry, '1.0.0');
      const s = StudentService.Students_create(spreadsheet, {
        first_name: 'Aarav', parent_guardian_name: 'Pooja', primary_phone: '+919876543210'
      }, actor);
      studentId = s.data.student_id;

      const p = PackageService.Packages_create(spreadsheet, {
        student_id: studentId, package_name: '10-Pack', purchased_classes: 10
      }, actor);
      pkgId = p.data.package_id;
    });

    it('blocks PRESENT or ATTENDED on a future class with VALIDATION_ERROR and does not consume class', () => {
      const futureStart = new Date(Date.now() + 86400000 * 3).toISOString(); // 3 days in future
      const futureEnd = new Date(Date.now() + 86400000 * 3 + 3600000).toISOString();

      const sched = ClassService.Classes_schedule(spreadsheet, {
        student_id: studentId,
        package_id: pkgId,
        class_title: 'Future Session',
        scheduled_start: futureStart,
        scheduled_end: futureEnd
      }, actor);
      expect(sched.success).toBe(true);
      const sid = sched.data.class_session_id;

      // Try marking ATTENDED
      const compAttended = ClassService.Classes_complete(spreadsheet, {
        class_session_id: sid,
        attendance_status: 'ATTENDED'
      }, actor);

      expect(compAttended.success).toBe(false);
      expect(compAttended.code).toBe('VALIDATION_ERROR');
      expect(compAttended.message).toBe('Class is scheduled for the future and cannot be marked Attended yet.');

      // Check balance is not consumed
      const bal = PackageService.Packages_enrichWithBalance(spreadsheet, PackageRepository.Packages_getById(spreadsheet, pkgId));
      expect(bal.remaining_classes).toBe(10);

      // Check session status is still SCHEDULED
      const sessionAfter = ClassRepository.Classes_getById(spreadsheet, sid);
      expect(sessionAfter.session_status || sessionAfter.status).toBe('SCHEDULED');
      expect(sessionAfter.attendance_status).not.toBe('PRESENT');
      expect(sessionAfter.attendance_status).not.toBe('ATTENDED');
    });

    it('allows NO_SHOW on a future class, saves notes, and does not consume class by default', () => {
      const futureStart = new Date(Date.now() + 86400000 * 3).toISOString();
      const futureEnd = new Date(Date.now() + 86400000 * 3 + 3600000).toISOString();

      const sched = ClassService.Classes_schedule(spreadsheet, {
        student_id: studentId,
        package_id: pkgId,
        class_title: 'Future Session NoShow',
        scheduled_start: futureStart,
        scheduled_end: futureEnd
      }, actor);
      const sid = sched.data.class_session_id;

      const compNoShow = ClassService.Classes_complete(spreadsheet, {
        class_session_id: sid,
        outcome: 'NO_SHOW',
        session_notes: 'Parent notified absence in advance'
      }, actor);

      expect(compNoShow.success).toBe(true);
      expect(compNoShow.data.attendance_status).toBe('ABSENT_UNEXCUSED');
      expect(compNoShow.data.session_status).toBe('COMPLETED');
      expect(compNoShow.data.class_credit_effect).toBe('NO_CONSUME');

      const bal = PackageService.Packages_enrichWithBalance(spreadsheet, PackageRepository.Packages_getById(spreadsheet, pkgId));
      expect(bal.remaining_classes).toBe(10); // Not consumed
    });

    it('allows marking Attended on a class that started 1 hour ago', () => {
      const pastStart = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const pastEnd = new Date(Date.now()).toISOString();

      const sched = ClassService.Classes_schedule(spreadsheet, {
        student_id: studentId,
        package_id: pkgId,
        class_title: 'Past 1h Session',
        scheduled_start: pastStart,
        scheduled_end: pastEnd
      }, actor);
      const sid = sched.data.class_session_id;

      const compAttended = ClassService.Classes_complete(spreadsheet, {
        class_session_id: sid,
        attendance_status: 'PRESENT',
        session_notes: 'Completed session successfully'
      }, actor);

      expect(compAttended.success).toBe(true);
      expect(compAttended.data.session_status).toBe('COMPLETED');
      expect(compAttended.data.attendance_status).toBe('PRESENT');
      expect(compAttended.data.class_credit_effect).toBe('CONSUME');

      const bal = PackageService.Packages_enrichWithBalance(spreadsheet, PackageRepository.Packages_getById(spreadsheet, pkgId));
      expect(bal.remaining_classes).toBe(9); // 1 consumed
    });
  });
});
