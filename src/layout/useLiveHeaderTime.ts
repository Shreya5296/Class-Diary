import { useState, useEffect } from 'react';
import { getSavedTimezone } from '../lib/userPreferences';

export interface HeaderTimeInfo {
  dateStr: string;
  timeStr: string;
  tzAbbr?: string;
}

function getTzAbbreviation(timeZone: string, date: Date): string {
  if (timeZone === 'Asia/Kolkata') return 'IST';
  if (timeZone === 'UTC') return 'UTC';
  try {
    const parts = new Intl.DateTimeFormat('en-IN', {
      timeZone,
      timeZoneName: 'short',
    }).formatToParts(date);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart ? tzPart.value : 'IST';
  } catch {
    return 'IST';
  }
}

export function useLiveHeaderTime(): HeaderTimeInfo {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeZone = getSavedTimezone() || 'Asia/Kolkata';

  let dateStr = '';
  let timeStr = '';

  try {
    dateStr = new Intl.DateTimeFormat('en-IN', {
      timeZone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(now);

    timeStr = new Intl.DateTimeFormat('en-IN', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(now);
  } catch {
    dateStr = now.toLocaleDateString();
    timeStr = now.toLocaleTimeString();
  }

  const tzAbbr = getTzAbbreviation(timeZone, now);

  return { dateStr, timeStr, tzAbbr };
}
