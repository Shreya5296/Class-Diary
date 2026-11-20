import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DashboardMiniCalendar } from '../../src/domains/dashboard/DashboardMiniCalendar';
import { ClassSession } from '../../src/domains/classes/classTypes';

describe('DashboardMiniCalendar — Monthly Schedule Calendar', () => {
  const mockClasses: ClassSession[] = [
    {
      session_id: 'sess_1',
      student_id: 'STU_1',
      student_name: 'Aarav Sharma',
      schedule_date: '2026-11-15',
      schedule_time: '10:00',
      status: 'SCHEDULED',
    },
    {
      session_id: 'sess_2',
      student_id: 'STU_2',
      student_name: 'Diya Patel',
      schedule_date: '2026-11-20',
      schedule_time: '14:00',
      status: 'SCHEDULED',
    },
  ];

  it('renders calendar title, month header, and weekdays', () => {
    const html = renderToString(
      React.createElement(DashboardMiniCalendar, {
        classes: mockClasses,
        selectedDateKey: '2026-11-20',
        onSelectDateKey: vi.fn(),
      })
    );

    expect(html).toContain('Schedule Calendar');
    expect(html).toContain('November 2026');
    expect(html).toContain('Su');
    expect(html).toContain('Mo');
    expect(html).toContain('Fr');
    expect(html).toContain('Sa');
    expect(html).not.toContain('Scheduled class');
  });

  it('identifies scheduled class dates with aria-label annotations and indicators', () => {
    const html = renderToString(
      React.createElement(DashboardMiniCalendar, {
        classes: mockClasses,
        selectedDateKey: '2026-11-20',
        onSelectDateKey: vi.fn(),
      })
    );

    expect(html).toContain('November 15, 2026 (Classes scheduled)');
    expect(html).toContain('November 20, 2026 (Classes scheduled)');
    expect(html).toContain('November 21, 2026');
    expect(html).not.toContain('November 21, 2026 (Classes scheduled)');
  });

  it('marks the selected date with aria-pressed="true"', () => {
    const html = renderToString(
      React.createElement(DashboardMiniCalendar, {
        classes: mockClasses,
        selectedDateKey: '2026-11-20',
        onSelectDateKey: vi.fn(),
      })
    );

    // Selected date should have aria-pressed="true"
    expect(html).toContain('aria-pressed="true"');
  });
});
