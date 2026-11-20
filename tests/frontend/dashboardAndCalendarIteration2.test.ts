import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TodayClassesSection } from '../../src/domains/dashboard/TodayClassesSection';
import { InlineAttendanceAlertRow } from '../../src/domains/dashboard/InlineAttendanceAlertRow';
import { DashboardMiniCalendar } from '../../src/domains/dashboard/DashboardMiniCalendar';
import { WeeklyTimeGrid, getCalendarHours, DEFAULT_START_HOUR } from '../../src/domains/calendar/WeeklyTimeGrid';
import { DayCalendarView } from '../../src/domains/calendar/DayCalendarView';
import { ClassSession } from '../../src/domains/classes/classTypes';
import { AttentionAlert } from '../../src/domains/dashboard/attentionAlertTypes';
import { DayColumnData } from '../../src/domains/calendar/calendarTypes';

vi.mock('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { email: 'admin@infineo.io', name: 'Shreya Admin' }, token: 'tk_123', signOut: vi.fn() }),
}));

describe('Iteration 2 — Dashboard Class Schedule & Mini Calendar', () => {
  const mockClasses: ClassSession[] = [
    { session_id: 'c1', student_id: 's1', student_name: 'Aarav Sharma', schedule_date: '2026-11-20', schedule_time: '10:00', status: 'SCHEDULED' },
    { session_id: 'c2', student_id: 's2', student_name: 'Diya Patel', schedule_date: '2026-11-20', schedule_time: '14:00', status: 'SCHEDULED' },
  ];

  it('renders Class Schedule without previous/next day arrows and without Other Classes heading', () => {
    const html = renderToString(
      React.createElement(TodayClassesSection, { classes: mockClasses, selectedDateKey: '2026-11-20' })
    );
    expect(html).not.toContain('aria-label="Previous day"');
    expect(html).not.toContain('aria-label="Next day"');
    expect(html).not.toContain('Other Classes Scheduled for');
    expect(html).toContain('Aarav Sharma');
    expect(html).toContain('Diya Patel');
  });

  it('renders Mini Calendar with content-driven height and no blue-dot explanatory legend', () => {
    const html = renderToString(
      React.createElement(DashboardMiniCalendar, { classes: mockClasses, selectedDateKey: '2026-11-20', onSelectDateKey: vi.fn() })
    );
    expect(html).toContain('Schedule Calendar');
    expect(html).not.toContain('Scheduled class');
    expect(html).not.toContain('Schedule class with blue dot');
  });
});

describe('Iteration 2 — Attendance Mandatory Notes & Control Labels', () => {
  const alert: AttentionAlert = {
    id: 'alert_att_c1', studentId: 's1', studentName: 'Aarav Sharma', classDate: '2026-11-18',
    formattedClassDate: 'Wednesday, 18 November 2026', reason: 'Attendance not marked',
    severity: 'warning', actionLabel: 'Mark Attendance', targetSection: 'classes', category: 'attendance', urgency: 'pending',
  };

  it('renders expanded controls without Select attendance status text and with notes input', () => {
    const html = renderToString(React.createElement(InlineAttendanceAlertRow, { alert, isExpanded: true, onToggle: vi.fn() }));
    expect(html).not.toContain('Select attendance status:');
    expect(html).toContain('placeholder="Enter attendance notes..."');
    expect(html).toContain('Present');
    expect(html).toContain('Absent');
    expect(html).toContain('Rescheduled');
  });
});

describe('Iteration 2 — Calendar Page 9 AM Start Time & Recurring Badges', () => {
  it('defaults to 9:00 AM visible day start time in calendar hours', () => {
    expect(DEFAULT_START_HOUR).toBe(9);
    const hours = getCalendarHours(9);
    expect(hours[0]).toBe('09:00');
    expect(hours).not.toContain('07:00');
    expect(hours).not.toContain('08:00');
  });

  it('preserves access to earlier sessions scheduled before 9 AM without discarding them', () => {
    const earlyCol: DayColumnData = {
      dateKey: '2026-11-20', dayName: 'Fri', dayNumber: '20', isToday: true,
      events: [{
        id: 'e_early', studentId: 's1', studentName: 'Early Bird', topic: 'Math', subject: 'Math',
        startIso: '2026-11-20T08:00:00Z', endIso: '2026-11-20T09:00:00Z', startTime12: '8:00 AM', endTime12: '9:00 AM',
        timeRange12: '8:00 AM – 9:00 AM', durationMinutes: 60, startHour: 8, startMinute: 0, dateKey: '2026-11-20',
        isRecurring: false, status: 'SCHEDULED', category: 'UPCOMING_DATED', isPast: false, isCancelled: false, canJoin: false,
      }],
    };
    const html = renderToString(React.createElement(WeeklyTimeGrid, { dayColumns: [earlyCol] }));
    expect(html).toContain('8:00 AM');
    expect(html).toContain('Early Bird');
  });

  it('removes repetitive Recurring badges from individual event cards in Day view', () => {
    const dayEvt = {
      id: 'e_rec', studentId: 's1', studentName: 'Regular Student', topic: 'Math', subject: 'Algebra',
      startIso: '2026-11-20T10:00:00Z', endIso: '2026-11-20T11:00:00Z', startTime12: '10:00 AM', endTime12: '11:00 AM',
      timeRange12: '10:00 AM – 11:00 AM', durationMinutes: 60, startHour: 10, startMinute: 0, dateKey: '2026-11-20',
      isRecurring: true, status: 'RECURRING', category: 'UPCOMING_RECURRING' as const, isPast: false, isCancelled: false, canJoin: false,
    };
    const html = renderToString(React.createElement(DayCalendarView, { selectedDateStr: '2026-11-20', events: [dayEvt], isToday: true }));
    expect(html).toContain('Regular Student');
    expect(html).not.toContain('>Recurring</span>');
  });
});
