import { describe, it, expect } from 'vitest';
import {
  buildRecurringSuppressionMap,
  getScheduledExtraClassCount,
} from '../../src/domains/calendar/extraClassAccounting';
import { generateCalendarEvents } from '../../src/domains/dashboard/calendarEventGenerator';
import { ClassSession } from '../../src/domains/classes/classTypes';
import {
  mockStudent1,
  mockPackage1,
  recurringAlice,
  pastSessionsAlice,
} from './extraClassTestFixtures';

describe('Frontend Extra-Class Occurrence Suppression (Tests 7–10)', () => {
  it('Test 7 — Different weekday: normal recurring Monday 5 PM; extra class Tuesday 5 PM', () => {
    const tuesdayExtra: ClassSession = {
      session_id: 'tues_extra', student_id: 'stu_alice', schedule_date: '2026-11-24', start_time: '17:00', duration_minutes: 60,
      status: 'SCHEDULED', session_status: 'SCHEDULED', attendance_status: 'NOT_MARKED', deduct_class: false,
    };

    const suppressionMap = buildRecurringSuppressionMap({
      packages: [mockPackage1], recurringSchedules: [recurringAlice],
      datedSessions: [...pastSessionsAlice, tuesdayExtra], todayStr: '2026-11-24',
    });
    expect(suppressionMap.get('stu_alice')).toBe('2026-12-28');

    const events = generateCalendarEvents({
      datedSessions: [...pastSessionsAlice, tuesdayExtra], recurringSchedules: [recurringAlice],
      students: [mockStudent1], packages: [mockPackage1],
      weekDates: ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'],
      activeTz: 'Asia/Kolkata',
    });

    const tuesday = events.filter((e) => (e.schedule_date || '').startsWith('2026-11-24'));
    expect(tuesday).toHaveLength(1);
    expect(tuesday[0].session_id).toBe('tues_extra');
  });

  it('Test 8 — Same weekday, different time: normal recurring Monday 5 PM; extra class Monday 10 AM (both appear)', () => {
    const mondayMorningExtra: ClassSession = {
      session_id: 'mon_10am_extra', student_id: 'stu_alice', schedule_date: '2026-11-23', start_time: '10:00', duration_minutes: 60,
      status: 'SCHEDULED', session_status: 'SCHEDULED', attendance_status: 'NOT_MARKED', deduct_class: false,
    };

    const pastSessions3 = pastSessionsAlice.slice(0, 3);
    const suppressionMap = buildRecurringSuppressionMap({
      packages: [mockPackage1], recurringSchedules: [recurringAlice],
      datedSessions: [...pastSessions3, mondayMorningExtra], todayStr: '2026-11-23',
    });
    expect(suppressionMap.get('stu_alice')).toBe('2026-12-28');

    const eventsNov23Week = generateCalendarEvents({
      datedSessions: [...pastSessions3, mondayMorningExtra], recurringSchedules: [recurringAlice],
      students: [mockStudent1], packages: [mockPackage1],
      weekDates: ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'],
      activeTz: 'Asia/Kolkata',
    });

    const mondayEvents = eventsNov23Week.filter((e) => (e.schedule_date || (e.scheduled_start ? e.scheduled_start.slice(0, 10) : '')).startsWith('2026-11-23') && e.student_id === 'stu_alice');
    expect(mondayEvents).toHaveLength(2);
    expect(mondayEvents.some((e) => (e.start_time || '').includes('10:00'))).toBe(true);
    expect(mondayEvents.some((e) => (e.start_time || '').includes('17:00'))).toBe(true);
  });

  it('Test 9 — Same weekday, same time: replaces exact occurrence without duplicating or shifting horizon', () => {
    const mondaySameTime: ClassSession = {
      session_id: 'mon_5pm_dated', student_id: 'stu_alice', schedule_date: '2026-11-23', start_time: '17:00', duration_minutes: 60,
      status: 'SCHEDULED', session_status: 'SCHEDULED', attendance_status: 'NOT_MARKED', deduct_class: false,
    };

    const pastSessions3 = pastSessionsAlice.slice(0, 3);
    const events = generateCalendarEvents({
      datedSessions: [...pastSessions3, mondaySameTime], recurringSchedules: [recurringAlice],
      students: [mockStudent1], packages: [mockPackage1],
      weekDates: ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'],
      activeTz: 'Asia/Kolkata',
    });

    const mondayEvents = events.filter((e) => (e.schedule_date || '').startsWith('2026-11-23') && e.student_id === 'stu_alice');
    expect(mondayEvents).toHaveLength(1);
    expect(mondayEvents[0].session_id).toBe('mon_5pm_dated');
  });

  it('Test 10 — Multiple extra classes: independent occurrence replacement', () => {
    const extra1: ClassSession = { session_id: 'ex1', student_id: 'stu_alice', schedule_date: '2026-11-24', start_time: '15:00', duration_minutes: 60, status: 'SCHEDULED', session_status: 'SCHEDULED', attendance_status: 'NOT_MARKED', deduct_class: false };
    const extra2: ClassSession = { session_id: 'ex2', student_id: 'stu_alice', schedule_date: '2026-11-26', start_time: '15:00', duration_minutes: 60, status: 'SCHEDULED', session_status: 'SCHEDULED', attendance_status: 'NOT_MARKED', deduct_class: false };

    expect(getScheduledExtraClassCount('stu_alice', [...pastSessionsAlice, extra1, extra2], '2026-11-24')).toBe(2);

    const suppressionMap = buildRecurringSuppressionMap({
      packages: [mockPackage1], recurringSchedules: [recurringAlice],
      datedSessions: [...pastSessionsAlice, extra1, extra2], todayStr: '2026-11-24',
    });
    expect(suppressionMap.get('stu_alice')).toBe('2026-12-21');
  });
});
