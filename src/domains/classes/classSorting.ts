import { ClassSession } from './classTypes';
import { getSessionDate, getSessionStartTime } from './sessionTimeNormalizer';

export function getSessionScheduledTimestamp(
  session: Partial<ClassSession>,
  activeTz = 'Asia/Kolkata'
): number | null {
  const dateStr = getSessionDate(session, activeTz);
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const raw = session.scheduled_start || session.start_time;
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d.getTime();
    }
    return null;
  }

  const validDate = dateStr.slice(0, 10);
  const rawTime = getSessionStartTime(session, activeTz) || '00:00';
  let cleanTime = '00:00';
  if (/^\d{1,2}:\d{2}/.test(rawTime)) {
    const timeParts = rawTime.split(':').slice(0, 2);
    const hh = (timeParts[0] || '00').padStart(2, '0');
    const mm = (timeParts[1] || '00').padStart(2, '0');
    cleanTime = `${hh}:${mm}`;
  } else {
    const rawIso = session.scheduled_start || session.start_time;
    if (rawIso && rawIso.includes('T')) {
      const d = new Date(rawIso);
      if (!isNaN(d.getTime())) {
        try {
          const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: activeTz, hour: '2-digit', minute: '2-digit', hour12: false,
          }).format(d).split(':');
          cleanTime = `${parts[0]}:${parts[1]}`;
        } catch {
          cleanTime = '00:00';
        }
      }
    }
  }

  const tzOffset = activeTz === 'Asia/Kolkata' ? '+05:30' : '';
  const isoStr = `${validDate}T${cleanTime}:00${tzOffset}`;
  const d = new Date(isoStr);
  const ts = d.getTime();
  if (!isNaN(ts)) return ts;

  const rawFallback = session.scheduled_start || session.start_time;
  if (rawFallback) {
    const fDate = new Date(rawFallback);
    if (!isNaN(fDate.getTime())) return fDate.getTime();
  }
  return null;
}

export interface SplitSessionsResult {
  upcoming: ClassSession[];
  past: ClassSession[];
  invalid: ClassSession[];
}

export function splitAndSortSessions(
  sessions: ClassSession[],
  nowMs: number = Date.now(),
  activeTz = 'Asia/Kolkata'
): SplitSessionsResult {
  const upcomingWithTs: { session: ClassSession; ts: number }[] = [];
  const pastWithTs: { session: ClassSession; ts: number }[] = [];
  const invalid: ClassSession[] = [];

  for (const s of sessions) {
    const ts = getSessionScheduledTimestamp(s, activeTz);
    if (ts === null) {
      invalid.push(s);
    } else if (ts >= nowMs) {
      upcomingWithTs.push({ session: s, ts });
    } else {
      pastWithTs.push({ session: s, ts });
    }
  }

  // Nearest upcoming class first (ascending chronological order)
  upcomingWithTs.sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    return (a.session.session_id || '').localeCompare(b.session.session_id || '');
  });

  // Most recently scheduled class first (descending chronological order)
  pastWithTs.sort((a, b) => {
    if (a.ts !== b.ts) return b.ts - a.ts;
    return (a.session.session_id || '').localeCompare(b.session.session_id || '');
  });

  return {
    upcoming: upcomingWithTs.map((item) => item.session),
    past: pastWithTs.map((item) => item.session),
    invalid,
  };
}
