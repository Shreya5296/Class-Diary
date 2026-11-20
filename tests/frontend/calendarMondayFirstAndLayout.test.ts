import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { getMondayForDateStr, getWeekDates } from '../../src/domains/dashboard/calendarEventGenerator';
import { getMonthGridDates } from '../../src/domains/calendar/calendarDateUtils';
import { CalendarControlsBar } from '../../src/domains/calendar/CalendarControlsBar';
import { DayCalendarView } from '../../src/domains/calendar/DayCalendarView';
import { CalendarEventItem } from '../../src/domains/calendar/calendarTypes';
import { notifyProfileImageChanged, PROFILE_IMAGE_EVENT } from '../../src/domains/dashboard/profileImageStorage';

describe('Calendar Page Refinement — Monday-First, Layout & Profile Sync', () => {
  it('1. calculates Monday as the first day of the week across Day, Week, and Month modes', () => {
    // 2026-11-20 is Friday
    const monday = getMondayForDateStr('2026-11-20');
    expect(monday).toBe('2026-11-16');

    // 2026-11-22 is Sunday -> preceding Monday
    const sundayMon = getMondayForDateStr('2026-11-22');
    expect(sundayMon).toBe('2026-11-16');

    // Week dates: Monday (index 0) to Sunday (index 6)
    const week = getWeekDates(monday);
    expect(week).toHaveLength(7);
    expect(week[0]).toBe('2026-11-16'); // Monday
    expect(week[6]).toBe('2026-11-22'); // Sunday

    // Month grid: First column is Monday
    const monthGrid = getMonthGridDates(2026, 11);
    const firstCellDay = new Date(monthGrid[0]).getUTCDay();
    expect(firstCellDay).toBe(1); // 1 = Monday
  });

  it('2. CalendarControlsBar does not render the dated/recurring session legend', () => {
    const html = renderToString(
      React.createElement(CalendarControlsBar, {
        viewMode: 'week',
        onChangeViewMode: () => {},
        titleText: '16 – 22 Nov 2026',
        countLabel: '4 class slots',
        onPrev: () => {},
        onNext: () => {},
        onToday: () => {},
        onRefresh: () => {},
      })
    );

    expect(html).toContain('16 – 22 Nov 2026');
    expect(html).toContain('4 class slots');
    expect(html).not.toContain('Dated Session');
    expect(html).not.toContain('Recurring Slot');
  });

  it('3. DayCalendarView actions are standardized in height and styling', () => {
    const mockEvents: CalendarEventItem[] = [
      {
        id: 'evt_1',
        studentId: 'stu_1',
        studentName: 'Aarav Sharma',
        topic: 'Math',
        subject: 'Math',
        startIso: '2026-11-20T17:00:00+05:30',
        endIso: '2026-11-20T18:00:00+05:30',
        startTime12: '5:00 PM',
        endTime12: '6:00 PM',
        timeRange12: '5:00 PM – 6:00 PM',
        durationMinutes: 60,
        startHour: 17,
        startMinute: 0,
        dateKey: '2026-11-20',
        isRecurring: false,
        status: 'SCHEDULED',
        category: 'FUTURE_SCHEDULED',
        isPast: false,
        isCancelled: false,
        canJoin: true,
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
      },
    ];

    const html = renderToString(
      React.createElement(DayCalendarView, {
        selectedDateStr: '2026-11-20',
        events: mockEvents,
        isToday: true,
      })
    );

    // Both Upcoming and Join Class rendered
    expect(html).toContain('Upcoming');
    expect(html).toContain('Join Class ↗');
    // Standardized 32px height and font-size: var(--font-size-xs)
    expect(html).toContain('height:32px');
    expect(html).toContain('border-radius:var(--radius-md)');
  });

  it('4. profile image update event dispatches to synchronize sidebar and dashboard', () => {
    let capturedImage: string | null = null;
    const listeners: Record<string, ((e: any) => void)[]> = {};

    (globalThis as any).window = {
      addEventListener: (evt: string, fn: any) => {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(fn);
      },
      removeEventListener: (evt: string, fn: any) => {
        listeners[evt] = (listeners[evt] || []).filter((f) => f !== fn);
      },
      dispatchEvent: (e: any) => {
        (listeners[e.type] || []).forEach((fn) => fn(e));
        return true;
      },
    };
    (globalThis as any).CustomEvent = class {
      type: string;
      detail: any;
      constructor(type: string, opts?: any) {
        this.type = type;
        this.detail = opts?.detail;
      }
    };

    const listener = (e: any) => {
      capturedImage = e.detail;
    };

    (globalThis as any).window.addEventListener(PROFILE_IMAGE_EVENT, listener);
    notifyProfileImageChanged('data:image/png;base64,mockImageData123');

    expect(capturedImage).toBe('data:image/png;base64,mockImageData123');

    notifyProfileImageChanged(null);
    expect(capturedImage).toBeNull();

    (globalThis as any).window.removeEventListener(PROFILE_IMAGE_EVENT, listener);
    delete (globalThis as any).window;
  });
});
