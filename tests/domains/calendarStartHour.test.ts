import { describe, it, expect } from 'vitest';
import {
  DEFAULT_START_HOUR,
  computeEffectiveStartHour,
  getCalendarHours,
} from '../../src/domains/calendar/WeeklyTimeGrid';

describe('Fix L5: Calendar 9 AM start hour', () => {
  it('defaults to 9 AM when there are no events', () => {
    expect(DEFAULT_START_HOUR).toBe(9);
    expect(computeEffectiveStartHour([])).toBe(9);
  });

  it('keeps 9 AM start hour when all events are after 9 AM (e.g. 11 AM, 6:30 PM)', () => {
    const columns = [
      { events: [{ startHour: 11 }, { startHour: 18 }] },
      { events: [{ startHour: 9 }, { startHour: 20 }] },
    ];
    expect(computeEffectiveStartHour(columns)).toBe(9);
  });

  it('starts at earliest class minus one hour when a visible day has a class before 9 AM', () => {
    // Earliest class is 8 AM -> start at 8 - 1 = 7 AM
    const cols1 = [{ events: [{ startHour: 8 }, { startHour: 15 }] }];
    expect(computeEffectiveStartHour(cols1)).toBe(7);

    // Earliest class is 6 AM -> start at 6 - 1 = 5 AM
    const cols2 = [{ events: [{ startHour: 6 }, { startHour: 10 }] }];
    expect(computeEffectiveStartHour(cols2)).toBe(5);
  });

  it('clamps at 0 (midnight) if a class is at 1 AM or midnight', () => {
    const cols = [{ events: [{ startHour: 1 }, { startHour: 0 }] }];
    expect(computeEffectiveStartHour(cols)).toBe(0);
  });

  it('generates hour slots starting from the effective start hour up to 22:00', () => {
    const hours9 = getCalendarHours(9);
    expect(hours9[0]).toBe('09:00');
    expect(hours9[hours9.length - 1]).toBe('22:00');
    expect(hours9).toHaveLength(14); // 9, 10, ..., 22

    const hours7 = getCalendarHours(7);
    expect(hours7[0]).toBe('07:00');
    expect(hours7[hours7.length - 1]).toBe('22:00');
  });
});
