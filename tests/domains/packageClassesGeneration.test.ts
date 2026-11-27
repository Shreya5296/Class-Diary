import { describe, it, expect, beforeEach } from 'vitest';
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
import { generateCalendarEvents, getWeekDates } from '../../src/domains/dashboard/calendarEventGenerator';
import { isSessionOnDate, getSessionStartTime } from '../../src/domains/classes/sessionTimeNormalizer';
import { handleMockGenerateForPackage } from '../../src/api/mockPackageClassGenerator';
import { MOCK_STUDENTS, MOCK_PACKAGES, MOCK_CLASSES, MOCK_SCHEDULES } from '../../src/api/mockDataInitial';

describe('Prompt B: Package Classes Generation for Scheduled Students (Rehaan, Viwaan)', () => {
  let spreadsheet: MockSpreadsheet;
  const actor = { actorId: 'usr_admin', email: 'admin@example.com', requestId: 'req_pkg_gen' };

  let rehaanId: string;
  let viwaanId: string;
  let rehaanPkgId: string;
  let viwaanPkgId: string;

  beforeEach(() => {
    spreadsheet = new MockSpreadsheet();
    SpreadsheetBootstrap.bootstrapSpreadsheet(spreadsheet, SheetRegistry, '1.0.0');

    // Create ZZ TEST Rehaan with 80 classes and Mon, Tue, Wed, Fri 6:30 PM schedule
    const rStu = StudentService.Students_create(spreadsheet, {
      first_name: 'ZZ TEST Rehaan', parent_guardian_name: 'Parent R', primary_phone: '+919876500001'
    }, actor);
    rehaanId = rStu.data.student_id;

    const rPkg = PackageService.Packages_create(spreadsheet, {
      student_id: rehaanId,
      package_name: 'Rehaan 80-Class Pack',
      classes_purchased: 80,
      total_classes: 80,
      start_date: '2026-11-01',
      class_duration: 60,
      class_schedule: 'Mon - 6:30 PM, Tue - 6:30 PM, Wed - 6:30 PM, Fri - 6:30 PM',
      status: 'ACTIVE'
    }, actor);
    rehaanPkgId = rPkg.data.package_id;

    // Create ZZ TEST Viwaan with 80 classes and Mon, Tue, Wed, Fri 7:30 PM schedule
    const vStu = StudentService.Students_create(spreadsheet, {
      first_name: 'ZZ TEST Viwaan', parent_guardian_name: 'Parent V', primary_phone: '+919876500002'
    }, actor);
    viwaanId = vStu.data.student_id;

    const vPkg = PackageService.Packages_create(spreadsheet, {
      student_id: viwaanId,
      package_name: 'Viwaan 80-Class Pack',
      classes_purchased: 80,
      total_classes: 80,
      start_date: '2026-11-01',
      class_duration: 60,
      class_schedule: 'Mon - 7:30 PM, Tue - 7:30 PM, Wed - 7:30 PM, Fri - 7:30 PM',
      status: 'ACTIVE'
    }, actor);
    viwaanPkgId = vPkg.data.package_id;
  });

  it('1. Dry run output looks right before running generation on real student', () => {
    const dryRun = ClassService.Classes_generateForPackage(spreadsheet, {
      student_id: rehaanId,
      dry_run: true
    }, actor);

    expect(dryRun.success).toBe(true);
    expect(dryRun.dry_run).toBe(true);
    expect(dryRun.count).toBe(80);
    expect(dryRun.lastClassDate).toBeDefined();
    expect(typeof dryRun.lastClassDate).toBe('string');
    // Ensure no rows were inserted in ClassSessions
    const allSessions = ClassRepository.Classes_getAll(spreadsheet);
    expect(allSessions.length).toBe(0);
  });

  it('2. Generates 80 classes on Mon, Tue, Wed, Fri at 6:30 PM; second run creates 0 new classes', () => {
    const genRes = ClassService.Classes_generateForPackage(spreadsheet, {
      student_id: rehaanId
    }, actor);

    expect(genRes.success).toBe(true);
    expect(genRes.count).toBe(80);

    const rehaanSessions = ClassRepository.Classes_getAll(spreadsheet).filter((s: any) => s.student_id === rehaanId);
    expect(rehaanSessions.length).toBe(80);

    // Verify all sessions are on scheduled weekdays (Mon=1, Tue=2, Wed=3, Fri=5) at 18:30
    for (const sess of rehaanSessions) {
      expect(sess.start_time).toBe('18:30');
      expect(sess.session_status || sess.status).toBe('SCHEDULED');
      expect(sess.attendance_status).toBe('NOT_MARKED');
      expect(sess.deduct_class).toBe(false);

      const d = new Date(sess.schedule_date + 'T12:00:00Z');
      const day = d.getUTCDay();
      expect([1, 2, 3, 5]).toContain(day);
    }

    // Press Generate classes a second time: "0 new classes", nothing duplicated
    const secondRun = ClassService.Classes_generateForPackage(spreadsheet, {
      student_id: rehaanId
    }, actor);

    expect(secondRun.success).toBe(true);
    expect(secondRun.count).toBe(0);
    expect(secondRun.createdCount).toBe(0);

    const afterSecondRun = ClassRepository.Classes_getAll(spreadsheet).filter((s: any) => s.student_id === rehaanId);
    expect(afterSecondRun.length).toBe(80);
  });

  it('3. On a Monday, the dashboard lists Rehaan 6:30 PM and Viwaan 7:30 PM in time order', () => {
    ClassService.Classes_generateForPackage(spreadsheet, { student_id: rehaanId }, actor);
    ClassService.Classes_generateForPackage(spreadsheet, { student_id: viwaanId }, actor);

    const allSessions = ClassRepository.Classes_getAll(spreadsheet);
    // Pick the first Monday present in the generated sessions
    const rehaanMondays = allSessions.filter((s: any) => {
      if (s.student_id !== rehaanId) return false;
      const d = new Date(s.schedule_date + 'T12:00:00Z');
      return d.getUTCDay() === 1;
    });
    expect(rehaanMondays.length).toBeGreaterThan(0);
    const testMonday = rehaanMondays[0].schedule_date;

    const daySessions = allSessions
      .filter((c: any) => isSessionOnDate(c, testMonday, 'Asia/Kolkata'))
      .sort((a: any, b: any) => getSessionStartTime(a, 'Asia/Kolkata').localeCompare(getSessionStartTime(b, 'Asia/Kolkata')));

    expect(daySessions.length).toBe(2);
    expect(daySessions[0].student_id).toBe(rehaanId);
    expect(daySessions[0].start_time).toBe('18:30'); // 6:30 PM
    expect(daySessions[1].student_id).toBe(viwaanId);
    expect(daySessions[1].start_time).toBe('19:30'); // 7:30 PM
  });

  it('4. Calendar Week view shows each class once (suppressing virtual duplicate)', () => {
    ClassService.Classes_generateForPackage(spreadsheet, { student_id: rehaanId }, actor);

    const allSessions = ClassRepository.Classes_getAll(spreadsheet);
    const firstMonday = allSessions.find((s: any) => {
      const d = new Date(s.schedule_date + 'T12:00:00Z');
      return d.getUTCDay() === 1;
    })?.schedule_date;

    expect(firstMonday).toBeDefined();
    const weekDates = getWeekDates(firstMonday!);

    const recurringSchedules = [
      { schedule_id: 'sch_1', student_id: rehaanId, day_of_week: 'MONDAY', start_time: '18:30', end_time: '19:30' },
      { schedule_id: 'sch_2', student_id: rehaanId, day_of_week: 'TUESDAY', start_time: '18:30', end_time: '19:30' },
      { schedule_id: 'sch_3', student_id: rehaanId, day_of_week: 'WEDNESDAY', start_time: '18:30', end_time: '19:30' },
      { schedule_id: 'sch_4', student_id: rehaanId, day_of_week: 'FRIDAY', start_time: '18:30', end_time: '19:30' },
    ];

    const events = generateCalendarEvents({
      datedSessions: allSessions,
      recurringSchedules,
      weekDates,
      activeTz: 'Asia/Kolkata'
    });

    // Check Monday: should have exactly 1 event for Rehaan (no duplicate rec_ event)
    const mondayEvents = events.filter((e) => (e.schedule_date || '').startsWith(firstMonday!));
    expect(mondayEvents.length).toBe(1);
    expect(mondayEvents[0].session_id).not.toContain('rec_');
    expect(mondayEvents[0].student_id).toBe(rehaanId);
    expect(mondayEvents[0].start_time).toBe('18:30');
  });

  it('5. Change schedule from Wed to Thu: future Wed rows move to Thu once, past rows stay as they were', () => {
    // 1. Generate initial 80 classes (Mon, Tue, Wed, Fri)
    ClassService.Classes_generateForPackage(spreadsheet, { student_id: rehaanId }, actor);
    let all = ClassRepository.Classes_getAll(spreadsheet).filter((s: any) => s.student_id === rehaanId);
    expect(all.length).toBe(80);

    // 2. Mark 2 past classes as COMPLETED in the past
    all[0].session_status = 'COMPLETED';
    all[0].attendance_status = 'PRESENT';
    all[0].scheduled_start = '2026-11-02T13:00:00.000Z'; // Past
    all[0].schedule_date = '2026-11-02';
    all[0].deduct_class = true;
    ClassRepository.Classes_update(spreadsheet, all[0].class_session_id, all[0]);

    all[1].session_status = 'COMPLETED';
    all[1].attendance_status = 'PRESENT';
    all[1].scheduled_start = '2026-11-03T13:00:00.000Z'; // Past
    all[1].schedule_date = '2026-11-03';
    all[1].deduct_class = true;
    ClassRepository.Classes_update(spreadsheet, all[1].class_session_id, all[1]);

    // 3. Update student package schedule from Wed to Thu
    PackageService.Packages_update(spreadsheet, rehaanPkgId, {
      class_schedule: 'Mon - 6:30 PM, Tue - 6:30 PM, Thu - 6:30 PM, Fri - 6:30 PM'
    }, actor);

    // 4. Regenerate future classes
    const regenRes = ClassService.Classes_generateForPackage(spreadsheet, {
      student_id: rehaanId,
      regenerate_future: true
    }, actor);

    expect(regenRes.success).toBe(true);

    const updatedSessions = ClassRepository.Classes_getAll(spreadsheet).filter((s: any) => s.student_id === rehaanId);
    expect(updatedSessions.length).toBe(80);

    // Past 2 completed sessions remain COMPLETED and preserved
    const completed = updatedSessions.filter((s: any) => s.session_status === 'COMPLETED');
    expect(completed.length).toBe(2);

    // Future scheduled sessions now have Thu (day=4) and NO Wed (day=3)
    const futureScheduled = updatedSessions.filter((s: any) => s.session_status === 'SCHEDULED' && s.schedule_date >= '2026-11-27');
    const futureDays = futureScheduled.map((s: any) => new Date(s.schedule_date + 'T12:00:00Z').getUTCDay());

    expect(futureDays).toContain(4); // Thursday present
    expect(futureDays).not.toContain(3); // Wednesday absent
  });

  it('6. Package numbers (Purchased, Consumed, Remaining) remain correct with new rows', () => {
    ClassService.Classes_generateForPackage(spreadsheet, { student_id: rehaanId }, actor);

    const pkg = PackageRepository.Packages_getById(spreadsheet, rehaanPkgId);
    const enriched = PackageService.Packages_enrichWithBalance(spreadsheet, pkg);

    expect(enriched.classes_purchased || enriched.total_classes).toBe(80);
    expect(enriched.consumed_classes || enriched.classes_consumed).toBe(0); // None completed yet
    expect(enriched.remaining_classes).toBe(80);
  });

  describe('No-Show and Package Class Allocation Accounting', () => {
    let synthStuId: string;
    let synthPkgId: string;

    beforeEach(() => {
      const s = StudentService.Students_create(spreadsheet, {
        first_name: 'ZZ TEST Accounting Student', parent_guardian_name: 'Parent Acct', primary_phone: '+919876599999'
      }, actor);
      synthStuId = s.data.student_id;

      const p = PackageService.Packages_create(spreadsheet, {
        student_id: synthStuId,
        package_name: '10-Class Test Pack',
        classes_purchased: 10,
        total_classes: 10,
        start_date: '2026-11-02',
        class_duration: 60,
        class_schedule: 'Mon - 10:00 AM, Wed - 10:00 AM, Fri - 10:00 AM',
        status: 'ACTIVE'
      }, actor);
      synthPkgId = p.data.package_id;
    });

    it('1. Attended session with deduct_class = true counts toward package allocation', () => {
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId,
        schedule_date: '2026-11-02',
        schedule_time: '10:00',
        start_time: '10:00',
        session_status: 'COMPLETED',
        attendance_status: 'PRESENT',
        deduct_class: true
      });

      const dryRun = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId, dry_run: true }, actor);
      expect(dryRun.count).toBe(9);
      expect(dryRun.existingCount).toBe(1);

      const gen = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId }, actor);
      expect(gen.count).toBe(9);
      const all = ClassRepository.Classes_getAll(spreadsheet).filter((c: any) => c.student_id === synthStuId);
      expect(all.length).toBe(10);
    });

    it('2. Future scheduled session with deduct_class = false reserves package allocation', () => {
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId,
        schedule_date: '2026-12-02',
        schedule_time: '10:00',
        start_time: '10:00',
        session_status: 'SCHEDULED',
        attendance_status: 'NOT_MARKED',
        deduct_class: false
      });
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId,
        schedule_date: '2026-12-04',
        schedule_time: '10:00',
        start_time: '10:00',
        session_status: 'SCHEDULED',
        attendance_status: 'NOT_MARKED',
        deduct_class: false
      });

      const dryRun = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId, dry_run: true }, actor);
      expect(dryRun.count).toBe(8);
      expect(dryRun.existingCount).toBe(2);

      const gen = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId }, actor);
      expect(gen.count).toBe(8);
      const all = ClassRepository.Classes_getAll(spreadsheet).filter((c: any) => c.student_id === synthStuId);
      expect(all.length).toBe(10);
    });

    it('3. Cancelled session does NOT count toward package allocation', () => {
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId,
        schedule_date: '2026-11-02',
        schedule_time: '10:00',
        start_time: '10:00',
        session_status: 'CANCELLED',
        attendance_status: 'CANCELLED',
        cancellation_reason: 'Sick',
        deduct_class: false
      });

      const dryRun = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId, dry_run: true }, actor);
      expect(dryRun.count).toBe(10);
      expect(dryRun.existingCount).toBe(0);

      const gen = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId }, actor);
      expect(gen.count).toBe(10);
      const active = ClassRepository.Classes_getAll(spreadsheet).filter((c: any) => c.student_id === synthStuId && c.session_status !== 'CANCELLED');
      expect(active.length).toBe(10);
    });

    it('4. No-Show with deduct_class = false does NOT count toward package allocation', () => {
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId,
        schedule_date: '2026-11-02',
        schedule_time: '10:00',
        start_time: '10:00',
        session_status: 'COMPLETED',
        attendance_status: 'NO_SHOW',
        deduct_class: false
      });

      const dryRun = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId, dry_run: true }, actor);
      // Student is still entitled to all 10 classes
      expect(dryRun.count).toBe(10);
      expect(dryRun.existingCount).toBe(0);

      const gen = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId }, actor);
      expect(gen.count).toBe(10);
      const all = ClassRepository.Classes_getAll(spreadsheet).filter((c: any) => c.student_id === synthStuId);
      // 1 non-deducted No-Show + 10 scheduled classes = 11 total rows
      expect(all.length).toBe(11);
    });

    it('5. No-Show with deduct_class = true counts toward package allocation', () => {
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId,
        schedule_date: '2026-11-02',
        schedule_time: '10:00',
        start_time: '10:00',
        session_status: 'COMPLETED',
        attendance_status: 'NO_SHOW',
        deduct_class: true
      });

      const dryRun = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId, dry_run: true }, actor);
      expect(dryRun.count).toBe(9);
      expect(dryRun.existingCount).toBe(1);

      const gen = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId }, actor);
      expect(gen.count).toBe(9);
      const all = ClassRepository.Classes_getAll(spreadsheet).filter((c: any) => c.student_id === synthStuId);
      expect(all.length).toBe(10);
    });

    it('6. Mixture of session types allocates exact remaining entitlement', () => {
      // 1. Attended and deducted: counts
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId, schedule_date: '2026-11-02', schedule_time: '10:00',
        session_status: 'COMPLETED', attendance_status: 'PRESENT', deduct_class: true
      });
      // 2. Future scheduled: counts (reserves allocation)
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId, schedule_date: '2026-12-04', schedule_time: '10:00',
        session_status: 'SCHEDULED', attendance_status: 'NOT_MARKED', deduct_class: false
      });
      // 3. Cancelled: does NOT count
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId, schedule_date: '2026-11-06', schedule_time: '10:00',
        session_status: 'CANCELLED', attendance_status: 'CANCELLED', deduct_class: false
      });
      // 4. No-Show with deduct_class = false: does NOT count
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId, schedule_date: '2026-11-09', schedule_time: '10:00',
        session_status: 'COMPLETED', attendance_status: 'NO_SHOW', deduct_class: false
      });
      // 5. No-Show with deduct_class = true: counts
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId, schedule_date: '2026-11-11', schedule_time: '10:00',
        session_status: 'COMPLETED', attendance_status: 'NO_SHOW', deduct_class: true
      });

      // Total consuming/reserving = 1 (attended) + 1 (scheduled) + 1 (no-show deducted) = 3
      // classesNeeded = 10 - 3 = 7
      const dryRun = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId, dry_run: true }, actor);
      expect(dryRun.count).toBe(7);
      expect(dryRun.existingCount).toBe(3);

      const gen = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId }, actor);
      expect(gen.count).toBe(7);

      const all = ClassRepository.Classes_getAll(spreadsheet).filter((c: any) => c.student_id === synthStuId);
      // 5 existing + 7 new = 12 total rows in sheet
      expect(all.length).toBe(12);

      // Consuming + future scheduled sessions = 10
      const activeOrConsumed = all.filter((c: any) => c.session_status === 'SCHEDULED' || c.deduct_class === true);
      expect(activeOrConsumed.length).toBe(10);
    });

    it('7. Non-consuming No-Show slot is protected against duplicate generation', () => {
      // Package starts on 2026-11-27 where a No-Show slot exists with deduct_class = false
      PackageService.Packages_update(spreadsheet, synthPkgId, { start_date: '2026-11-27' }, actor);
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId,
        schedule_date: '2026-11-27',
        schedule_time: '10:00',
        start_time: '10:00',
        session_status: 'COMPLETED',
        attendance_status: 'NO_SHOW',
        deduct_class: false
      });

      const gen = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId }, actor);
      // Full 10 classes generated because No-Show did not consume an entitlement
      expect(gen.count).toBe(10);

      const all = ClassRepository.Classes_getAll(spreadsheet).filter((c: any) => c.student_id === synthStuId);
      // Verify no duplicate at 2026-11-27 at 10:00
      const atNov27 = all.filter((c: any) => c.schedule_date === '2026-11-27' && c.schedule_time === '10:00');
      expect(atNov27.length).toBe(1);
      expect(atNov27[0].attendance_status).toBe('NO_SHOW');

      // The 10 newly generated sessions must skip 2026-11-27 and start on the next slot: 2026-11-30 (Monday)
      const newlyGenerated = all.filter((c: any) => c.session_status === 'SCHEDULED');
      expect(newlyGenerated.length).toBe(10);
      expect(newlyGenerated[0].schedule_date).toBe('2026-11-30');
    });
  });

  describe('Boolean deduct_class Parity (Production Apps Script & Mock Generator)', () => {
    let synthStuId: string;

    beforeEach(() => {
      const s = StudentService.Students_create(spreadsheet, {
        first_name: 'ZZ TEST Parity Student', parent_guardian_name: 'Parent Parity', primary_phone: '+919876588888'
      }, actor);
      synthStuId = s.data.student_id;

      PackageService.Packages_create(spreadsheet, {
        student_id: synthStuId,
        package_name: '5-Class Parity Pack',
        classes_purchased: 5,
        total_classes: 5,
        start_date: '2026-11-02',
        class_duration: 60,
        class_schedule: 'Mon - 10:00 AM, Wed - 10:00 AM, Fri - 10:00 AM',
        status: 'ACTIVE'
      }, actor);
    });

    it('1. deduct_class: "false" (string) must NOT count toward package allocation', () => {
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId,
        schedule_date: '2026-11-02',
        schedule_time: '10:00',
        start_time: '10:00',
        session_status: 'COMPLETED',
        attendance_status: 'NO_SHOW',
        deduct_class: 'false'
      });

      const dryRun = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId, dry_run: true }, actor);
      expect(dryRun.count).toBe(5);
      expect(dryRun.existingCount).toBe(0);

      const gen = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId }, actor);
      expect(gen.count).toBe(5);
    });

    it('2. deduct_class: "FALSE" (string uppercase) must NOT count toward package allocation', () => {
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId,
        schedule_date: '2026-11-02',
        schedule_time: '10:00',
        start_time: '10:00',
        session_status: 'COMPLETED',
        attendance_status: 'NO_SHOW',
        deduct_class: 'FALSE'
      });

      const dryRun = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId, dry_run: true }, actor);
      expect(dryRun.count).toBe(5);
      expect(dryRun.existingCount).toBe(0);

      const gen = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId }, actor);
      expect(gen.count).toBe(5);
    });

    it('3. deduct_class: "true" (string) MUST count toward package allocation', () => {
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId,
        schedule_date: '2026-11-02',
        schedule_time: '10:00',
        start_time: '10:00',
        session_status: 'COMPLETED',
        attendance_status: 'PRESENT',
        deduct_class: 'true'
      });

      const dryRun = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId, dry_run: true }, actor);
      expect(dryRun.count).toBe(4);
      expect(dryRun.existingCount).toBe(1);

      const gen = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId }, actor);
      expect(gen.count).toBe(4);
    });

    it('4. deduct_class: "TRUE" (string uppercase) MUST count toward package allocation', () => {
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId,
        schedule_date: '2026-11-02',
        schedule_time: '10:00',
        start_time: '10:00',
        session_status: 'COMPLETED',
        attendance_status: 'PRESENT',
        deduct_class: 'TRUE'
      });

      const dryRun = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId, dry_run: true }, actor);
      expect(dryRun.count).toBe(4);
      expect(dryRun.existingCount).toBe(1);

      const gen = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId }, actor);
      expect(gen.count).toBe(4);
    });

    it('5. deduct_class: true (boolean) MUST count toward package allocation', () => {
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId,
        schedule_date: '2026-11-02',
        schedule_time: '10:00',
        start_time: '10:00',
        session_status: 'COMPLETED',
        attendance_status: 'PRESENT',
        deduct_class: true
      });

      const dryRun = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId, dry_run: true }, actor);
      expect(dryRun.count).toBe(4);
      expect(dryRun.existingCount).toBe(1);

      const gen = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId }, actor);
      expect(gen.count).toBe(4);
    });

    it('6. deduct_class: false (boolean) must NOT count toward package allocation', () => {
      ClassRepository.Classes_insert(spreadsheet, {
        student_id: synthStuId,
        schedule_date: '2026-11-02',
        schedule_time: '10:00',
        start_time: '10:00',
        session_status: 'COMPLETED',
        attendance_status: 'NO_SHOW',
        deduct_class: false
      });

      const dryRun = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId, dry_run: true }, actor);
      expect(dryRun.count).toBe(5);
      expect(dryRun.existingCount).toBe(0);

      const gen = ClassService.Classes_generateForPackage(spreadsheet, { student_id: synthStuId }, actor);
      expect(gen.count).toBe(5);
    });

    it('7. Mock generator handleMockGenerateForPackage matches production boolean semantics and dry-run parity', () => {
      const mockStuId = 'STU_PARITY_001';
      MOCK_STUDENTS.push({
        student_id: mockStuId,
        student_name: 'Parity Student',
        parent_name: 'Parent P',
        parent_phone: '+91 99999 11111',
        student_phone: '',
        parent_email: 'p@example.com',
        student_email: 's@example.com',
        subject: 'Math',
        status: 'ACTIVE',
        primary_meeting_link: '',
        created_at: '2026-01-01T00:00:00Z'
      });

      MOCK_PACKAGES.push({
        package_id: 'pkg_parity_001',
        student_id: mockStuId,
        package_name: 'Parity 5 Pack',
        total_classes: 5,
        classes_purchased: 5,
        price: 5000,
        start_date: '2026-11-02',
        class_duration: 60,
        class_schedule: 'Mon - 10:00 AM, Wed - 10:00 AM, Fri - 10:00 AM',
        status: 'ACTIVE'
      });

      // Insert completed session with string 'false'
      (MOCK_CLASSES as any[]).push({
        session_id: 'cls_par_1',
        student_id: mockStuId,
        topic: 'Math',
        start_time: '2026-11-02T10:00:00.000Z',
        schedule_date: '2026-11-02',
        schedule_time: '10:00',
        duration_minutes: 60,
        status: 'COMPLETED',
        session_status: 'COMPLETED',
        attendance_status: 'NO_SHOW',
        deduct_class: 'false' // String 'false' must NOT count!
      });

      // Insert completed session with string 'true'
      (MOCK_CLASSES as any[]).push({
        session_id: 'cls_par_2',
        student_id: mockStuId,
        topic: 'Math',
        start_time: '2026-11-04T10:00:00.000Z',
        schedule_date: '2026-11-04',
        schedule_time: '10:00',
        duration_minutes: 60,
        status: 'COMPLETED',
        session_status: 'COMPLETED',
        attendance_status: 'PRESENT',
        deduct_class: 'true' // String 'true' MUST count!
      });

      // Total purchased: 5. Consuming: exactly 1 ('true'). Non-consuming: 1 ('false').
      // classesNeeded = 5 - 1 = 4.
      const dryRes = handleMockGenerateForPackage({ student_id: mockStuId, dry_run: true });
      expect(dryRes.success).toBe(true);
      expect(dryRes.count).toBe(4);
      expect(dryRes.existingCount).toBe(1);

      const genRes = handleMockGenerateForPackage({ student_id: mockStuId });
      expect(genRes.success).toBe(true);
      expect(genRes.count).toBe(4);
      expect(genRes.existingCount).toBe(1);

      // Clean up mock arrays
      const sIdx = MOCK_STUDENTS.findIndex(s => s.student_id === mockStuId);
      if (sIdx !== -1) MOCK_STUDENTS.splice(sIdx, 1);
      const pIdx = MOCK_PACKAGES.findIndex(p => p.student_id === mockStuId);
      if (pIdx !== -1) MOCK_PACKAGES.splice(pIdx, 1);
      for (let i = MOCK_CLASSES.length - 1; i >= 0; i--) {
        if ((MOCK_CLASSES[i] as any).student_id === mockStuId) {
          MOCK_CLASSES.splice(i, 1);
        }
      }
    });

    it('Edge case accounting: future scheduled, past unmarked, past attended, past non-consuming and consuming No-Show', () => {
      const edgeStuId = 'STU_EDGE_999';
      (MOCK_STUDENTS as any[]).push({
        student_id: edgeStuId,
        student_name: 'Edge Student',
        status: 'ACTIVE'
      });
      (MOCK_PACKAGES as any[]).push({
        package_id: 'PKG_EDGE_999',
        student_id: edgeStuId,
        package_name: 'Edge 10 Pack',
        classes_purchased: 10,
        total_classes: 10,
        class_duration: 60,
        start_date: '2026-11-01',
        class_schedule: 'Mon - 10:00 AM, Wed - 10:00 AM',
        status: 'ACTIVE'
      });

      // 1. Future scheduled session -> MUST reserve allocation
      (MOCK_CLASSES as any[]).push({
        session_id: 'cls_edge_1',
        student_id: edgeStuId,
        topic: 'Math',
        schedule_date: '2026-12-01',
        schedule_time: '10:00',
        duration_minutes: 60,
        status: 'SCHEDULED',
        session_status: 'SCHEDULED',
        attendance_status: 'NOT_MARKED',
        deduct_class: false
      });

      // 2. Past scheduled unmarked session (overdue) -> MUST NOT reserve allocation!
      (MOCK_CLASSES as any[]).push({
        session_id: 'cls_edge_2',
        student_id: edgeStuId,
        topic: 'Math',
        schedule_date: '2026-11-02',
        schedule_time: '10:00',
        duration_minutes: 60,
        status: 'SCHEDULED',
        session_status: 'SCHEDULED',
        attendance_status: 'NOT_MARKED',
        deduct_class: false
      });

      // 3. Past attended and deducted session -> MUST count toward allocation
      (MOCK_CLASSES as any[]).push({
        session_id: 'cls_edge_3',
        student_id: edgeStuId,
        topic: 'Math',
        schedule_date: '2026-11-04',
        schedule_time: '10:00',
        duration_minutes: 60,
        status: 'COMPLETED',
        session_status: 'COMPLETED',
        attendance_status: 'PRESENT',
        deduct_class: true
      });

      // 4. Past non-consuming No-Show -> MUST NOT count toward allocation
      (MOCK_CLASSES as any[]).push({
        session_id: 'cls_edge_4',
        student_id: edgeStuId,
        topic: 'Math',
        schedule_date: '2026-11-09',
        schedule_time: '10:00',
        duration_minutes: 60,
        status: 'COMPLETED',
        session_status: 'COMPLETED',
        attendance_status: 'NO_SHOW',
        deduct_class: false
      });

      // 5. Past explicitly deducted No-Show -> MUST count toward allocation
      (MOCK_CLASSES as any[]).push({
        session_id: 'cls_edge_5',
        student_id: edgeStuId,
        topic: 'Math',
        schedule_date: '2026-11-11',
        schedule_time: '10:00',
        duration_minutes: 60,
        status: 'COMPLETED',
        session_status: 'COMPLETED',
        attendance_status: 'NO_SHOW',
        deduct_class: true
      });

      // Verification:
      // Total purchased: 10
      // Allocation consumers under Prompt F:
      // - cls_edge_1: Future scheduled (+1)
      // - cls_edge_2: Past scheduled for package (+1)
      // - cls_edge_3: Past attended & deducted (+1)
      // - cls_edge_5: Past deducted No-Show (+1)
      // Non-consumers:
      // - cls_edge_4: Past non-consuming No-Show (0)
      // Total consuming: 4. Needed: 10 - 4 = 6.

      const dryRes = handleMockGenerateForPackage({ student_id: edgeStuId, dry_run: true });
      expect(dryRes.success).toBe(true);
      expect(dryRes.existingCount).toBe(4);
      expect(dryRes.count).toBe(6);

      const genRes = handleMockGenerateForPackage({ student_id: edgeStuId });
      expect(genRes.success).toBe(true);
      expect(genRes.existingCount).toBe(4);
      expect(genRes.count).toBe(6);

      // Verify collision prevention: the overdue unmarked session's slot (2026-11-02 10:00)
      // is still preserved in existing sessions, and no duplicate was generated for it.
      const allForEdge = (MOCK_CLASSES as any[]).filter(c => c.student_id === edgeStuId);
      const onNov2 = allForEdge.filter(c => c.schedule_date === '2026-11-02');
      expect(onNov2.length).toBe(1);
      expect(onNov2[0].session_id).toBe('cls_edge_2');

      // Also verify backend ClassService logic with the exact same 5 session types
      const edgeSpreadsheet = new MockSpreadsheet();
      SpreadsheetBootstrap.bootstrapSpreadsheet(edgeSpreadsheet, SheetRegistry, '1.0.0');

      const bStu = StudentService.Students_create(edgeSpreadsheet, {
        first_name: 'Edge Backend Student',
        parent_guardian_name: 'Edge Parent',
        primary_phone: '+919876599998'
      }, actor);
      const backendStudentId = bStu.data.student_id;

      PackageService.Packages_create(edgeSpreadsheet, {
        student_id: backendStudentId,
        package_name: 'Edge 10 Pack',
        classes_purchased: 10,
        total_classes: 10,
        class_duration: 60,
        start_date: '2026-11-01',
        class_schedule: 'Mon - 10:00 AM, Wed - 10:00 AM',
        status: 'ACTIVE'
      }, actor);

      // 1. Future scheduled
      ClassRepository.Classes_insert(edgeSpreadsheet, {
        session_id: 'cls_b_1',
        student_id: backendStudentId,
        topic: 'Math',
        schedule_date: '2026-12-01',
        schedule_time: '10:00',
        duration_minutes: 60,
        session_status: 'SCHEDULED',
        attendance_status: 'NOT_MARKED',
        deduct_class: false
      });
      // 2. Past overdue scheduled unmarked
      ClassRepository.Classes_insert(edgeSpreadsheet, {
        session_id: 'cls_b_2',
        student_id: backendStudentId,
        topic: 'Math',
        schedule_date: '2026-11-02',
        schedule_time: '10:00',
        duration_minutes: 60,
        session_status: 'SCHEDULED',
        attendance_status: 'NOT_MARKED',
        deduct_class: false
      });
      // 3. Past attended and deducted
      ClassRepository.Classes_insert(edgeSpreadsheet, {
        session_id: 'cls_b_3',
        student_id: backendStudentId,
        topic: 'Math',
        schedule_date: '2026-11-04',
        schedule_time: '10:00',
        duration_minutes: 60,
        session_status: 'COMPLETED',
        attendance_status: 'PRESENT',
        deduct_class: true
      });
      // 4. Past non-consuming No-Show
      ClassRepository.Classes_insert(edgeSpreadsheet, {
        session_id: 'cls_b_4',
        student_id: backendStudentId,
        topic: 'Math',
        schedule_date: '2026-11-09',
        schedule_time: '10:00',
        duration_minutes: 60,
        session_status: 'COMPLETED',
        attendance_status: 'NO_SHOW',
        deduct_class: false
      });
      // 5. Past deducted No-Show
      ClassRepository.Classes_insert(edgeSpreadsheet, {
        session_id: 'cls_b_5',
        student_id: backendStudentId,
        topic: 'Math',
        schedule_date: '2026-11-11',
        schedule_time: '10:00',
        duration_minutes: 60,
        session_status: 'COMPLETED',
        attendance_status: 'NO_SHOW',
        deduct_class: true
      });

      // Backend generation run:
      const backendDry = ClassService.Classes_generateForPackage(edgeSpreadsheet, { student_id: backendStudentId, dry_run: true }, actor);
      expect(backendDry.success).toBe(true);
      expect(backendDry.existingCount).toBe(4);
      expect(backendDry.count).toBe(6);

      const backendRes = ClassService.Classes_generateForPackage(edgeSpreadsheet, { student_id: backendStudentId }, actor);
      expect(backendRes.success).toBe(true);
      expect(backendRes.existingCount).toBe(4);
      expect(backendRes.createdCount).toBe(6);

      // Clean up mock arrays
      const sIdx2 = MOCK_STUDENTS.findIndex(s => s.student_id === edgeStuId);
      if (sIdx2 !== -1) MOCK_STUDENTS.splice(sIdx2, 1);
      const pIdx2 = MOCK_PACKAGES.findIndex(p => p.student_id === edgeStuId);
      if (pIdx2 !== -1) MOCK_PACKAGES.splice(pIdx2, 1);
      for (let i = MOCK_CLASSES.length - 1; i >= 0; i--) {
        if ((MOCK_CLASSES[i] as any).student_id === edgeStuId) {
          MOCK_CLASSES.splice(i, 1);
        }
      }
    });

    describe('Same-Day and Date-Time Precision Accounting (Fixed Clock)', () => {
      // Fixed clock: 2026-11-26 18:00:00 IST (UTC: 2026-11-26T12:30:00.000Z)
      const FIXED_NOW_ISO = '2026-11-26T12:30:00.000Z';
      const FIXED_NOW_MS = new Date(FIXED_NOW_ISO).getTime();

      it('Accurately counts sessions relative to exact current instant across mock and backend', () => {
        const fixedStuId = 'STU_FIXED_CLOCK';
        (MOCK_STUDENTS as any[]).push({
          student_id: fixedStuId,
          student_name: 'Fixed Clock Student',
          status: 'ACTIVE'
        });
        (MOCK_PACKAGES as any[]).push({
          package_id: 'PKG_FIXED',
          student_id: fixedStuId,
          package_name: 'Fixed 10 Pack',
          classes_purchased: 10,
          total_classes: 10,
          class_duration: 60,
          start_date: '2026-11-20',
          class_schedule: 'Mon - 10:00 AM, Thu - 10:00 AM, Thu - 08:00 PM',
          status: 'ACTIVE'
        });

        // 1. Same-day scheduled class whose start time has passed (10:00 AM < 18:00 IST)
        // -> Overdue, must NOT reserve allocation!
        (MOCK_CLASSES as any[]).push({
          session_id: 'cls_same_day_overdue',
          student_id: fixedStuId,
          topic: 'Math',
          schedule_date: '2026-11-26',
          schedule_time: '10:00',
          scheduled_start: '2026-11-26T10:00:00.000Z',
          duration_minutes: 60,
          status: 'SCHEDULED',
          session_status: 'SCHEDULED',
          attendance_status: 'NOT_MARKED',
          deduct_class: false
        });

        // 2. Same-day scheduled class whose start time is ahead (20:00 > 18:00 IST)
        // -> Active future scheduled, MUST reserve allocation (+1)
        (MOCK_CLASSES as any[]).push({
          session_id: 'cls_same_day_future',
          student_id: fixedStuId,
          topic: 'Math',
          schedule_date: '2026-11-26',
          schedule_time: '20:00',
          scheduled_start: '2026-11-26T20:00:00.000Z',
          duration_minutes: 60,
          status: 'SCHEDULED',
          session_status: 'SCHEDULED',
          attendance_status: 'NOT_MARKED',
          deduct_class: false
        });

        // 3. Previous-day overdue scheduled class (2026-11-25 10:00)
        // -> Past overdue, must NOT reserve allocation!
        (MOCK_CLASSES as any[]).push({
          session_id: 'cls_prev_day_overdue',
          student_id: fixedStuId,
          topic: 'Math',
          schedule_date: '2026-11-25',
          schedule_time: '10:00',
          scheduled_start: '2026-11-25T10:00:00.000Z',
          duration_minutes: 60,
          status: 'SCHEDULED',
          session_status: 'SCHEDULED',
          attendance_status: 'NOT_MARKED',
          deduct_class: false
        });

        // 4. Next-day scheduled class (2026-11-27 10:00)
        // -> Future scheduled, MUST reserve allocation (+1)
        (MOCK_CLASSES as any[]).push({
          session_id: 'cls_next_day_future',
          student_id: fixedStuId,
          topic: 'Math',
          schedule_date: '2026-11-27',
          schedule_time: '10:00',
          scheduled_start: '2026-11-27T10:00:00.000Z',
          duration_minutes: 60,
          status: 'SCHEDULED',
          session_status: 'SCHEDULED',
          attendance_status: 'NOT_MARKED',
          deduct_class: false
        });

        // 5. Attended session with deduct_class = true (completed on previous day)
        // -> MUST count regardless of date (+1)
        (MOCK_CLASSES as any[]).push({
          session_id: 'cls_past_attended_deducted',
          student_id: fixedStuId,
          topic: 'Math',
          schedule_date: '2026-11-24',
          schedule_time: '10:00',
          scheduled_start: '2026-11-24T10:00:00.000Z',
          duration_minutes: 60,
          status: 'COMPLETED',
          session_status: 'COMPLETED',
          attendance_status: 'PRESENT',
          deduct_class: true
        });

        // 6. Non-consuming No-Show with deduct_class = false (same day morning 09:00)
        // -> Must NOT count regardless of date
        (MOCK_CLASSES as any[]).push({
          session_id: 'cls_no_show_non_consuming',
          student_id: fixedStuId,
          topic: 'Math',
          schedule_date: '2026-11-26',
          schedule_time: '09:00',
          scheduled_start: '2026-11-26T09:00:00.000Z',
          duration_minutes: 60,
          status: 'COMPLETED',
          session_status: 'COMPLETED',
          attendance_status: 'NO_SHOW',
          deduct_class: false
        });

        // Expected allocation:
        // Total purchased = 10
        // Consuming / reserving:
        // - cls_same_day_future (20:00): +1
        // - cls_next_day_future (Nov 27): +1
        // - cls_past_attended_deducted (Nov 24): +1
        // Total consuming = 3. Needed = 10 - 3 = 7.
        // Non-consuming:
        // - cls_same_day_overdue (10:00): 0
        // - cls_prev_day_overdue (Nov 25): 0
        // - cls_no_show_non_consuming (Nov 26 09:00): 0

        const mockDry = handleMockGenerateForPackage({ student_id: fixedStuId, current_time: FIXED_NOW_ISO, dry_run: true });
        expect(mockDry.success).toBe(true);
        expect(mockDry.existingCount).toBe(5);
        expect(mockDry.count).toBe(5);

        const mockGen = handleMockGenerateForPackage({ student_id: fixedStuId, current_time: FIXED_NOW_ISO });
        expect(mockGen.success).toBe(true);
        expect(mockGen.existingCount).toBe(5);
        expect(mockGen.count).toBe(5);

        // Verify Backend Apps Script ClassService with exact same fixed clock
        const edgeSpreadsheet = new MockSpreadsheet();
        SpreadsheetBootstrap.bootstrapSpreadsheet(edgeSpreadsheet, SheetRegistry, '1.0.0');

        const bStu = StudentService.Students_create(edgeSpreadsheet, {
          first_name: 'Fixed Clock Backend',
          parent_guardian_name: 'Backend Parent',
          primary_phone: '+919876588888'
        }, actor);
        const backendStudentId = bStu.data.student_id;

        PackageService.Packages_create(edgeSpreadsheet, {
          student_id: backendStudentId,
          package_name: 'Fixed 10 Pack Backend',
          classes_purchased: 10,
          total_classes: 10,
          class_duration: 60,
          start_date: '2026-11-20',
          class_schedule: 'Mon - 10:00 AM, Thu - 10:00 AM, Thu - 08:00 PM',
          status: 'ACTIVE'
        }, actor);

        // 1. Same-day scheduled overdue
        ClassRepository.Classes_insert(edgeSpreadsheet, {
          session_id: 'cls_b_same_day_overdue',
          student_id: backendStudentId,
          topic: 'Math',
          schedule_date: '2026-11-26',
          schedule_time: '10:00',
          scheduled_start: '2026-11-26T10:00:00.000Z',
          duration_minutes: 60,
          session_status: 'SCHEDULED',
          attendance_status: 'NOT_MARKED',
          deduct_class: false
        });

        // 2. Same-day scheduled future
        ClassRepository.Classes_insert(edgeSpreadsheet, {
          session_id: 'cls_b_same_day_future',
          student_id: backendStudentId,
          topic: 'Math',
          schedule_date: '2026-11-26',
          schedule_time: '20:00',
          scheduled_start: '2026-11-26T20:00:00.000Z',
          duration_minutes: 60,
          session_status: 'SCHEDULED',
          attendance_status: 'NOT_MARKED',
          deduct_class: false
        });

        // 3. Previous-day overdue
        ClassRepository.Classes_insert(edgeSpreadsheet, {
          session_id: 'cls_b_prev_day_overdue',
          student_id: backendStudentId,
          topic: 'Math',
          schedule_date: '2026-11-25',
          schedule_time: '10:00',
          scheduled_start: '2026-11-25T10:00:00.000Z',
          duration_minutes: 60,
          session_status: 'SCHEDULED',
          attendance_status: 'NOT_MARKED',
          deduct_class: false
        });

        // 4. Next-day future
        ClassRepository.Classes_insert(edgeSpreadsheet, {
          session_id: 'cls_b_next_day_future',
          student_id: backendStudentId,
          topic: 'Math',
          schedule_date: '2026-11-27',
          schedule_time: '10:00',
          scheduled_start: '2026-11-27T10:00:00.000Z',
          duration_minutes: 60,
          session_status: 'SCHEDULED',
          attendance_status: 'NOT_MARKED',
          deduct_class: false
        });

        // 5. Attended with deduct_class = true
        ClassRepository.Classes_insert(edgeSpreadsheet, {
          session_id: 'cls_b_past_attended_deducted',
          student_id: backendStudentId,
          topic: 'Math',
          schedule_date: '2026-11-24',
          schedule_time: '10:00',
          scheduled_start: '2026-11-24T10:00:00.000Z',
          duration_minutes: 60,
          session_status: 'COMPLETED',
          attendance_status: 'PRESENT',
          deduct_class: true
        });

        // 6. Non-consuming No-Show
        ClassRepository.Classes_insert(edgeSpreadsheet, {
          session_id: 'cls_b_no_show_non_consuming',
          student_id: backendStudentId,
          topic: 'Math',
          schedule_date: '2026-11-26',
          schedule_time: '09:00',
          scheduled_start: '2026-11-26T09:00:00.000Z',
          duration_minutes: 60,
          session_status: 'COMPLETED',
          attendance_status: 'NO_SHOW',
          deduct_class: false
        });

        const backendDry = ClassService.Classes_generateForPackage(
          edgeSpreadsheet,
          { student_id: backendStudentId, current_time: FIXED_NOW_ISO, dry_run: true },
          actor
        );
        expect(backendDry.success).toBe(true);
        expect(backendDry.existingCount).toBe(5);
        expect(backendDry.count).toBe(5);

        const backendRes = ClassService.Classes_generateForPackage(
          edgeSpreadsheet,
          { student_id: backendStudentId, current_time: FIXED_NOW_ISO },
          actor
        );
        expect(backendRes.success).toBe(true);
        expect(backendRes.existingCount).toBe(5);
        expect(backendRes.createdCount).toBe(5);

        // Cleanup
        const sIdx = MOCK_STUDENTS.findIndex(s => s.student_id === fixedStuId);
        if (sIdx !== -1) MOCK_STUDENTS.splice(sIdx, 1);
        const pIdx = MOCK_PACKAGES.findIndex(p => p.student_id === fixedStuId);
        if (pIdx !== -1) MOCK_PACKAGES.splice(pIdx, 1);
        for (let i = MOCK_CLASSES.length - 1; i >= 0; i--) {
          if ((MOCK_CLASSES[i] as any).student_id === fixedStuId) {
            MOCK_CLASSES.splice(i, 1);
          }
        }
      });
    });
  });
});
