import { ClassSession } from './classTypes';
import { Column } from '../../components/tables/DataTable';
import { AttendanceControl } from './AttendanceControl';
import { Button } from '../../components/buttons/Button';
import { SessionProgress } from './sessionProgressCalculator';
import { getSessionStatusStyle } from './sessionStatusStyles';
import { getSessionDate, getSessionDuration, formatSessionTimeRange, isSessionOnDate } from './sessionTimeNormalizer';

export function formatClassDate(rawDate?: string): string {
  if (!rawDate) return '—';
  try {
    const clean = String(rawDate).trim();
    const d = clean.length === 10 ? new Date(`${clean}T12:00:00Z`) : new Date(clean.replace(/T\s+(\d:)/, 'T0$1'));
    if (isNaN(d.getTime())) return clean;
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  } catch { return String(rawDate); }
}

export function buildClassScheduleColumns(params: {
  todayKey: string; nowMs: number;
  getStudentConsumedClasses: (id: string) => { consumed: number; purchased: number };
  getStudentMeetingLink: (id: string) => any;
  getProgress?: (session: ClassSession) => SessionProgress | undefined;
  handleUpdateStatus: (sessionId: string, outcome: string, cancellationReason?: string) => Promise<void>;
  handleRestore: (sessionId: string) => Promise<void>;
  onEditNotes?: (session: ClassSession) => void;
}): Column<ClassSession>[] {
  const { todayKey, nowMs, getStudentConsumedClasses, getStudentMeetingLink, getProgress, handleUpdateStatus, handleRestore, onEditNotes } = params;

  return [
    {
      key: 'student', header: 'Student', width: '16%',
      render: (c) => (
        <div>
          <span style={{ fontWeight: 600, color: 'var(--color-text-main)', fontSize: 'var(--font-size-sm)', display: 'block' }}>
            {c.student_name || c.student_id}
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            {c.subject || c.topic || c.class_title || 'Class Session'}
          </span>
        </div>
      ),
    },
    {
      key: 'date', header: 'Weekday & Date', width: '15%',
      render: (c) => (
        <span style={{ fontWeight: 600, color: 'var(--color-text-main)', fontSize: 'var(--font-size-sm)' }}>
          {formatClassDate(c.schedule_date || c.class_date || c.scheduled_start)}
        </span>
      ),
    },
    {
      key: 'start_time', header: 'Class Time', width: '13%',
      render: (c) => (
        <div>
          <span style={{ fontWeight: 600, color: 'var(--color-text-main)', fontSize: 'var(--font-size-sm)', display: 'block' }}>
            {formatSessionTimeRange(c)}
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{getSessionDuration(c)} min</span>
        </div>
      ),
    },
    {
      key: 'consumed', header: 'Consumed / Purchased', width: '13%',
      render: (c) => {
        const prog = getProgress ? getProgress(c) : undefined;
        if (prog) {
          return (
            <div>
              <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>{prog.display}</span>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>{prog.remainingDisplay}</span>
            </div>
          );
        }
        const { consumed, purchased } = getStudentConsumedClasses(c.student_id);
        const rem = Math.max(0, purchased - consumed);
        return (
          <div>
            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)' }}>{consumed} / {purchased || '—'}</span>
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>{purchased ? `${rem} remaining` : 'No package'}</span>
          </div>
        );
      },
    },
    {
      key: 'join', header: 'Join Class', width: '11%',
      render: (c) => {
        const isToday = isSessionOnDate(c, todayKey);
        const raw = c.scheduled_start || c.start_time;
        const d = raw ? new Date(String(raw).trim().replace(/T\s+(\d:)/, 'T0$1')) : null;
        const sessionDateKey = getSessionDate(c);
        const isPast = sessionDateKey < todayKey || (isToday && d ? d.getTime() < nowMs : false);
        const statusCfg = getSessionStatusStyle(c.session_status || c.status, c.attendance_status);
        const linkObj = getStudentMeetingLink(c.student_id);
        const joinUrl = c.meeting_url || (typeof linkObj === 'string' ? linkObj : (linkObj?.primary_meeting_link || linkObj?.meeting_link_1 || linkObj?.meeting_link_2));

        if (isToday && statusCfg.category === 'UPCOMING' && joinUrl) {
          return (
            <a href={joinUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="sm">Join Class ↗</Button>
            </a>
          );
        }
        if (statusCfg.category !== 'UPCOMING') return <span style={statusCfg.badgeStyle}>{statusCfg.label}</span>;
        if (!joinUrl) return <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)', fontStyle: 'italic' }}>No link</span>;
        return <span style={statusCfg.badgeStyle}>{isPast ? 'Past class' : 'Upcoming'}</span>;
      },
    },
    {
      key: 'notes', header: 'Session Notes', width: '15%',
      render: (c) => {
        const text = c.session_notes || c.notes || '';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: 'var(--font-size-xs)', color: text ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                fontStyle: text ? 'normal' : 'italic', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
              title={text || 'No session notes'}
            >
              {text || 'No notes'}
            </span>
            {onEditNotes && (
              <Button variant="ghost" size="sm" onClick={() => onEditNotes(c)} aria-label="Edit session notes">✎</Button>
            )}
          </div>
        );
      },
    },
    {
      key: 'attendance', header: 'Attendance', width: '17%',
      render: (c) => (
        <AttendanceControl
          status={c.status}
          creditEffect={c.class_credit_effect || 'PENDING'}
          onUpdateStatus={(outcome, reason) => handleUpdateStatus(c.session_id, outcome, reason)}
          onRestoreCredit={() => handleRestore(c.session_id)}
        />
      ),
    },
  ];
}
