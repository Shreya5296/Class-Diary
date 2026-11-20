import React from 'react';
import { CalendarEventItem } from './calendarTypes';
import { EmptyState } from '../../components/feedback/EmptyState';
import { formatDateDdMmYyyy } from '../../lib/dateFormat';

export interface DayCalendarViewProps {
  selectedDateStr: string;
  events: CalendarEventItem[];
  isToday: boolean;
}

const DayCalendarViewComponent: React.FC<DayCalendarViewProps> = ({
  selectedDateStr,
  events,
  isToday,
}) => {
  if (events.length === 0) {
    return (
      <EmptyState
        title="No classes scheduled"
        description={`There are no classes scheduled for ${formatDateDdMmYyyy(selectedDateStr)}.`}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: '880px', margin: '0 auto' }}>
      {isToday && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', backgroundColor: 'var(--color-primary-bg, #eff6ff)', color: 'var(--color-primary, #2563eb)', border: '1px solid var(--color-primary-border, #bfdbfe)', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 600, width: 'fit-content' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-primary)' }} /> Today
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {events.map((evt) => {
          const isCancelled = evt.category === 'CANCELLED' || evt.isCancelled;
          const isPastCompleted = evt.category === 'PAST_COMPLETED';

          const cardBg = 'rgba(239, 246, 255, 0.92)';
          const borderLeftColor = 'var(--color-primary, #2563eb)';
          const borderStyle = evt.isRecurring ? 'dashed' : 'solid';

          return (
            <div
              key={evt.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.95rem 1.25rem', background: cardBg,
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                border: `1px ${borderStyle} rgba(191, 219, 254, 0.95)`,
                borderLeft: `4px ${borderStyle} ${borderLeftColor}`,
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.06)',
                gap: 'var(--space-4)', flexWrap: 'wrap',
                transition: 'all var(--transition-fast, 120ms ease)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{ minWidth: '120px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-text-main)', fontFamily: 'var(--font-mono)' }}>
                    {evt.startTime12}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    until {evt.endTime12} ({evt.durationMinutes} min)
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: '#1e3a8a' }}>
                    {evt.studentName}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 500 }}>
                    {evt.subject}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {!isCancelled && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '32px',
                      padding: '0 12px',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-md)',
                      boxSizing: 'border-box',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isPastCompleted ? 'Completed' : 'Upcoming'}
                  </span>
                )}

                {evt.canJoin && evt.meetingUrl && (
                  <a
                    href={evt.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '32px',
                      padding: '0 12px',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-primary)',
                      color: '#ffffff',
                      border: '1px solid var(--color-primary)',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)',
                      transition: 'all var(--transition-fast)',
                      cursor: 'pointer',
                    }}
                  >
                    Join Class ↗
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const DayCalendarView = React.memo(DayCalendarViewComponent);
