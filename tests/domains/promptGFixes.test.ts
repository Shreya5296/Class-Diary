import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getPackageTotalClasses,
  getPackagePerClassRate,
  getPackagePlanDetails,
} from '../../src/domains/packages/packagePlanCalculations';
import { handleMockGenerateForPackage } from '../../src/api/mockPackageClassGenerator';
import { MOCK_CLASSES, MOCK_PACKAGES, MOCK_SCHEDULES } from '../../src/api/mockDataInitial';
import { buildSessionProgressMap } from '../../src/domains/classes/sessionProgressCalculator';
import { ClassSession } from '../../src/domains/classes/classTypes';
import { Package } from '../../src/domains/packages/packageTypes';

describe('Prompt G Fixes: G1, G2, G3', () => {
  const testStudentIds = ['STU_ZZ_YEARLY', 'STU_013_GAMMA', 'STU_TOUCHED_TEST', 'STU_REHAAN_PROGRESS'];

  function cleanupTestIds() {
    for (let i = MOCK_CLASSES.length - 1; i >= 0; i--) {
      if (testStudentIds.includes((MOCK_CLASSES[i] as any).student_id)) {
        MOCK_CLASSES.splice(i, 1);
      }
    }
    for (let i = MOCK_PACKAGES.length - 1; i >= 0; i--) {
      if (testStudentIds.includes(MOCK_PACKAGES[i].student_id)) {
        MOCK_PACKAGES.splice(i, 1);
      }
    }
    for (const sid of testStudentIds) {
      delete MOCK_SCHEDULES[sid];
    }
  }

  beforeEach(() => {
    cleanupTestIds();
  });

  afterEach(() => {
    cleanupTestIds();
  });

  describe('G1: Yearly Plans & Rate Calculations', () => {
    it('calculates total classes in plan for yearly package from start to end date inclusive', () => {
      const yearlyPkg: Partial<Package> = {
        plan_type: 'Yearly',
        start_date: '2026-04-06',
        end_date: '2027-02-28',
        price: 100000,
        class_schedule: 'Mon - 6:30PM, Tue - 6:30pm, Wed - 6:30pm, Fri - 6:30pm',
      };

      const total = getPackageTotalClasses(yearlyPkg);
      // 4 days a week over 47 weeks = 188 classes
      expect(total).toBe(188);

      const rate = getPackagePerClassRate(yearlyPkg);
      // 100000 / 188 = 531.91
      expect(rate).toBe(531.91);

      const details = getPackagePlanDetails(yearlyPkg);
      expect(details.isYearly).toBe(true);
      expect(details.totalClasses).toBe(188);
      expect(details.ratePerClass).toBe(531.91);
      expect(details.totalClassesLabel).toBe('Total classes in plan');
      expect(details.rateLabel).toBe('Rate per class');
    });

    it('keeps non-yearly packages based on fixed class count and unchanged rate', () => {
      const standardPkg: Partial<Package> = {
        plan_type: 'Per Class',
        total_classes: 12,
        classes_purchased: 12,
        price: 18000,
        start_date: '2026-01-15',
      };

      const total = getPackageTotalClasses(standardPkg);
      expect(total).toBe(12);

      const rate = getPackagePerClassRate(standardPkg);
      expect(rate).toBe(1500);

      const details = getPackagePlanDetails(standardPkg);
      expect(details.isYearly).toBe(false);
      expect(details.totalClasses).toBe(12);
      expect(details.ratePerClass).toBe(1500);
      expect(details.totalClassesLabel).toBe('Total Classes');
      expect(details.rateLabel).toBe('Rate per class');
    });

    it('generates yearly classes from start date to end date without 80-class cap', () => {
      const sid = 'STU_ZZ_YEARLY';
      MOCK_PACKAGES.push({
        package_id: 'pkg_yearly_test',
        student_id: sid,
        package_name: 'Yearly Test Plan',
        plan_type: 'Yearly',
        start_date: '2026-04-06',
        end_date: '2027-02-28',
        package_price: 100000,
        classes_purchased: 80, // initial wrong number
        total_classes: 80,
        class_duration: 60,
        class_schedule: 'Mon - 18:30, Tue - 18:30, Wed - 18:30, Fri - 18:30',
        status: 'ACTIVE',
      });
      MOCK_SCHEDULES[sid] = [
        { day_of_week: 'MONDAY', start_time: '18:30', end_time: '19:30', is_active: true },
        { day_of_week: 'TUESDAY', start_time: '18:30', end_time: '19:30', is_active: true },
        { day_of_week: 'WEDNESDAY', start_time: '18:30', end_time: '19:30', is_active: true },
        { day_of_week: 'FRIDAY', start_time: '18:30', end_time: '19:30', is_active: true },
      ];

      const res = handleMockGenerateForPackage({ student_id: sid });
      expect(res.success).toBe(true);
      expect(res.totalPurchased).toBe(188);
      expect(res.count).toBe(188);
      expect(res.lastClassDate).toBe('2027-02-26');
    });
  });

  describe('G2 & G3: Schedule Edit Regeneration & Untouched Future Sessions', () => {
    it('removes future untouched classes and regenerates on new day from new first date', () => {
      const sid = 'STU_013_GAMMA';
      MOCK_PACKAGES.push({
        package_id: 'pkg_gamma',
        student_id: sid,
        package_name: 'Monthly 4 Pack',
        plan_type: 'Package',
        start_date: '2026-11-30',
        classes_purchased: 4,
        total_classes: 4,
        class_duration: 60,
        class_schedule: 'Mon - 17:00',
        status: 'ACTIVE',
      });

      // Existing 4 Monday sessions (Nov 30, Dec 7, Dec 14, Dec 21)
      const mondayDates = ['2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21'];
      for (const d of mondayDates) {
        MOCK_CLASSES.push({
          session_id: `${sid}__${d}__17:00`,
          student_id: sid,
          schedule_date: d,
          schedule_time: '17:00',
          start_time: '17:00',
          duration_minutes: 60,
          status: 'SCHEDULED',
          session_status: 'SCHEDULED',
          attendance_status: 'NOT_MARKED',
          deduct_class: false,
        } as any);
      }

      // Schedule is updated from Monday to Tuesday with first date 1 Dec 2026
      MOCK_SCHEDULES[sid] = [
        { day_of_week: 'TUESDAY', start_time: '17:00', end_time: '18:00', is_active: true },
      ];

      const res = handleMockGenerateForPackage({
        student_id: sid,
        regenerate_future: true,
        start_date: '2026-12-01',
        current_time: '2026-11-27T10:00:00Z',
      });

      expect(res.success).toBe(true);

      // Verify old Monday classes are gone
      const remainingClasses = (MOCK_CLASSES as ClassSession[]).filter((c) => c.student_id === sid);
      const remainingDates = remainingClasses.map((c) => c.schedule_date).sort();

      // Should now be Tuesday classes from Dec 1 onwards: Dec 1, Dec 8, Dec 15, Dec 22
      expect(remainingDates).toEqual(['2026-12-01', '2026-12-08', '2026-12-15', '2026-12-22']);
      expect(remainingClasses.every((c) => {
        const d = new Date(`${c.schedule_date}T12:00:00Z`);
        return d.getUTCDay() === 2; // Tuesday
      })).toBe(true);
    });

    it('never removes past classes or classes with notes, attendance, or payment link', () => {
      const sid = 'STU_TOUCHED_TEST';
      MOCK_PACKAGES.push({
        package_id: 'pkg_touched',
        student_id: sid,
        plan_type: 'Package',
        classes_purchased: 4,
        total_classes: 4,
        start_date: '2026-11-01',
        status: 'ACTIVE',
      });

      // 1 past attended class
      MOCK_CLASSES.push({
        session_id: `${sid}_past_attended`,
        student_id: sid,
        schedule_date: '2026-11-10',
        schedule_time: '17:00',
        status: 'COMPLETED',
        session_status: 'COMPLETED',
        attendance_status: 'PRESENT',
        deduct_class: true,
      } as any);

      // 1 future class WITH notes
      MOCK_CLASSES.push({
        session_id: `${sid}_future_notes`,
        student_id: sid,
        schedule_date: '2026-12-05',
        schedule_time: '17:00',
        status: 'SCHEDULED',
        session_status: 'SCHEDULED',
        attendance_status: 'NOT_MARKED',
        session_notes: 'Important topic prep',
        deduct_class: false,
      } as any);

      // 1 future untouched class
      MOCK_CLASSES.push({
        session_id: `${sid}_future_untouched`,
        student_id: sid,
        schedule_date: '2026-12-12',
        schedule_time: '17:00',
        status: 'SCHEDULED',
        session_status: 'SCHEDULED',
        attendance_status: 'NOT_MARKED',
        deduct_class: false,
      } as any);

      MOCK_SCHEDULES[sid] = [
        { day_of_week: 'FRIDAY', start_time: '17:00', end_time: '18:00', is_active: true },
      ];

      handleMockGenerateForPackage({
        student_id: sid,
        regenerate_future: true,
        current_time: '2026-11-27T10:00:00Z',
      });

      const remainingIds = (MOCK_CLASSES as ClassSession[])
        .filter((c) => c.student_id === sid)
        .map((c) => c.session_id);

      // Past attended class preserved
      expect(remainingIds).toContain(`${sid}_past_attended`);
      // Future class with notes preserved
      expect(remainingIds).toContain(`${sid}_future_notes`);
      // Future untouched class removed
      expect(remainingIds).not.toContain(`${sid}_future_untouched`);
    });

    it('sessionProgressMap does not double count and does not show negative remaining for yearly plan', () => {
      const sid = 'STU_REHAAN_PROGRESS';
      const yearlyPkg: Package = {
        package_id: 'pkg_rehaan',
        student_id: sid,
        package_name: 'Yearly Plan',
        plan_type: 'Yearly',
        start_date: '2026-04-06',
        end_date: '2027-02-28',
        package_price: 100000,
        classes_purchased: 188,
        total_classes: 188,
        class_schedule: 'Mon - 18:30, Tue - 18:30, Wed - 18:30, Fri - 18:30',
        status: 'ACTIVE',
      };

      const sessions: ClassSession[] = [];
      // 135 attended past sessions with distinct chronological dates
      const baseDate = new Date('2026-04-06T12:00:00Z');
      for (let i = 0; i < 135; i++) {
        const d = new Date(baseDate.getTime() + i * 86400000);
        const ymd = d.toISOString().slice(0, 10);
        sessions.push({
          session_id: `sess_att_${i}`,
          student_id: sid,
          schedule_date: ymd,
          schedule_time: '18:30',
          start_time: '18:30',
          duration_minutes: 60,
          status: 'COMPLETED',
          session_status: 'COMPLETED',
          attendance_status: 'PRESENT',
          deduct_class: true,
        });
      }

      // 53 future scheduled sessions
      const futureBaseDate = new Date('2026-11-27T12:00:00Z');
      for (let i = 0; i < 53; i++) {
        const d = new Date(futureBaseDate.getTime() + i * 86400000);
        const ymd = d.toISOString().slice(0, 10);
        sessions.push({
          session_id: `sess_sched_${i}`,
          student_id: sid,
          schedule_date: ymd,
          schedule_time: '18:30',
          start_time: '18:30',
          duration_minutes: 60,
          status: 'SCHEDULED',
          session_status: 'SCHEDULED',
          attendance_status: 'NOT_MARKED',
          deduct_class: false,
        });
      }

      const map = buildSessionProgressMap(sessions, [yearlyPkg]);
      const lastAttendedProgress = map.get('sess_att_134');

      expect(lastAttendedProgress).toBeDefined();
      expect(lastAttendedProgress?.totalClasses).toBe(188);
      expect(lastAttendedProgress?.sessionNumber).toBe(135);
      expect(lastAttendedProgress?.remainingAfterSession).toBe(53);
      expect(lastAttendedProgress?.remainingDisplay).toBe('53 remaining');
    });
  });
});
