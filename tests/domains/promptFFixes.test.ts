import { describe, it, expect } from 'vitest';
import { isSessionAttendanceOverdue } from '../../src/domains/dashboard/attentionAlertsHelpers';
import { generateAttentionAlerts } from '../../src/domains/dashboard/attentionAlerts';
import { handleMockGenerateForPackage } from '../../src/api/mockPackageClassGenerator';
import { MOCK_STUDENTS, MOCK_PACKAGES, MOCK_CLASSES } from '../../src/api/mockDataInitial';
import { ClassSession } from '../../src/domains/classes/classTypes';
import { Student } from '../../src/domains/students/studentTypes';

describe('Class Diary: Prompt F Unit Tests (Fix F1 & Fix F2)', () => {
  describe('Fix F2: Attendance pending must show only past classes whose end time is over', () => {
    const fixedNowMs = new Date('2026-11-27T14:00:00+05:30').getTime();

    it('shows yesterday class as attendance pending', () => {
      const yesterdaySession: ClassSession = {
        session_id: 's_yest',
        student_id: 'STU_TEST_1',
        schedule_date: '2026-11-26',
        schedule_time: '14:00',
        duration_minutes: 60,
        session_status: 'SCHEDULED',
        attendance_status: 'NOT_MARKED',
      };
      expect(isSessionAttendanceOverdue(yesterdaySession, fixedNowMs, 'Asia/Kolkata')).toBe(true);
    });

    it('shows class that ended 5 minutes ago as attendance pending', () => {
      // Ended 5 mins ago -> started 65 mins ago (duration 60 mins)
      // 14:00 - 65 mins = 12:55
      const ended5MinsAgoSession: ClassSession = {
        session_id: 's_5m_ago',
        student_id: 'STU_TEST_1',
        schedule_date: '2026-11-27',
        schedule_time: '12:55',
        duration_minutes: 60,
        session_status: 'SCHEDULED',
        attendance_status: 'NOT_MARKED',
      };
      expect(isSessionAttendanceOverdue(ended5MinsAgoSession, fixedNowMs, 'Asia/Kolkata')).toBe(true);
    });

    it('does NOT show class starting in 1 hour', () => {
      // 14:00 + 60 mins = 15:00
      const startingIn1HrSession: ClassSession = {
        session_id: 's_1h_future',
        student_id: 'STU_TEST_1',
        schedule_date: '2026-11-27',
        schedule_time: '15:00',
        duration_minutes: 60,
        session_status: 'SCHEDULED',
        attendance_status: 'NOT_MARKED',
      };
      expect(isSessionAttendanceOverdue(startingIn1HrSession, fixedNowMs, 'Asia/Kolkata')).toBe(false);
    });

    it('does NOT show class next week', () => {
      const nextWeekSession: ClassSession = {
        session_id: 's_next_week',
        student_id: 'STU_TEST_1',
        schedule_date: '2026-12-04',
        schedule_time: '14:00',
        duration_minutes: 60,
        session_status: 'SCHEDULED',
        attendance_status: 'NOT_MARKED',
      };
      expect(isSessionAttendanceOverdue(nextWeekSession, fixedNowMs, 'Asia/Kolkata')).toBe(false);
    });

    it('does NOT show class that is today but still running', () => {
      // Started 30 mins ago, duration 60 mins -> ends in 30 mins
      const runningSession: ClassSession = {
        session_id: 's_running',
        student_id: 'STU_TEST_1',
        schedule_date: '2026-11-27',
        schedule_time: '13:30',
        duration_minutes: 60,
        session_status: 'SCHEDULED',
        attendance_status: 'NOT_MARKED',
      };
      expect(isSessionAttendanceOverdue(runningSession, fixedNowMs, 'Asia/Kolkata')).toBe(false);
    });

    it('never shows future classes with legacy 1899 times (like Krishnavi)', () => {
      const krishnaviFuture: ClassSession = {
        session_id: 'STU_005__2026-11-28__1899',
        student_id: 'STU_005',
        student_name: 'Krishnavi',
        schedule_date: '2026-11-28T06:30:00.000Z',
        schedule_time: '1899-12-30T12:38:50.000Z',
        attendance_status: 'NOT_MARKED',
        session_status: 'SCHEDULED',
        duration_minutes: 60,
      };
      expect(isSessionAttendanceOverdue(krishnaviFuture, fixedNowMs, 'Asia/Kolkata')).toBe(false);
    });
  });

  describe('Fix F1: Generate classes from package start date and stop at end date or total count', () => {
    const testStuId = 'STU_ZZ_TEST_F1';

    it('generates classes from package start date in the past up to total count or end date', () => {
      MOCK_STUDENTS.push({
        student_id: testStuId,
        student_name: 'ZZ TEST 3 Weeks Ago',
        status: 'ACTIVE',
      } as Student);

      // Package started 3 weeks ago (2026-11-06) and ends in 2 weeks (2026-12-11)
      // Total classes: 6. Schedule: Fri 10:00 AM (1 class per week)
      MOCK_PACKAGES.push({
        package_id: 'pkg_f1_test',
        student_id: testStuId,
        package_name: 'Weekly 6 Pack',
        classes_purchased: 6,
        total_classes: 6,
        start_date: '2026-11-06',
        end_date: '2026-12-18',
        class_duration: 60,
        class_schedule: 'Fri - 10:00 AM',
        status: 'ACTIVE',
      });

      const res = handleMockGenerateForPackage({
        student_id: testStuId,
        current_time: '2026-11-27T12:00:00+05:30',
      });

      expect(res.success).toBe(true);
      expect(res.count).toBe(6);

      const generated = (MOCK_CLASSES as any[]).filter((c) => c.student_id === testStuId);
      expect(generated).toHaveLength(6);

      // Verify first class starts at package start date (2026-11-06)
      expect(generated[0].schedule_date).toBe('2026-11-06');
      expect(generated[0].attendance_status).toBe('NOT_MARKED');
      expect(generated[0].session_status).toBe('SCHEDULED');

      // Verify past classes (2026-11-06, 2026-11-13, 2026-11-20, 2026-11-27 morning)
      // are created as NOT_MARKED (pending)
      const pastSessions = generated.filter((c) => c.schedule_date < '2026-11-27');
      expect(pastSessions.length).toBe(3);
      for (const p of pastSessions) {
        expect(p.attendance_status).toBe('NOT_MARKED');
        expect(p.session_status).toBe('SCHEDULED');
      }

      // Verify second run creates 0 classes (no duplicates or over-allocation)
      const secondRun = handleMockGenerateForPackage({
        student_id: testStuId,
        current_time: '2026-11-27T12:00:00+05:30',
      });
      expect(secondRun.success).toBe(true);
      expect(secondRun.count).toBe(0);

      // Clean up
      const sIdx = MOCK_STUDENTS.findIndex((s) => s.student_id === testStuId);
      if (sIdx !== -1) MOCK_STUDENTS.splice(sIdx, 1);
      const pIdx = MOCK_PACKAGES.findIndex((p) => p.student_id === testStuId);
      if (pIdx !== -1) MOCK_PACKAGES.splice(pIdx, 1);
      for (let i = MOCK_CLASSES.length - 1; i >= 0; i--) {
        if ((MOCK_CLASSES[i] as any).student_id === testStuId) {
          MOCK_CLASSES.splice(i, 1);
        }
      }
    });

    it('stops generation at package end date if end date is reached before total classes', () => {
      const testStuId2 = 'STU_ZZ_TEST_F1_END';
      MOCK_STUDENTS.push({
        student_id: testStuId2,
        student_name: 'ZZ TEST End Date Stop',
        status: 'ACTIVE',
      } as Student);

      // Total classes: 100, but end_date is only 3 weeks after start_date
      MOCK_PACKAGES.push({
        package_id: 'pkg_f1_end_test',
        student_id: testStuId2,
        package_name: 'Limited Duration Pack',
        classes_purchased: 100,
        total_classes: 100,
        start_date: '2026-11-06',
        end_date: '2026-11-20',
        class_duration: 60,
        class_schedule: 'Fri - 10:00 AM',
        status: 'ACTIVE',
      });

      const res = handleMockGenerateForPackage({
        student_id: testStuId2,
        current_time: '2026-11-27T12:00:00+05:30',
      });

      expect(res.success).toBe(true);
      // Only 3 Fridays between Nov 6 and Nov 20 (Nov 6, Nov 13, Nov 20)
      expect(res.count).toBe(3);

      const generated = (MOCK_CLASSES as any[]).filter((c) => c.student_id === testStuId2);
      expect(generated).toHaveLength(3);
      expect(generated[generated.length - 1].schedule_date).toBe('2026-11-20');

      // Clean up
      const sIdx = MOCK_STUDENTS.findIndex((s) => s.student_id === testStuId2);
      if (sIdx !== -1) MOCK_STUDENTS.splice(sIdx, 1);
      const pIdx = MOCK_PACKAGES.findIndex((p) => p.student_id === testStuId2);
      if (pIdx !== -1) MOCK_PACKAGES.splice(pIdx, 1);
      for (let i = MOCK_CLASSES.length - 1; i >= 0; i--) {
        if ((MOCK_CLASSES[i] as any).student_id === testStuId2) {
          MOCK_CLASSES.splice(i, 1);
        }
      }
    });
  });
});
