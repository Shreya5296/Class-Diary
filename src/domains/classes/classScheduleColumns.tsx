import { ClassSession } from './classTypes';
import { Column } from '../../components/tables/DataTable';
import { AttendanceControl } from './AttendanceControl';
import { Button } from '../../components/buttons/Button';
import { SessionProgress } from './sessionProgressCalculator';
import { formatSessionTimeRange } from './sessionTimeNormalizer';
import { CLASS_TABLE_COLUMNS } from './classTableLayout';

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
  todayKey?: string; nowMs?: number;
  getStudentConsumedClasses: (id: string) => { consumed: number; purchased: number };
  getStudentMeetingLink?: (id: string) => any;
  getProgress?: (session: ClassSession) => SessionProgress | undefined;
  handleUpdateStatus: (sessionId: string, outcome: string, cancellationReason?: string, notes?: string) => Promise<void>;
  handleRestore: (sessionId: string) => Promise<void>;
  onEditNotes?: (session: ClassSession) => void;
}): Column<ClassSession>[] {
  const { getStudentConsumedClasses, getProgress, handleUpdateStatus, handleRestore, onEditNotes } = params;

  return [
    {
      key: 'student', header: CLASS_TABLE_COLUMNS.student.header, width: CLASS_TABLE_COLUMNS.student.width,
      render: (c) => (
        <div>
          <span style={{ fontWeight: 600, color: 'var(--color-text-main)', fontSize: 'var(--font-size-sm)', display: 'block' }}>
            {c.student_name || c.student_id}
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block', marginTop: '2px' }}>
            {formatSessionTimeRange(c)}
          </span>
        </div>
      ),
    },
    {
      key: 'date', header: CLASS_TABLE_COLUMNS.date.header, width: CLASS_TABLE_COLUMNS.date.width,
      render: (c) => (
        <span style={{ fontWeight: 600, color: 'var(--color-text-main)', fontSize: 'var(--font-size-sm)' }}>
          {formatClassDate(c.schedule_date || c.class_date || c.scheduled_start)}
        </span>
      ),
    },
    {
      key: 'consumed', header: CLASS_TABLE_COLUMNS.consumed.header, width: CLASS_TABLE_COLUMNS.consumed.width,
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
      key: 'attendance', header: CLASS_TABLE_COLUMNS.attendance.header, width: CLASS_TABLE_COLUMNS.attendance.width,
      render: (c) => (
        <AttendanceControl
          status={c.status}
          creditEffect={c.class_credit_effect || 'PENDING'}
          session={c}
          onUpdateStatus={(outcome, reason, notes) => handleUpdateStatus(c.session_id, outcome, reason, notes)}
          onRestoreCredit={() => handleRestore(c.session_id)}
        />
      ),
    },
    {
      key: 'notes', header: CLASS_TABLE_COLUMNS.notes.header, width: CLASS_TABLE_COLUMNS.notes.width,
      render: (c) => {
        const text = c.session_notes || c.notes || '';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: 'var(--font-size-xs)', color: text ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                fontStyle: text ? 'normal' : 'italic', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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
  ];
}
