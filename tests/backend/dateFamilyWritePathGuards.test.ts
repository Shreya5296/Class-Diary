import { describe, it, expect, beforeEach } from 'vitest';
import { MockSpreadsheet } from '../mocks/MockSpreadsheet';

// @ts-ignore
import SheetRegistry from '../../02-backend/apps-script/sheets/SheetRegistry.gs';
// @ts-ignore
import SpreadsheetBootstrap from '../../02-backend/apps-script/sheets/SpreadsheetBootstrap.gs';
// @ts-ignore
import ClassRepository from '../../02-backend/apps-script/classes/ClassRepository.gs';
// @ts-ignore
import ClassService from '../../02-backend/apps-script/classes/ClassService.gs';
// @ts-ignore
import RenewalSessionTransition from '../../02-backend/apps-script/packages/RenewalSessionTransition.gs';
// @ts-ignore
import StudentRepository from '../../02-backend/apps-script/students/StudentRepository.gs';

describe('Date Family Write Path Guards & Day Consistency', () => {
  let spreadsheet: any;

  beforeEach(() => {
    spreadsheet = new MockSpreadsheet();
    SpreadsheetBootstrap.bootstrapSpreadsheet(spreadsheet, SheetRegistry, '1.0.0');
    const provider = require('../../02-backend/apps-script/sheets/SpreadsheetProvider.gs');
    provider.setMockSpreadsheet(spreadsheet);
  });

  it('Guard: Inserting two sessions with the same student_id + date + time keeps exactly one', () => {
    const session1 = {
      student_id: 'STU_TEST_001',
      student_name: 'Test Student',
      schedule_date: '2026-12-28',
      schedule_time: '17:00',
      attendance_status: 'NOT_MARKED',
      session_status: 'SCHEDULED',
      cancellation_reason: '',
      deduct_class: false,
    };

    const session2 = {
      student_id: 'STU_TEST_001',
      student_name: 'Test Student',
      schedule_date: '2026-12-28',
      schedule_time: '17:00',
      attendance_status: 'NOT_MARKED',
      session_status: 'SCHEDULED',
      cancellation_reason: '',
      deduct_class: false,
    };

    ClassRepository.Classes_insert(spreadsheet, session1);
    ClassRepository.Classes_insert(spreadsheet, session2);

    const allSessions = ClassRepository.Classes_getAll(spreadsheet);
    const matching = allSessions.filter(
      (s: any) => s.student_id === 'STU_TEST_001' && s.schedule_date === '2026-12-28' && s.schedule_time === '17:00'
    );

    expect(matching.length).toBe(1);
    const sheet = spreadsheet.getSheetByName('ClassSessions');
    expect(sheet.getData().length).toBe(2); // 1 header row + 1 data row
  });

  it('Guard: Classes_insert allows inserting when prior session was CANCELLED', () => {
    const cancelledSession = {
      student_id: 'STU_TEST_002',
      student_name: 'Test Student 2',
      schedule_date: '2026-12-28',
      schedule_time: '17:00',
      attendance_status: 'CANCELLED',
      session_status: 'CANCELLED',
      cancellation_reason: 'Sick',
      deduct_class: false,
    };

    const newSession = {
      student_id: 'STU_TEST_002',
      student_name: 'Test Student 2',
      schedule_date: '2026-12-28',
      schedule_time: '17:00',
      attendance_status: 'NOT_MARKED',
      session_status: 'SCHEDULED',
      cancellation_reason: '',
      deduct_class: false,
    };

    ClassRepository.Classes_insert(spreadsheet, cancelledSession);
    ClassRepository.Classes_insert(spreadsheet, newSession);

    const allSessions = ClassRepository.Classes_getAll(spreadsheet);
    const matching = allSessions.filter((s: any) => s.student_id === 'STU_TEST_002');
    expect(matching.length).toBe(2);
    expect(matching.filter((s: any) => s.session_status === 'SCHEDULED').length).toBe(1);
  });

  it('Renewal: Monday 5 PM slot generates renewal sessions on Mondays, never Sundays', () => {
    const schedules = [{ day_of_week: 'MONDAY', start_time: '17:00', end_time: '18:00' }];
    // Starting Dec 24, 2026 (Thursday), 2 classes: should land on Monday Dec 28 and Monday Jan 04
    const planned = RenewalSessionTransition._planRenewalSlots([], 'STU_TEST_003', schedules, '2026-12-24', 2);

    expect(planned.length).toBe(2);
    expect(planned[0].schedule_date).toBe('2026-12-28'); // Monday
    expect(planned[0].schedule_time).toBe('17:00');
    expect(planned[1].schedule_date).toBe('2027-01-04'); // Monday
    expect(planned[1].schedule_time).toBe('17:00');

    // Verify day of week is Monday (1)
    const d0 = new Date(planned[0].schedule_date + 'T12:00:00Z').getUTCDay();
    const d1 = new Date(planned[1].schedule_date + 'T12:00:00Z').getUTCDay();
    expect(d0).toBe(1);
    expect(d1).toBe(1);
  });

  it('Renewal: Supports 3-letter weekday abbreviations (Mon, Thu)', () => {
    const schedules = [{ day_of_week: 'Mon', start_time: '17:00', end_time: '18:00' }];
    const planned = RenewalSessionTransition._planRenewalSlots([], 'STU_TEST_004', schedules, '2026-12-24', 2);

    expect(planned.length).toBe(2);
    expect(planned[0].schedule_date).toBe('2026-12-28');
    expect(planned[1].schedule_date).toBe('2027-01-04');
  });

  it('Write path: Schedule class preserves HH:mm and does not leak ISO timestamp as 2026-', () => {
    StudentRepository.Students_insert(spreadsheet, {
      student_id: 'STU_TEST_005',
      student_name: 'Sidhant Test',
      status: 'ACTIVE',
    });

    const res = ClassService.Classes_schedule(
      spreadsheet,
      {
        student_id: 'STU_TEST_005',
        start_time: '2026-12-28T15:00:00.000Z', // ISO string passed to start_time
        scheduled_start: '2026-12-28T15:00:00.000Z',
        duration_minutes: 60,
      },
      { actorId: 'admin', email: 'admin@test.com' }
    );

    expect(res.success).toBe(true);
    expect(res.data.schedule_time).toBe('15:00');
    expect(res.data.schedule_date).toBe('2026-12-28');
    expect(res.data.schedule_time).not.toContain('2026-');

    // Read directly from repository to verify sheet record
    const all = ClassRepository.Classes_getAll(spreadsheet);
    const saved = all.find((s: any) => s.student_id === 'STU_TEST_005');
    expect(saved).toBeDefined();
    expect(saved.schedule_time).toBe('15:00');
    expect(saved.schedule_date).toBe('2026-12-28');
  });

  it('Write path: Form submission passing schedule_date and schedule_time stores exact local day and time', () => {
    StudentRepository.Students_insert(spreadsheet, {
      student_id: 'STU_TEST_006',
      student_name: 'Morning Stu',
      status: 'ACTIVE',
    });

    const res = ClassService.Classes_schedule(
      spreadsheet,
      {
        student_id: 'STU_TEST_006',
        schedule_date: '2026-12-28', // Monday
        schedule_time: '05:00', // 5:00 AM IST
        start_time: '05:00',
        scheduled_start: '2026-12-27T23:30:00.000Z', // UTC ISO across midnight
        scheduled_end: '2026-12-28T00:30:00.000Z',
        duration_minutes: 60,
      },
      { actorId: 'admin', email: 'admin@test.com' }
    );

    expect(res.success).toBe(true);
    expect(res.data.schedule_date).toBe('2026-12-28'); // Preserves Monday calendar day!
    expect(res.data.schedule_time).toBe('05:00');

    const all = ClassRepository.Classes_getAll(spreadsheet);
    const saved = all.find((s: any) => s.student_id === 'STU_TEST_006');
    expect(saved).toBeDefined();
    expect(saved.schedule_date).toBe('2026-12-28');
    expect(saved.schedule_time).toBe('05:00');
  });

  it('Guard: Classes_insertMany deduplicates batch records with same student_id + date + time', () => {
    const records = [
      {
        student_id: 'STU_TEST_007',
        student_name: 'Batch Stu',
        schedule_date: '2026-12-28',
        schedule_time: '10:00',
        attendance_status: 'NOT_MARKED',
        session_status: 'SCHEDULED',
        deduct_class: false,
      },
      {
        student_id: 'STU_TEST_007',
        student_name: 'Batch Stu',
        schedule_date: '2026-12-28',
        schedule_time: '10:00', // duplicate in same batch!
        attendance_status: 'NOT_MARKED',
        session_status: 'SCHEDULED',
        deduct_class: false,
      },
      {
        student_id: 'STU_TEST_007',
        student_name: 'Batch Stu',
        schedule_date: '2026-12-29',
        schedule_time: '10:00', // distinct slot
        attendance_status: 'NOT_MARKED',
        session_status: 'SCHEDULED',
        deduct_class: false,
      },
    ];

    ClassRepository.Classes_insertMany(spreadsheet, records);

    const all = ClassRepository.Classes_getAll(spreadsheet);
    const stuSessions = all.filter((s: any) => s.student_id === 'STU_TEST_007');
    expect(stuSessions.length).toBe(2);
    expect(stuSessions.map((s: any) => s.schedule_date).sort()).toEqual(['2026-12-28', '2026-12-29']);
  });
});
