import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { classifyCalendarEvent } from '../../src/domains/calendar/calendarClassification';
import { DayCalendarView } from '../../src/domains/calendar/DayCalendarView';
import { HOUR_ROW_HEIGHT, DEFAULT_START_HOUR } from '../../src/domains/calendar/WeeklyTimeGrid';
import { getMondayForDateStr, getWeekDates } from '../../src/domains/dashboard/calendarEventGenerator';
import { getMonthGridDates } from '../../src/domains/calendar/calendarDateUtils';
import { formatScheduleLines } from '../../src/domains/students/scheduleFormatter';
import { MeetingLinkButton } from '../../src/domains/meeting-links/MeetingLinkButton';
import { CalendarEventItem } from '../../src/domains/calendar/calendarTypes';

describe('Correction Pass UI Regression Suite', () => {
  it('1. verifies all four attendance colour states accurately', () => {
    // Upcoming -> UPCOMING (Blue)
    const upcoming = classifyCalendarEvent({ isPast: false, status: 'SCHEDULED' });
    expect(upcoming).toBe('UPCOMING');

    // Past marked PRESENT -> PAST_COMPLETED (Green)
    const attended = classifyCalendarEvent({ isPast: true, attendanceStatus: 'PRESENT' });
    expect(attended).toBe('PAST_COMPLETED');

    // Past marked ABSENT / NO_SHOW -> CANCELLED (Red)
    const absent = classifyCalendarEvent({ isPast: true, attendanceStatus: 'ABSENT' });
    expect(absent).toBe('CANCELLED');
    const noShow = classifyCalendarEvent({ isPast: true, attendanceStatus: 'NO_SHOW' });
    expect(noShow).toBe('CANCELLED');

    // Past with NO attendance recorded -> PAST_UNATTENDED (Yellow)
    const unrecorded = classifyCalendarEvent({ isPast: true, status: 'SCHEDULED', attendanceStatus: '' });
    expect(unrecorded).toBe('PAST_UNATTENDED');
  });

  it('2. verifies DayCalendarView renders 4 distinct attendance visual treatments and dashed/solid border', () => {
    const mockEvents: CalendarEventItem[] = [
      {
        id: 'evt_upcoming', studentId: 'stu_1', studentName: 'Alice', subject: 'Math',
        category: 'UPCOMING', isRecurring: true, isPast: false, startTime12: '10:00 AM',
        endTime12: '11:00 AM', durationMinutes: 60, startHour: 10, startMinute: 0,
      },
      {
        id: 'evt_present', studentId: 'stu_2', studentName: 'Bob', subject: 'Physics',
        category: 'PAST_COMPLETED', isRecurring: false, isPast: true, startTime12: '11:00 AM',
        endTime12: '12:00 PM', durationMinutes: 60, startHour: 11, startMinute: 0,
      },
      {
        id: 'evt_absent', studentId: 'stu_3', studentName: 'Charlie', subject: 'Chemistry',
        category: 'CANCELLED', isRecurring: false, isPast: true, startTime12: '2:00 PM',
        endTime12: '3:00 PM', durationMinutes: 60, startHour: 14, startMinute: 0,
      },
      {
        id: 'evt_unattended', studentId: 'stu_4', studentName: 'Diana', subject: 'Biology',
        category: 'PAST_UNATTENDED', isRecurring: true, isPast: true, startTime12: '4:00 PM',
        endTime12: '5:00 PM', durationMinutes: 60, startHour: 16, startMinute: 0,
      },
    ];

    const html = renderToString(React.createElement(DayCalendarView, {
      selectedDateStr: '2026-11-20', events: mockEvents, isToday: false,
    }));

    // Upcoming: blue styling & Upcoming badge & dashed border
    expect(html).toContain('Upcoming');
    expect(html).toContain('dashed rgba(191, 219, 254');

    // Present: green styling & Present badge & solid border
    expect(html).toContain('Present');
    expect(html).toContain('solid rgba(167, 243, 208');

    // Cancelled / Absent: red styling & solid border
    expect(html).toContain('solid rgba(254, 202, 202');

    // Unrecorded: yellow styling & Unrecorded badge & dashed border
    expect(html).toContain('Unrecorded');
    expect(html).toContain('dashed rgba(253, 230, 138');
  });

  it('3. verifies Monday-first calendar layout across utility functions', () => {
    const monday = getMondayForDateStr('2026-11-21'); // Saturday Nov 21
    expect(monday).toBe('2026-11-16'); // Preceding Monday

    const weekDates = getWeekDates(monday);
    expect(weekDates[0]).toBe('2026-11-16'); // Monday
    expect(weekDates[6]).toBe('2026-11-22'); // Sunday

    const monthGrid = getMonthGridDates(2026, 11);
    const firstCellDay = new Date(monthGrid[0]).getUTCDay();
    expect(firstCellDay).toBe(1); // Monday is column index 0
  });

  it('4. verifies Calendar sizing preserves comfortable 56px slot height and 9 AM start', () => {
    expect(HOUR_ROW_HEIGHT).toBe(56);
    expect(DEFAULT_START_HOUR).toBe(9);
  });

  it('5. verifies multi-line student schedule formatting', () => {
    const entries = [
      { day_of_week: 'SATURDAY', start_time: '10:00', end_time: '10:30', is_active: true },
      { day_of_week: 'SUNDAY', start_time: '10:00', end_time: '10:30', is_active: true },
    ];
    const lines = formatScheduleLines(entries);
    expect(lines).toEqual([
      'Sat - 10:00 - 10:30 AM',
      'Sun - 10:00 - 10:30 AM',
    ]);

    // Cross AM/PM boundary
    const crossPeriod = [
      { day_of_week: 'MONDAY', start_time: '11:30', end_time: '12:30', is_active: true },
    ];
    expect(formatScheduleLines(crossPeriod)).toEqual([
      'Mon - 11:30 AM - 12:30 PM',
    ]);
  });

  it('6. verifies complete primary meeting link visibility and non-truncation', () => {
    const fullUrl = 'https://meet.google.com/abc-defg-hij';
    const html = renderToString(React.createElement(MeetingLinkButton, { url: fullUrl }));

    // Must display full URL
    expect(html).toContain(fullUrl);
    // Must contain wrapping styles
    expect(html).toContain('word-break:break-all');
    expect(html).toContain('overflow-wrap:anywhere');
    // Must contain Open ↗ action and Copy action
    expect(html).toContain('Open ↗');
    expect(html).toContain('Copy');
  });
});
