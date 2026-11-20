import React, { useMemo } from 'react';
import { ClassSession } from '../classes/classTypes';
import { Student } from '../students/studentTypes';
import { parseYearMonth, getMonthGridDates } from './calendarDateUtils';
import { formatIsoTo12Hour, formatTimeTo12Hour } from '../../lib/time12Format';
import { cleanTime } from '../classes/scheduleApi';
import { toInputDateFormat } from '../../lib/dateFormat';
import { isEventPast } from './calendarClassification';

export interface MonthCalendarViewProps {
  yearMonthStr: string;
  sessions: ClassSession[];
  students: Student[];
  onSelectDate: (dateStr: string) => void;
  activeTz?: string;
}

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MonthCalendarViewComponent: React.FC<MonthCalendarViewProps> = ({
  yearMonthStr, sessions, students, onSelectDate, activeTz = 'Asia/Kolkata',
}) => {
  const { year, month } = useMemo(() => parseYearMonth(yearMonthStr), [yearMonthStr]);
  const gridDates = useMemo(() => getMonthGridDates(year, month), [year, month]);
  const todayStr = toInputDateFormat(new Date(), activeTz);
  const currentMonthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const studentMap = useMemo(() => {
    return new Map(students.map((s) => [s.student_id, s.student_name || s.full_name || s.student_id]));
  }, [students]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, ClassSession[]>();
    for (const s of sessions) {
      const dKey = s.schedule_date || s.class_date || (s.scheduled_start ? s.scheduled_start.slice(0, 10) : '');
      if (dKey) {
        const arr = map.get(dKey) || [];
        arr.push(s);
        map.set(dKey, arr);
      }
    }
    return map;
  }, [sessions]);

  return (
    <div style={{ background: 'var(--glass-bg, rgba(255, 255, 255, 0.78))', backdropFilter: 'var(--glass-blur, blur(16px))', WebkitBackdropFilter: 'var(--glass-blur, blur(16px))', border: '1px solid var(--glass-border-subtle, rgba(220, 227, 240, 0.85))', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--glass-shadow)', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: '700px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'rgba(248, 250, 252, 0.85)', borderBottom: '1px solid rgba(220, 227, 240, 0.85)' }}>
            {WEEKDAY_NAMES.map((name) => (
              <div key={name} style={{ padding: '8px 4px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                {name}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(96px, 1fr)' }}>
            {gridDates.map((dateStr) => {
              const isCurrentMonth = dateStr.startsWith(currentMonthPrefix), isToday = dateStr === todayStr;
              const dayNum = parseInt(dateStr.slice(8), 10);
              const daySessions = sessionsByDate.get(dateStr) || [];
              const visibleSessions = daySessions.slice(0, 2), overflowCount = daySessions.length - visibleSessions.length;

              return (
                <div
                  key={dateStr}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectDate(dateStr)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectDate(dateStr); }}
                  title={`Click to view day view for ${dateStr}`}
                  style={{
                    borderRight: '1px solid rgba(220, 227, 240, 0.7)', borderBottom: '1px solid rgba(220, 227, 240, 0.7)',
                    padding: '6px 8px', background: isToday ? 'rgba(239, 246, 255, 0.7)' : isCurrentMonth ? 'rgba(255, 255, 255, 0.6)' : 'rgba(248, 250, 252, 0.4)',
                    opacity: isCurrentMonth ? 1 : 0.5, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px',
                    transition: 'background var(--transition-fast, 120ms ease)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '12px', fontWeight: isToday ? 700 : 500, width: '22px', height: '22px', lineHeight: '22px',
                        textAlign: 'center', borderRadius: '50%', background: isToday ? 'var(--color-primary)' : 'transparent',
                        color: isToday ? '#fff' : 'var(--color-text-main)', boxShadow: isToday ? '0 2px 6px rgba(37, 99, 235, 0.4)' : 'none',
                      }}
                    >
                      {dayNum}
                    </span>
                    {daySessions.length > 0 && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {daySessions.length} {daySessions.length === 1 ? 'class' : 'classes'}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                    {visibleSessions.map((sess, idx) => {
                      const studentName = studentMap.get(sess.student_id) || sess.student_id;
                      const sTime = cleanTime(sess.schedule_time || sess.start_time);
                      const time12 = sTime ? formatTimeTo12Hour(sTime) : (sess.scheduled_start ? formatIsoTo12Hour(sess.scheduled_start, activeTz) : '');
                      const isPast = isEventPast(dateStr, sess.scheduled_end || sTime, activeTz);
                      const isCancelled = sess.session_status === 'CANCELLED' || sess.status === 'CANCELLED';

                      return (
                        <div
                          key={sess.session_id || idx}
                          style={{
                            fontSize: '10px', padding: '2px 5px', borderRadius: 'var(--radius-sm)',
                            background: '#eff6ff', border: '1px solid #bfdbfe',
                            borderLeft: '3px solid var(--color-primary, #2563eb)',
                            color: '#1e40af', opacity: isPast && !isCancelled ? 0.85 : 1,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600,
                          }}
                        >
                          {time12 ? `${time12} ` : ''}{studentName}{isCancelled ? ' (Cancelled)' : ''}
                        </div>
                      );
                    })}
                    {overflowCount > 0 && (
                      <div style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 600 }}>
                        +{overflowCount} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export const MonthCalendarView = React.memo(MonthCalendarViewComponent);
