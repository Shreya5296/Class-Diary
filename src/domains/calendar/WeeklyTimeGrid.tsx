import React from 'react';
import styles from './weeklyTimeGrid.module.css';
import { DayColumnData, CalendarEventItem } from './calendarTypes';
import { formatTimeTo12Hour } from '../../lib/time12Format';

export interface WeeklyTimeGridProps {
  dayColumns: DayColumnData[];
  startHour?: number;
}

export const DEFAULT_START_HOUR = 9;
export const END_HOUR = 22;
export const HOUR_ROW_HEIGHT = 56;

export function computeEffectiveStartHour(
  columns: Array<{ events: Array<{ startHour?: number }> }>,
  defaultStart = DEFAULT_START_HOUR
): number {
  let earliest: number | null = null;
  for (const col of columns) {
    for (const evt of col.events) {
      if (typeof evt.startHour === 'number' && evt.startHour < defaultStart) {
        if (earliest === null || evt.startHour < earliest) earliest = evt.startHour;
      }
    }
  }
  return earliest !== null ? Math.max(0, earliest - 1) : defaultStart;
}

export function getCalendarHours(startHour = DEFAULT_START_HOUR): string[] {
  const hours: string[] = [];
  for (let h = startHour; h <= END_HOUR; h++) {
    hours.push(`${String(h).padStart(2, '0')}:00`);
  }
  return hours;
}

function getEventCardClass(evt: CalendarEventItem): string {
  if (evt.category === 'CANCELLED' || evt.isCancelled) return styles.cardCancelled;
  if (evt.category === 'PAST_COMPLETED') return styles.cardAttended;
  if (evt.category === 'PAST_UNATTENDED') return styles.cardUnattended;
  if (evt.isPast) {
    const isComp = evt.status === 'COMPLETED' || evt.attendanceStatus === 'PRESENT' || evt.attendanceStatus === 'ATTENDED';
    if (isComp) return styles.cardAttended;
    const isAbsent = evt.status === 'CANCELLED' || evt.attendanceStatus === 'ABSENT' || evt.attendanceStatus === 'NO_SHOW' || evt.attendanceStatus === 'CANCELLED';
    if (isAbsent) return styles.cardCancelled;
    return styles.cardUnattended;
  }
  return evt.isRecurring ? styles.recurringCard : styles.sessionCard;
}

const WeeklyTimeGridComponent: React.FC<WeeklyTimeGridProps> = ({ dayColumns, startHour: propStartHour }) => {
  const computedStart = computeEffectiveStartHour(dayColumns, DEFAULT_START_HOUR);
  const effectiveStartHour = propStartHour !== undefined ? propStartHour : computedStart;
  const hours = getCalendarHours(effectiveStartHour);
  const baseMin = effectiveStartHour * 60;

  return (
    <div className={styles.calendarOuter}>
      <div className={styles.scrollContainer}>
        <div className={styles.gridTable}>
          <div className={styles.timeAxis}>
            <div className={styles.timeAxisHeader} />
            {hours.map((hourStr) => (
              <div key={hourStr} className={styles.timeSlot}>
                {formatTimeTo12Hour(hourStr)}
              </div>
            ))}
          </div>

          <div className={styles.dayColumnsWrapper}>
            {dayColumns.map((col) => (
              <div key={col.dateKey} className={styles.dayColumn}>
                <div className={`${styles.dayHeader} ${col.isToday ? styles.dayHeaderToday : ''}`}>
                  <span className={styles.dayName}>{col.dayName}</span>
                  <span className={styles.dayNumber}>{col.dayNumber}</span>
                </div>

                <div className={`${styles.dayBody} ${col.isToday ? styles.dayBodyToday : ''}`}>
                  {col.events.map((evt) => {
                    const cardClass = getEventCardClass(evt);
                    const evtMin = evt.startHour * 60 + evt.startMinute;
                    const diffMin = Math.max(0, evtMin - baseMin);
                    const topPx = Math.round((diffMin / 60) * HOUR_ROW_HEIGHT);
                    const duration = evt.durationMinutes || 60;
                    const isCompact = duration <= 30;
                    const slotHeight = Math.round((duration / 60) * HOUR_ROW_HEIGHT);
                    const heightPx = Math.max(isCompact ? 24 : 52, slotHeight - 2);

                    return (
                      <div
                        key={evt.id}
                        className={`${styles.eventCard} ${cardClass}`}
                        style={{
                          position: 'absolute', top: `${topPx}px`, left: '2px', right: '2px',
                          height: `${heightPx}px`, overflow: 'hidden', margin: 0,
                          padding: isCompact ? '2px 4px' : '4px 6px', zIndex: evt.isRecurring ? 5 : 6,
                        }}
                        title={`${evt.studentName} — ${evt.subject} (${evt.timeRange12})`}
                      >
                        {isCompact ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            <span className={styles.eventStudent}>{evt.studentName}</span>
                            <span className={styles.eventTime}>{evt.startTime12 || evt.timeRange12}</span>
                          </div>
                        ) : (
                          <>
                            <div className={styles.eventHeader}>
                              <span className={styles.eventStudent}>{evt.studentName}</span>
                            </div>
                            <span className={styles.eventSubject}>{evt.subject}</span>
                            <span className={styles.eventTime}>{evt.timeRange12}</span>
                            {evt.canJoin && evt.meetingUrl && (
                              <a href={evt.meetingUrl} target="_blank" rel="noopener noreferrer" className={styles.joinBtn} onClick={(e) => e.stopPropagation()}>
                                Join Class ↗
                              </a>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const WeeklyTimeGrid = React.memo(WeeklyTimeGridComponent);
