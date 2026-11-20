import React, { useState } from 'react';
import styles from './dashboardCalendar.module.css';
import { ClassSession } from '../classes/classTypes';
import { WeeklyScheduleEntry } from '../classes/scheduleApi';
import { Student } from '../students/studentTypes';
import { Package } from '../packages/packageTypes';
import { getSavedTimezone } from '../../lib/userPreferences';
import { toInputDateFormat } from '../../lib/dateFormat';
import { formatTimeTo12Hour } from '../../lib/time12Format';
import { Button } from '../../components/buttons/Button';
import {
  getMondayForDateStr, shiftMondayStr, getWeekDates,
  generateCalendarEvents,
} from './calendarEventGenerator';
import { isSessionOnDate, getSessionStartTime } from '../classes/sessionTimeNormalizer';

export interface DashboardCalendarProps {
  classes: ClassSession[];
  schedules?: WeeklyScheduleEntry[];
  students?: Student[];
  packages?: Package[];
  onRefresh?: () => void;
}

export const DashboardCalendar: React.FC<DashboardCalendarProps> = ({
  classes, schedules = [], students = [], packages = [], onRefresh,
}) => {
  const activeTz = getSavedTimezone();
  const [mondayStr, setMondayStr] = useState<string>(() =>
    getMondayForDateStr(toInputDateFormat(new Date(), activeTz))
  );

  const weekDates = getWeekDates(mondayStr);
  const todayKey = toInputDateFormat(new Date(), activeTz);
  const allEvents = generateCalendarEvents({
    datedSessions: classes, recurringSchedules: schedules, students, packages, weekDates, activeTz,
  });

  const rangeText = `${mondayStr} – ${weekDates[6]} (${activeTz})`;
  const now = new Date();
  const currentMinute = now.getHours() * 60 + now.getMinutes();

  return (
    <div className={styles.calendarWrapper}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h3 className={styles.title}>Weekly Class Schedule</h3>
          <span className={styles.rangeText}>{rangeText}</span>
        </div>
        <div className={styles.navControls}>
          {onRefresh && <Button variant="secondary" size="sm" onClick={onRefresh} aria-label="Refresh calendar">↻</Button>}
          <Button variant="secondary" size="sm" onClick={() => setMondayStr((p) => shiftMondayStr(p, -7))} aria-label="Previous week">‹</Button>
          <Button variant="secondary" size="sm" onClick={() => setMondayStr(getMondayForDateStr(toInputDateFormat(new Date(), activeTz)))}>This Week</Button>
          <Button variant="secondary" size="sm" onClick={() => setMondayStr((p) => shiftMondayStr(p, 7))} aria-label="Next week">›</Button>
        </div>
      </div>

      <div className={styles.agendaContainer}>
        {weekDates.map((dayKey) => {
          const [y, m, d] = dayKey.split('-').map(Number);
          const dayDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
          const isToday = dayKey === todayKey;
          const dayNameFull = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(dayDate).toUpperCase();
          const monthNameLong = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(dayDate).toUpperCase();
          const dayClasses = allEvents
            .filter((c) => isSessionOnDate(c, dayKey))
            .sort((a, b) => getSessionStartTime(a, activeTz).localeCompare(getSessionStartTime(b, activeTz)));

          return (
            <div key={dayKey} className={`${styles.dayCol} ${isToday ? styles.dayColToday : ''}`}>
              <div className={styles.dayHeader}>
                <div className={styles.dayHeaderLeft}>
                  <span className={styles.dayTitle}>{dayNameFull} — {d} {monthNameLong}</span>
                  {isToday && <span className={styles.todayPill}>Today</span>}
                </div>
                <span className={styles.dayClassCount}>
                  {dayClasses.length} {dayClasses.length === 1 ? 'class' : 'classes'}
                </span>
              </div>

              <div className={styles.classesList}>
                {dayClasses.length === 0 ? (
                  <span className={styles.emptyDay}>No classes scheduled.</span>
                ) : (
                  dayClasses.map((c, idx) => {
                    const sTime = getSessionStartTime(c, activeTz);
                    const time12 = sTime ? formatTimeTo12Hour(sTime) : '—';
                    const stu = students.find((s) => s.student_id === c.student_id);
                    const studentName = c.student_name || stu?.student_name || c.student_id;
                    const subject = stu?.subject || c.topic || 'General';
                    const isRec = (c as unknown as { is_recurring?: boolean }).is_recurring;
                    const isCancelled = c.status === 'CANCELLED' || (c as unknown as { session_status?: string }).session_status === 'CANCELLED';
                    const [sh, sm] = (sTime || '00:00').split(':').map(Number);
                    const isPast = dayKey < todayKey || (dayKey === todayKey && ((sh || 0) * 60 + (sm || 0)) < currentMinute);

                    let statusClass = styles.statusScheduled;
                    let statusLabel = c.status || 'Scheduled';

                    if (isCancelled) {
                      statusClass = styles.statusCancelled;
                      statusLabel = 'Cancelled';
                    } else if (isRec) {
                      statusClass = styles.statusRecurring;
                    } else if (isPast) {
                      const att = ((c as unknown as { attendance_status?: string }).attendance_status || c.status).toUpperCase();
                      if (att === 'PRESENT' || att === 'ATTENDED' || att === 'COMPLETED') {
                        statusClass = styles.statusAttended;
                        statusLabel = 'Attended';
                      } else if (att === 'ABSENT' || att === 'NO_SHOW') {
                        statusClass = styles.statusAbsent;
                        statusLabel = 'Absent';
                      } else {
                        statusClass = styles.statusUnmarked;
                        statusLabel = 'Unmarked';
                      }
                    }

                    return (
                      <div key={`${c.session_id || idx}_${c.student_id || idx}_${idx}`} className={styles.classCard}>
                        <div className={styles.timeWrapper}>
                          <span className={styles.classTime}>{time12}</span>
                        </div>
                        <div className={styles.studentWrapper}>
                          <span className={styles.studentName}>{studentName}</span>
                          <span className={styles.studentSubject}>{subject}</span>
                        </div>
                        <span className={`${styles.statusPill} ${statusClass}`}>{statusLabel}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
