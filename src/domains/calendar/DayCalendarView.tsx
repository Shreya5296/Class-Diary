import React from 'react';
import { CalendarEventItem } from './calendarTypes';
import { EmptyState } from '../../components/feedback/EmptyState';
import { formatDateDdMmYyyy } from '../../lib/dateFormat';

export interface DayCalendarViewProps {
  selectedDateStr: string;
  events: CalendarEventItem[];
  isToday: boolean;
}

function getDayEventStyles(evt: CalendarEventItem) {
  const isCancelled = evt.category === 'CANCELLED' || evt.isCancelled;
  const isPastCompleted = evt.category === 'PAST_COMPLETED';
  const isPastUnattended = evt.category === 'PAST_UNATTENDED';

  if (isCancelled) {
    return {
      cardBg: 'rgba(254, 242, 242, 0.92)', borderColor: 'rgba(254, 202, 202, 0.95)', borderLeftColor: '#dc2626',
      badgeLabel: 'Cancelled', badgeBg: '#fef2f2', badgeBorder: '#fecaca', badgeColor: '#b91c1c', isCancelled: true
    };
  }
  if (isPastCompleted) {
    return {
      cardBg: 'rgba(236, 253, 245, 0.92)', borderColor: 'rgba(167, 243, 208, 0.95)', borderLeftColor: '#059669',
      badgeLabel: 'Present', badgeBg: '#ecfdf5', badgeBorder: '#a7f3d0', badgeColor: '#065f46', isCancelled: false
    };
  }
  if (isPastUnattended) {
    return {
      cardBg: 'rgba(255, 251, 235, 0.92)', borderColor: 'rgba(253, 230, 138, 0.95)', borderLeftColor: '#d97706',
      badgeLabel: 'Unrecorded', badgeBg: '#fffbeb', badgeBorder: '#fde68a', badgeColor: '#92400e', isCancelled: false
    };
  }
  return {
    cardBg: 'rgba(239, 246, 255, 0.92)', borderColor: 'rgba(191, 219, 254, 0.95)', borderLeftColor: 'var(--color-primary, #2563eb)',
    badgeLabel: 'Upcoming', badgeBg: '#eff6ff', badgeBorder: '#bfdbfe', badgeColor: '#1d4ed8', isCancelled: false
  };
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
          const s = getDayEventStyles(evt);
          const borderStyle = evt.isRecurring ? 'dashed' : 'solid';

          return (
            <div
              key={evt.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.95rem 1.25rem', background: s.cardBg,
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                border: `1px ${borderStyle} ${s.borderColor}`,
                borderLeft: `4px ${borderStyle} ${s.borderLeftColor}`,
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
                {!s.isCancelled && (
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      height: '32px', padding: '0 12px', fontSize: 'var(--font-size-xs)', fontWeight: 600,
                      borderRadius: 'var(--radius-md)', boxSizing: 'border-box',
                      backgroundColor: s.badgeBg, color: s.badgeColor, border: `1px solid ${s.badgeBorder}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.badgeLabel}
                  </span>
                )}

                {evt.canJoin && evt.meetingUrl && (
                  <a
                    href={evt.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      height: '32px', padding: '0 12px', fontSize: 'var(--font-size-xs)', fontWeight: 600,
                      borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-primary)', color: '#ffffff',
                      border: '1px solid var(--color-primary)', textDecoration: 'none', whiteSpace: 'nowrap',
                      boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)', transition: 'all var(--transition-fast)', cursor: 'pointer',
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
