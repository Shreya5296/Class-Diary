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

    // Past should be most recent to oldest (descending chronological) - invalid excluded
    expect(result.past.map((s) => s.session_id)).toEqual(['p4', 'p1', 'p2', 'p3']);

    // Invalid session must be excluded from both tabs and reported separately
    expect(result.upcoming.some((s) => s.session_id === 'inv')).toBe(false);
    expect(result.past.some((s) => s.session_id === 'inv')).toBe(false);
    expect(result.invalid.map((s) => s.session_id)).toEqual(['inv']);
  });

  it('excludes invalid, missing, and malformed dates from both tabs and reports count', () => {
    const nowMs = new Date('2026-11-20T12:00:00+05:30').getTime();
    const badSessions: ClassSession[] = [
      { session_id: 'bad1', student_id: 's1', schedule_date: '', status: 'SCHEDULED' } as ClassSession,
      { session_id: 'bad2', student_id: 's2', schedule_date: 'not-a-date', status: 'SCHEDULED' } as ClassSession,
      { session_id: 'bad3', student_id: 's3', status: 'SCHEDULED' } as ClassSession,
      { session_id: 'bad4', student_id: 's4', schedule_date: '2026-99-99', status: 'SCHEDULED' } as ClassSession,
      baseSession('valid_up', '2026-11-21', '10:00'),
      baseSession('valid_past', '2026-11-19', '10:00'),
    ];

    const result = splitAndSortSessions(badSessions, nowMs, 'Asia/Kolkata');
    expect(result.upcoming.map((s) => s.session_id)).toEqual(['valid_up']);
    expect(result.past.map((s) => s.session_id)).toEqual(['valid_past']);
    expect(result.invalid.map((s) => s.session_id)).toEqual(['bad1', 'bad2', 'bad3', 'bad4']);
    expect(result.invalid).toHaveLength(4);
    // Ensure none of the bad sessions leak into upcoming or past
    const allTabIds = [...result.upcoming, ...result.past].map((s) => s.session_id);
    expect(allTabIds).not.toContain('bad1');
    expect(allTabIds).not.toContain('bad2');
    expect(allTabIds).not.toContain('bad3');
    expect(allTabIds).not.toContain('bad4');
  });

  it('sorts multiple sessions on the same date by their actual scheduled time', () => {
    const nowMs = new Date('2026-11-20T00:00:00+05:30').getTime();

    const s1 = baseSession('s1', '2026-11-21', '16:00');
    const s2 = baseSession('s2', '2026-11-21', '10:00');
    const s3 = baseSession('s3', '2026-11-21', '14:30');
    const s4 = baseSession('s4', '2026-11-21', '10:00'); // identical time to test stable tie-breaking

    const result = splitAndSortSessions([s1, s2, s3, s4], nowMs, 'Asia/Kolkata');
    expect(result.upcoming.map((s) => s.session_id)).toEqual(['s2', 's4', 's3', 's1']);

    // In past view, same-day sessions should sort descending (latest time first)
    const pastNow = new Date('2026-11-22T00:00:00+05:30').getTime();
    const pastResult = splitAndSortSessions([s1, s2, s3, s4], pastNow, 'Asia/Kolkata');
    expect(pastResult.past.map((s) => s.session_id)).toEqual(['s1', 's3', 's2', 's4']);
  });

  it('correctly handles timezone boundaries across midnight and UTC offsets', () => {
    // Session on 2026-11-21 at 00:30 IST (+05:30) is 2026-11-20 19:00:00 UTC
    const sessionPostMidnightIST = baseSession('tz1', '2026-11-21', '00:30');

    // If now is 2026-11-20 18:59:00 UTC (00:29 IST), session is upcoming (1 minute away)
    const nowBefore = new Date('2026-11-20T18:59:00.000Z').getTime();
    const resBefore = splitAndSortSessions([sessionPostMidnightIST], nowBefore, 'Asia/Kolkata');
    expect(resBefore.upcoming.map((s) => s.session_id)).toEqual(['tz1']);
    expect(resBefore.past).toHaveLength(0);

    // If now is 2026-11-20 19:01:00 UTC (00:31 IST), session is in past
    const nowAfter = new Date('2026-11-20T19:01:00.000Z').getTime();
    const resAfter = splitAndSortSessions([sessionPostMidnightIST], nowAfter, 'Asia/Kolkata');
    expect(resAfter.past.map((s) => s.session_id)).toEqual(['tz1']);
    expect(resAfter.upcoming).toHaveLength(0);
  });
});
