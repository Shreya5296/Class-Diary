import { describe, it, expect } from 'vitest';
import { splitAndSortSessions, getSessionScheduledTimestamp } from '../../src/domains/classes/classSorting';
import { ClassSession } from '../../src/domains/classes/classTypes';

describe('classSorting', () => {
  const baseSession = (id: string, date: string, time: string): ClassSession => ({
    session_id: id,
    student_id: `stu_${id}`,
    schedule_date: date,
    schedule_time: time,
    start_time: time,
    duration_minutes: 60,
    status: 'SCHEDULED',
  });

  it('correctly extracts timestamps for valid dates and times', () => {
    const s = baseSession('1', '2026-11-20', '14:30');
    const ts = getSessionScheduledTimestamp(s, 'Asia/Kolkata');
    expect(ts).toBeTypeOf('number');
    expect(ts).not.toBeNull();
  });

  it('returns null for missing or invalid dates', () => {
    expect(getSessionScheduledTimestamp({ schedule_date: '' })).toBeNull();
    expect(getSessionScheduledTimestamp({ schedule_date: 'invalid-date' })).toBeNull();
    expect(getSessionScheduledTimestamp({})).toBeNull();
  });

  it('splits sessions into upcoming and past based on scheduled date/time and sorts correctly', () => {
    // Current simulated time: 2026-11-20 12:00:00 IST
    const nowMs = new Date('2026-11-20T12:00:00+05:30').getTime();

    const sPast1 = baseSession('p1', '2026-11-19', '10:00'); // yesterday
    const sPast2 = baseSession('p2', '2026-11-17', '15:00'); // 3 days ago
    const sPast3 = baseSession('p3', '2026-11-14', '11:00'); // 6 days ago
    const sPastToday = baseSession('p4', '2026-11-20', '09:00'); // earlier today

    const sUpcomingToday = baseSession('u1', '2026-11-20', '15:00'); // later today
    const sUpcomingTomorrow = baseSession('u2', '2026-11-21', '10:00'); // tomorrow
    const sUpcomingNextWeek = baseSession('u3', '2026-11-25', '16:00'); // next week
    const sUpcomingLaterNextWeek = baseSession('u4', '2026-11-28', '11:00');

    const sInvalid = { session_id: 'inv', student_id: 'inv', status: 'SCHEDULED' } as ClassSession;

    const allSessions = [
      sUpcomingLaterNextWeek,
      sPast3,
      sUpcomingTomorrow,
      sPastToday,
      sInvalid,
      sUpcomingToday,
      sPast1,
      sUpcomingNextWeek,
      sPast2,
    ];

    const result = splitAndSortSessions(allSessions, nowMs, 'Asia/Kolkata');

    // Upcoming should be nearest to latest (ascending chronological)
    expect(result.upcoming.map((s) => s.session_id)).toEqual(['u1', 'u2', 'u3', 'u4']);

    // Past should be most recent to oldest (descending chronological) with invalid sessions grouped safely at bottom
    expect(result.past.map((s) => s.session_id)).toEqual(['p4', 'p1', 'p2', 'p3', 'inv']);

    // Invalid session placed safely into invalid
    expect(result.invalid.map((s) => s.session_id)).toEqual(['inv']);
  });

  it('sorts multiple sessions on the same date by their actual scheduled time', () => {
    const nowMs = new Date('2026-11-20T00:00:00+05:30').getTime();

    const s1 = baseSession('s1', '2026-11-21', '16:00');
    const s2 = baseSession('s2', '2026-11-21', '10:00');
    const s3 = baseSession('s3', '2026-11-21', '14:30');

    const result = splitAndSortSessions([s1, s2, s3], nowMs, 'Asia/Kolkata');
    expect(result.upcoming.map((s) => s.session_id)).toEqual(['s2', 's3', 's1']);
  });
});
