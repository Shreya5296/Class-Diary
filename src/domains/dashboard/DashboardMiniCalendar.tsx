import React, { useState, useMemo } from 'react';
import styles from './dashboardMiniCalendar.module.css';
import { ClassSession } from '../classes/classTypes';
import { WeeklyScheduleEntry } from '../classes/scheduleApi';
import { Student } from '../students/studentTypes';
import { Package } from '../packages/packageTypes';
import { getSessionDate } from '../classes/sessionTimeNormalizer';
import { toInputDateFormat } from '../../lib/dateFormat';
import { generateCalendarEvents } from './calendarEventGenerator';

export interface DashboardMiniCalendarProps {
  classes: ClassSession[];
  schedules?: WeeklyScheduleEntry[];
  students?: Student[];
  packages?: Package[];
  selectedDateKey: string;
  onSelectDateKey: (dateKey: string) => void;
  activeTz?: string;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export const DashboardMiniCalendar: React.FC<DashboardMiniCalendarProps> = ({
  classes,
  schedules,
  students = [],
  packages = [],
  selectedDateKey,
  onSelectDateKey,
  activeTz = 'Asia/Kolkata',
}) => {
  const todayKey = toInputDateFormat(new Date(), activeTz);
  const [viewYear, setViewYear] = useState(() => Number(selectedDateKey.slice(0, 4)) || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (Number(selectedDateKey.slice(5, 7)) || (new Date().getMonth() + 1)) - 1);

  const monthDates = useMemo(() => {
    const dates: string[] = [];
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      dates.push(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return dates;
  }, [viewYear, viewMonth]);

  const scheduledDates = useMemo(() => {
    const set = new Set<string>();
    if (schedules && schedules.length > 0) {
      const events = generateCalendarEvents({
        datedSessions: classes,
        recurringSchedules: schedules,
        students,
        packages,
        weekDates: monthDates,
        activeTz,
      });
      events.forEach((sess) => {
        const d = sess.schedule_date || sess.class_date || (sess.scheduled_start ? sess.scheduled_start.slice(0, 10) : getSessionDate(sess, activeTz));
        if (d) set.add(d);
      });
    } else {
      classes.forEach((c) => {
        const d = getSessionDate(c, activeTz);
        if (d) set.add(d);
      });
    }
    return set;
  }, [classes, schedules, students, packages, monthDates, activeTz]);

  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(viewYear, viewMonth, 1));
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDay = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;

  const handlePrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else { setViewMonth((m) => m - 1); }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else { setViewMonth((m) => m + 1); }
  };

  const handleGoToday = () => {
    const [y, m] = todayKey.split('-').map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
    onSelectDateKey(todayKey);
  };

  const days: Array<number | null> = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <div className={styles.calendarCard} aria-label="Monthly Class Schedule Calendar">
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h3 className={styles.title}>Schedule Calendar</h3>
          <span className={styles.monthLabel}>{`${monthName} ${viewYear}`}</span>
        </div>
        <div className={styles.navControls}>
          <button type="button" className={styles.navBtn} onClick={handlePrevMonth} aria-label="Previous month">‹</button>
          <button type="button" className={styles.todayBtn} onClick={handleGoToday}>Today</button>
          <button type="button" className={styles.navBtn} onClick={handleNextMonth} aria-label="Next month">›</button>
        </div>
      </div>

      <div className={styles.weekdaysGrid}>
        {WEEKDAYS.map((wd) => (
          <span key={wd} className={styles.weekday}>{wd}</span>
        ))}
      </div>

      <div className={styles.daysGrid}>
        {days.map((day, idx) => {
          if (day === null) return <div key={`empty_${idx}`} className={styles.emptyCell} />;
          const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = dateKey === selectedDateKey;
          const isToday = dateKey === todayKey;
          const hasClasses = scheduledDates.has(dateKey);

          return (
            <button
              key={dateKey}
              type="button"
              className={[
                styles.dayCell,
                isSelected ? styles.selectedCell : '',
                isToday ? styles.todayCell : '',
                hasClasses ? styles.hasClassesCell : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onSelectDateKey(dateKey)}
              aria-label={`${monthName} ${day}, ${viewYear}${hasClasses ? ' (Classes scheduled)' : ''}`}
              aria-pressed={isSelected}
            >
              <span className={styles.dayNum}>{day}</span>
              {hasClasses && <span className={styles.classDot} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
