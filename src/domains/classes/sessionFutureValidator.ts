import { ClassSession } from './classTypes';
import { getSessionDate, getSessionStartTime } from './sessionTimeNormalizer';
import { localToUtcIso } from './classGenerator';

export function getSessionStartTimestamp(
  session?: Partial<ClassSession> | null,
  activeTz = 'Asia/Kolkata'
): number | null {
  if (!session) return null;
  const rawStart = session.scheduled_start;
  if (rawStart) {
    const s = String(rawStart).trim();
    if (!s.startsWith('1899') && (s.includes('Z') || /[+-]\d{2}:\d{2}$/.test(s))) {
      const ms = new Date(s).getTime();
      if (!isNaN(ms)) return ms;
    }
  }
  const dateStr = getSessionDate(session, activeTz);
  const timeStr = getSessionStartTime(session, activeTz) || '00:00';
  if (!dateStr) {
    const rawTime = session.start_time;
    if (rawTime) {
      const s = String(rawTime).trim();
      if (!s.startsWith('1899') && (s.includes('Z') || /[+-]\d{2}:\d{2}$/.test(s))) {
        const ms = new Date(s).getTime();
        if (!isNaN(ms)) return ms;
      }
    }
    return null;
  }
  try {
    const iso = localToUtcIso(dateStr, timeStr, activeTz);
    const ms = new Date(iso).getTime();
    return isNaN(ms) ? null : ms;
  } catch {
    return null;
  }
}

export function isFutureSession(
  session?: Partial<ClassSession> | null,
  referenceTime: Date | number = Date.now(),
  activeTz = 'Asia/Kolkata'
): boolean {
  const startMs = getSessionStartTimestamp(session, activeTz);
  if (startMs === null) return false;
  const nowMs = typeof referenceTime === 'number' ? referenceTime : referenceTime.getTime();
  return startMs > nowMs;
}
