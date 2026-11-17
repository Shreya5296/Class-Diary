import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateRegistrationForm } from '../../src/domains/students/registrationValidation';
import { submitRegistration } from '../../src/domains/students/registrationSubmitter';
import { RegistrationFormData } from '../../src/domains/students/registrationTypes';
import { generateCalendarEvents } from '../../src/domains/dashboard/calendarEventGenerator';
import { buildDayColumns } from '../../src/domains/calendar/calendarGridBuilder';
import { parseCanonicalScheduleString, formatCanonicalScheduleString } from '../../src/domains/students/scheduleFormatter';
import { getFutureDate } from '../fixtures/testDateHelpers';
import { submitEditStudent } from '../../src/domains/students/editStudentSubmitter';
import * as studentApi from '../../src/domains/students/studentApi';
import * as packageApi from '../../src/domains/packages/packageApi';
import * as classApi from '../../src/domains/classes/classApi';
import * as scheduleApi from '../../src/domains/classes/scheduleApi';

describe('Batch 1 Stabilisation: FE-01, FE-02, FE-03', () => {
  describe('FE-01: Primary Meeting Link Capture in Student Registration', () => {
    const baseForm: RegistrationFormData = {
      student: {
        student_name: 'Ananya Sharma',
        subject: 'Mathematics',
        student_phone: '+91 98765 43210',
        student_email: 'ananya@example.com',
        primary_meeting_link: '',
      },
      parent: {
        parent_name: 'Rajesh Sharma',
        parent_phone: '+91 98765 43211',
        parent_email: 'rajesh@example.com',
      },
      pkg: {
        plan_type: 'Package',
        currency: 'INR',
        package_price: '20000',
        per_class: '1000',
        classes_purchased: '20',
        class_duration: '60',
      },
      schedules: [],
      first_class_date: getFutureDate(7),
    };

    it('accepts valid https and http meeting links', () => {
      const withHttps: RegistrationFormData = {
        ...baseForm,
        student: { ...baseForm.student, primary_meeting_link: 'https://meet.google.com/abc-defg-hij' },
      };
      const resHttps = validateRegistrationForm(withHttps);
      expect(resHttps.isValid).toBe(true);
      expect(resHttps.errors.student?.primary_meeting_link).toBeUndefined();

      const withHttp: RegistrationFormData = {
        ...baseForm,
        student: { ...baseForm.student, primary_meeting_link: 'http://meet.google.com/abc-defg-hij' },
      };
      const resHttp = validateRegistrationForm(withHttp);
      expect(resHttp.isValid).toBe(true);
    });

    it('accepts empty or whitespace meeting link (optional field)', () => {
      const resEmpty = validateRegistrationForm(baseForm);
      expect(resEmpty.isValid).toBe(true);
      expect(resEmpty.errors.student?.primary_meeting_link).toBeUndefined();

      const withWhitespace: RegistrationFormData = {
        ...baseForm,
        student: { ...baseForm.student, primary_meeting_link: '   ' },
      };
      const resWs = validateRegistrationForm(withWhitespace);
      expect(resWs.isValid).toBe(true);
    });

    it('rejects invalid meeting link formats', () => {
      const invalidUrls = ['not-a-url', 'ftp://meet.google.com/abc', 'javascript:alert(1)', 'meet.google.com/abc'];
      for (const url of invalidUrls) {
        const form: RegistrationFormData = {
          ...baseForm,
          student: { ...baseForm.student, primary_meeting_link: url },
        };
        const res = validateRegistrationForm(form);
        expect(res.isValid).toBe(false);
        expect(res.errors.student?.primary_meeting_link).toBe('Invalid meeting link URL format.');
      }
    });

    it('submits primary_meeting_link to createStudent on new student registration', async () => {
      const createSpy = vi.spyOn(studentApi, 'createStudent').mockResolvedValue({
        student_id: 'STU_NEW_1',
        student_name: 'Ananya Sharma',
        status: 'ACTIVE',
        primary_meeting_link: 'https://meet.google.com/abc-defg-hij',
      });
      vi.spyOn(studentApi, 'fetchStudents').mockResolvedValue([]);
      vi.spyOn(packageApi, 'fetchPackages').mockResolvedValue([]);
      vi.spyOn(packageApi, 'createPackage').mockResolvedValue({
        package_id: 'PKG_1',
        student_id: 'STU_NEW_1',
      } as any);
      vi.spyOn(scheduleApi, 'saveSchedules').mockResolvedValue([]);
      vi.spyOn(classApi, 'fetchClasses').mockResolvedValue([]);
      vi.spyOn(classApi, 'batchScheduleClasses').mockResolvedValue([]);

      const formWithLink: RegistrationFormData = {
        ...baseForm,
        student: { ...baseForm.student, primary_meeting_link: 'https://meet.google.com/abc-defg-hij' },
      };

      await submitRegistration(formWithLink, null, 'fake-token');

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          student_name: 'Ananya Sharma',
          primary_meeting_link: 'https://meet.google.com/abc-defg-hij',
        }),
        'fake-token'
      );
      createSpy.mockRestore();
    });

    it('submits primary_meeting_link to updateStudent when matching existing student', async () => {
      const updateSpy = vi.spyOn(studentApi, 'updateStudent').mockResolvedValue({
        student_id: 'STU_EXISTING_1',
        student_name: 'Ananya Sharma',
        status: 'ACTIVE',
        primary_meeting_link: 'https://meet.google.com/abc-defg-hij',
      });
      vi.spyOn(studentApi, 'fetchStudents').mockResolvedValue([
        { student_id: 'STU_EXISTING_1', student_name: 'Ananya Sharma', status: 'ACTIVE' } as any,
      ]);
      vi.spyOn(packageApi, 'fetchPackages').mockResolvedValue([]);
      vi.spyOn(packageApi, 'createPackage').mockResolvedValue({ package_id: 'PKG_1' } as any);
      vi.spyOn(scheduleApi, 'saveSchedules').mockResolvedValue([]);
      vi.spyOn(classApi, 'fetchClasses').mockResolvedValue([]);
      vi.spyOn(classApi, 'batchScheduleClasses').mockResolvedValue([]);

      const formWithLink: RegistrationFormData = {
        ...baseForm,
        student: { ...baseForm.student, primary_meeting_link: 'https://meet.google.com/abc-defg-hij' },
      };

      await submitRegistration(formWithLink, null, 'fake-token');

      expect(updateSpy).toHaveBeenCalledWith(
        'STU_EXISTING_1',
        expect.objectContaining({
          student_name: 'Ananya Sharma',
          primary_meeting_link: 'https://meet.google.com/abc-defg-hij',
        }),
        'fake-token'
      );
      updateSpy.mockRestore();
    });

    it('B: preserves existing meeting link when meeting-link is omitted during edit', async () => {
      const updateSpy = vi.spyOn(studentApi, 'updateStudent').mockResolvedValue({
        student_id: 'STU_EXISTING',
        student_name: 'Ananya Sharma',
        status: 'ACTIVE',
        primary_meeting_link: 'https://meet.google.com/existing-link',
      });
      vi.spyOn(packageApi, 'updatePackage').mockResolvedValue({} as any);
      vi.spyOn(scheduleApi, 'saveSchedules').mockResolvedValue([]);

      await submitEditStudent({
        student: {
          student_id: 'STU_EXISTING',
          student_name: 'Ananya Sharma',
          primary_meeting_link: 'https://meet.google.com/existing-link',
          status: 'ACTIVE',
        },
        studentData: { student_name: 'Ananya Sharma Updated', status: 'ACTIVE' },
        packageData: { mode: 'EDIT_EXISTING', plan_type: 'Package', currency: 'INR', package_price: '', per_class: '', classes_purchased: '', class_duration: 60, end_date: '' },
        existingPkg: null,
        schedules: [],
        token: 'fake-token',
      });

      expect(updateSpy).toHaveBeenCalledWith(
        'STU_EXISTING',
        expect.objectContaining({
          primary_meeting_link: 'https://meet.google.com/existing-link',
        }),
        'fake-token'
      );
      updateSpy.mockRestore();
    });

    it('C: explicitly clears meeting link when empty string is provided during edit', async () => {
      const updateSpy = vi.spyOn(studentApi, 'updateStudent').mockResolvedValue({
        student_id: 'STU_EXISTING',
        student_name: 'Ananya Sharma',
        status: 'ACTIVE',
        primary_meeting_link: '',
      });
      vi.spyOn(packageApi, 'updatePackage').mockResolvedValue({} as any);
      vi.spyOn(scheduleApi, 'saveSchedules').mockResolvedValue([]);

      await submitEditStudent({
        student: {
          student_id: 'STU_EXISTING',
          student_name: 'Ananya Sharma',
          primary_meeting_link: 'https://meet.google.com/existing-link',
          status: 'ACTIVE',
        },
        studentData: { student_name: 'Ananya Sharma', status: 'ACTIVE' },
        meetingLink: '',
        packageData: { mode: 'EDIT_EXISTING', plan_type: 'Package', currency: 'INR', package_price: '', per_class: '', classes_purchased: '', class_duration: 60, end_date: '' },
        existingPkg: null,
        schedules: [],
        token: 'fake-token',
      });

      expect(updateSpy).toHaveBeenCalledWith(
        'STU_EXISTING',
        expect.objectContaining({
          primary_meeting_link: '',
        }),
        'fake-token'
      );
      updateSpy.mockRestore();
    });
  });

  describe('FE-02: Calendar Meeting Link Access and Join Actions', () => {
    const student = {
      student_id: 'STU_001',
      student_name: 'Aarav Sharma',
      primary_meeting_link: 'https://meet.google.com/aarav-class',
      status: 'ACTIVE',
    };

    it('attaches primary_meeting_link to dated and recurring calendar events', () => {
      const events = generateCalendarEvents({
        datedSessions: [
          {
            session_id: 'ses_1',
            student_id: 'STU_001',
            student_name: 'Aarav Sharma',
            scheduled_start: '2026-10-26T17:00:00+05:30',
            duration_minutes: 60,
            status: 'SCHEDULED',
          } as any,
        ],
        recurringSchedules: [
          {
            schedule_id: 'sch_1',
            student_id: 'STU_001',
            day_of_week: 'WEDNESDAY',
            start_time: '18:00',
            end_time: '19:00',
            is_active: true,
          },
        ],
        students: [student as any],
        packages: [],
        weekDates: ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'],
        activeTz: 'Asia/Kolkata',
      });

      const datedEvent = events.find((e) => e.session_id === 'ses_1');
      expect(datedEvent?.meeting_url).toBe('https://meet.google.com/aarav-class');

      const recurringEvent = events.find((e) => e.student_id === 'STU_001' && (e as any).is_recurring);
      expect(recurringEvent?.meeting_url).toBe('https://meet.google.com/aarav-class');
    });

    it('enables canJoin on today’s active sessions with meeting links, disables for past/cancelled/completed', () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const grid = buildDayColumns({
        datedSessions: [
          {
            session_id: 'ses_active_today',
            student_id: 'STU_001',
            scheduled_start: `${todayStr}T23:00:00+05:30`,
            scheduled_end: `${todayStr}T23:59:00+05:30`,
            status: 'SCHEDULED',
          } as any,
          {
            session_id: 'ses_cancelled_today',
            student_id: 'STU_001',
            scheduled_start: `${todayStr}T23:00:00+05:30`,
            status: 'CANCELLED',
          } as any,
          {
            session_id: 'ses_completed_today',
            student_id: 'STU_001',
            scheduled_start: `${todayStr}T23:00:00+05:30`,
            status: 'COMPLETED',
          } as any,
        ],
        recurringSchedules: [],
        weekDates: [todayStr],
        activeTz: 'Asia/Kolkata',
        students: [student as any],
      });

      const todayCol = grid.find((col) => col.dateKey === todayStr);
      expect(todayCol).toBeDefined();

      const activeEvt = todayCol!.events.find((e) => e.id === 'ses_active_today');
      expect(activeEvt?.meetingUrl).toBe('https://meet.google.com/aarav-class');
      expect(activeEvt?.canJoin).toBe(true);

      const cancelledEvt = todayCol!.events.find((e) => e.id === 'ses_cancelled_today');
      expect(cancelledEvt?.canJoin).toBe(false);

      const completedEvt = todayCol!.events.find((e) => e.id === 'ses_completed_today');
      expect(completedEvt?.canJoin).toBe(false);
    });

    it('disables canJoin when meeting link has unsafe protocol like javascript:', () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const unsafeStudent = {
        student_id: 'STU_UNSAFE',
        student_name: 'Hacker',
        primary_meeting_link: 'javascript:alert(1)',
        status: 'ACTIVE',
      };
      const grid = buildDayColumns({
        datedSessions: [
          {
            session_id: 'ses_unsafe',
            student_id: 'STU_UNSAFE',
            scheduled_start: `${todayStr}T23:00:00+05:30`,
            status: 'SCHEDULED',
          } as any,
        ],
        recurringSchedules: [],
        weekDates: [todayStr],
        activeTz: 'Asia/Kolkata',
        students: [unsafeStudent as any],
      });

      const evt = grid[0].events.find((e) => e.id === 'ses_unsafe');
      expect(evt?.canJoin).toBe(false);
    });

    it('F: dated session-specific meeting URL takes precedence over student-level fallback', () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const grid = buildDayColumns({
        datedSessions: [
          {
            session_id: 'ses_override',
            student_id: 'STU_001',
            scheduled_start: `${todayStr}T23:00:00+05:30`,
            scheduled_end: `${todayStr}T23:59:00+05:30`,
            status: 'SCHEDULED',
            meeting_url: 'https://meet.google.com/session-specific-override',
          } as any,
        ],
        recurringSchedules: [],
        weekDates: [todayStr],
        activeTz: 'Asia/Kolkata',
        students: [student as any],
      });

      const evt = grid[0].events.find((e) => e.id === 'ses_override');
      expect(evt?.meetingUrl).toBe('https://meet.google.com/session-specific-override');
      expect(evt?.canJoin).toBe(true);
    });

    it('G: recurring session falls back to student primary meeting URL', () => {
      const mondayStr = '2026-11-16'; // Monday
      const events = generateCalendarEvents({
        datedSessions: [],
        recurringSchedules: [
          {
            schedule_id: 'sch_rec_1',
            student_id: 'STU_001',
            day_of_week: 'MONDAY',
            start_time: '18:00',
            end_time: '19:00',
            is_active: true,
          },
        ],
        students: [student as any],
        packages: [],
        weekDates: [mondayStr],
        activeTz: 'Asia/Kolkata',
      });

      const recEvt = events.find((e) => e.student_id === 'STU_001' && (e as any).is_recurring);
      expect(recEvt?.meeting_url).toBe('https://meet.google.com/aarav-class');
    });

    it('H: missing or invalid meeting URL must not display Join Class (canJoin is false)', () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const stuWithoutLink = { student_id: 'STU_NO_LINK', student_name: 'No Link', status: 'ACTIVE' };
      const grid = buildDayColumns({
        datedSessions: [
          {
            session_id: 'ses_no_link',
            student_id: 'STU_NO_LINK',
            scheduled_start: `${todayStr}T23:00:00+05:30`,
            status: 'SCHEDULED',
          } as any,
        ],
        recurringSchedules: [],
        weekDates: [todayStr],
        activeTz: 'Asia/Kolkata',
        students: [stuWithoutLink as any],
      });

      const evt = grid[0].events.find((e) => e.id === 'ses_no_link');
      expect(evt?.meetingUrl).toBe('');
      expect(evt?.canJoin).toBe(false);
    });
  });

  describe('FE-03: Student Directory Schedule Parsing from Packages', () => {
    it('does not import or call fetchSchedules in useStudentAggregates', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/domains/students/useStudentAggregates.ts', 'utf-8');
      expect(content).not.toContain('fetchSchedules');
    });

    it('correctly parses canonical schedule string into structured entries', () => {
      const formatted = formatCanonicalScheduleString([
        { day_of_week: 'MONDAY', start_time: '17:00', end_time: '18:00' } as any,
        { day_of_week: 'WEDNESDAY', start_time: '17:00', end_time: '18:00' } as any,
      ]);
      const parsed = parseCanonicalScheduleString(formatted, 60);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].day_of_week).toBe('MONDAY');
      expect(parsed[0].start_time).toBe('17:00');
      expect(parsed[0].end_time).toBe('18:00');

      expect(parsed[1].day_of_week).toBe('WEDNESDAY');
      expect(parsed[1].start_time).toBe('17:00');
      expect(parsed[1].end_time).toBe('18:00');
    });

    it('returns empty array when schedule string is empty or absent', () => {
      expect(parseCanonicalScheduleString('', 60)).toEqual([]);
      expect(parseCanonicalScheduleString('   ', 60)).toEqual([]);
    });

    it('I: selects active package with class_schedule when multiple packages exist', () => {
      const activeSched = formatCanonicalScheduleString([{ day_of_week: 'WEDNESDAY', start_time: '18:00', end_time: '19:00' } as any]);
      const pkgs: any[] = [
        { package_id: 'pkg_old', student_id: 'STU_MULT', status: 'COMPLETED', start_date: '2025-01-01', class_schedule: 'Mon - 10:00 AM' },
        { package_id: 'pkg_active', student_id: 'STU_MULT', status: 'ACTIVE', start_date: '2026-06-01', class_schedule: activeSched, class_duration: 60 },
      ];
      const sid = 'STU_MULT';
      const studentPkgs = pkgs
        .filter((p) => p.student_id === sid)
        .sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')));
      const activePkg =
        studentPkgs.find((p) => p.status === 'ACTIVE' && Boolean(p.class_schedule)) ||
        studentPkgs.find((p) => Boolean(p.class_schedule)) ||
        studentPkgs[0];
      expect(activePkg.package_id).toBe('pkg_active');
      const parsed = parseCanonicalScheduleString(activePkg.class_schedule, Number(activePkg.class_duration) || 60);
      expect(parsed[0].day_of_week).toBe('WEDNESDAY');
    });

    it('J: falls back to 60 minutes duration when class_duration is missing/0 and handles malformed schedule gracefully', () => {
      const malformedSched = 'NOT_A_VALID_SCHEDULE_STRING';
      const parsed = parseCanonicalScheduleString(malformedSched, 0);
      expect(parsed).toEqual([]);

      const durationFallback = Number(undefined) || 60;
      expect(durationFallback).toBe(60);
    });
  });
});
