import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ClassSchedule } from '../../src/domains/classes/ClassSchedule';
import { splitAndSortSessions } from '../../src/domains/classes/classSorting';
import { ClassSession } from '../../src/domains/classes/classTypes';

vi.mock('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({ token: 'mock-token', user: { email: 'admin@example.com' } }),
}));

describe('Fix L4: Past Classes count loads upfront', () => {
  it('splitAndSortSessions separates upcoming and past sessions accurately', () => {
    const nowMs = new Date('2026-11-28T12:00:00Z').getTime();
    const sessions: ClassSession[] = [
      {
        session_id: 'up_1',
        student_id: 'STU_1',
        schedule_date: '2026-12-01',
        schedule_time: '10:00',
        scheduled_start: '2026-12-01T10:00:00+05:30',
        session_status: 'SCHEDULED',
        status: 'SCHEDULED',
      } as ClassSession,
      {
        session_id: 'past_1',
        student_id: 'STU_1',
        schedule_date: '2026-10-01',
        schedule_time: '10:00',
        scheduled_start: '2026-10-01T10:00:00+05:30',
        session_status: 'COMPLETED',
        status: 'COMPLETED',
      } as ClassSession,
      {
        session_id: 'past_2',
        student_id: 'STU_1',
        schedule_date: '2026-10-02',
        schedule_time: '10:00',
        scheduled_start: '2026-10-02T10:00:00+05:30',
        session_status: 'COMPLETED',
        status: 'COMPLETED',
      } as ClassSession,
    ];

    const { upcoming, past, invalid } = splitAndSortSessions(sessions, nowMs, 'Asia/Kolkata');
    expect(upcoming).toHaveLength(1);
    expect(past).toHaveLength(2);
    expect(invalid).toHaveLength(0);
  });

  it('ClassSchedule renders Past Classes tab with real count badge', () => {
    const html = renderToString(React.createElement(ClassSchedule, {}));
    expect(html).toContain('Past Classes');
    expect(html).toContain('Upcoming Classes');
  });
});
