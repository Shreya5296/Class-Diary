import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { usePageTitle } from '../../hooks/usePageTitle';
import { fetchClasses } from '../classes/classApi';
import { fetchSchedules, WeeklyScheduleEntry } from '../classes/scheduleApi';
import { fetchStudents } from '../students/studentApi';
import { fetchPackages } from '../packages/packageApi';
import { ClassSession } from '../classes/classTypes';
import { Student } from '../students/studentTypes';
import { Package } from '../packages/packageTypes';
import { getSavedTimezone } from '../../lib/userPreferences';
import { toInputDateFormat } from '../../lib/dateFormat';
import { getMondayForDateStr, shiftMondayStr, getWeekDates, generateCalendarEvents } from '../dashboard/calendarEventGenerator';
import { CalendarViewMode } from './calendarTypes';
import { shiftDateStr, shiftMonthStr, formatMonthTitle, formatDayTitle, formatWeekHeading, getMonthGridDates } from './calendarDateUtils';
import { buildDayColumns } from './calendarGridBuilder';
import { WeeklyTimeGrid } from './WeeklyTimeGrid';
import { DayCalendarView } from './DayCalendarView';
import { MonthCalendarView } from './MonthCalendarView';
import { CalendarControlsBar } from './CalendarControlsBar';
import { ScheduleExtraClassModal } from './ScheduleExtraClassModal';
import { PageHeader } from '../../layout/PageHeader';
import { CalendarSkeleton } from '../../components/feedback/Skeleton';
import { ErrorState } from '../../components/feedback/ErrorState';

export const CalendarPage: React.FC = () => {
  const { token } = useAuth();
  const activeTz = getSavedTimezone() || 'Asia/Kolkata';

  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [mondayStr, setMondayStr] = useState<string>(() => getMondayForDateStr(toInputDateFormat(new Date(), activeTz)));
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => toInputDateFormat(new Date(), activeTz));
  const [yearMonthStr, setYearMonthStr] = useState<string>(() => toInputDateFormat(new Date(), activeTz).slice(0, 7));

  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [schedules, setSchedules] = useState<WeeklyScheduleEntry[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExtraModalOpen, setIsExtraModalOpen] = useState(false);

  const loadCalendarData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cls, scheds, stuList, pkgs] = await Promise.all([
        fetchClasses(undefined, token).catch(() => []),
        fetchSchedules(undefined, token).catch(() => []),
        fetchStudents({}, token).catch(() => []),
        fetchPackages(undefined, token).catch(() => []),
      ]);
      setClasses(cls); setSchedules(scheds); setStudents(stuList); setPackages(pkgs);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadCalendarData(); }, [loadCalendarData]);

  const weekDates = useMemo(() => getWeekDates(mondayStr), [mondayStr]);
  const sundayStr = weekDates[6];

  const dayColumns = useMemo(() => {
    return buildDayColumns({ datedSessions: classes, recurringSchedules: schedules, students, weekDates, activeTz, packages });
  }, [classes, schedules, students, weekDates, activeTz, packages]);

  const dayCol = useMemo(() => {
    if (viewMode !== 'day') return null;
    return buildDayColumns({ datedSessions: classes, recurringSchedules: schedules, students, weekDates: [selectedDateStr], activeTz, packages })[0];
  }, [viewMode, classes, schedules, students, selectedDateStr, activeTz, packages]);

  const dayEvents = dayCol ? dayCol.events : [];
  const isDayToday = selectedDateStr === toInputDateFormat(new Date(), activeTz);

  const monthGridDates = useMemo(() => {
    if (viewMode !== 'month') return [];
    return getMonthGridDates(parseInt(yearMonthStr.slice(0, 4), 10), parseInt(yearMonthStr.slice(5, 7), 10));
  }, [viewMode, yearMonthStr]);

  const monthSessions = useMemo(() => {
    if (viewMode !== 'month') return [];
    return generateCalendarEvents({ datedSessions: classes, recurringSchedules: schedules, students, weekDates: monthGridDates, activeTz, packages });
  }, [viewMode, classes, schedules, students, monthGridDates, activeTz, packages]);

  const handlePrev = () => {
    if (viewMode === 'day') setSelectedDateStr((d) => shiftDateStr(d, -1));
    else if (viewMode === 'week') setMondayStr((m) => shiftMondayStr(m, -7));
    else setYearMonthStr((ym) => shiftMonthStr(ym, -1));
  };
  const handleNext = () => {
    if (viewMode === 'day') setSelectedDateStr((d) => shiftDateStr(d, 1));
    else if (viewMode === 'week') setMondayStr((m) => shiftMondayStr(m, 7));
    else setYearMonthStr((ym) => shiftMonthStr(ym, 1));
  };
  const handleToday = () => {
    const today = toInputDateFormat(new Date(), activeTz);
    setSelectedDateStr(today); setMondayStr(getMondayForDateStr(today)); setYearMonthStr(today.slice(0, 7));
  };

  const titleText = viewMode === 'day' ? formatDayTitle(selectedDateStr, activeTz) : viewMode === 'month' ? formatMonthTitle(yearMonthStr) : formatWeekHeading(mondayStr, sundayStr);
  usePageTitle(titleText);

  return (
    <div style={{ paddingBottom: 'var(--space-2)' }}>
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <PageHeader title={titleText} />
      </div>
      <CalendarControlsBar
        viewMode={viewMode} onChangeViewMode={setViewMode} showTitle={false}
        onPrev={handlePrev} onNext={handleNext} onToday={handleToday}
        onScheduleExtraClass={() => setIsExtraModalOpen(true)}
      />
      {loading && <CalendarSkeleton />}
      {error && !loading && <ErrorState message={error} onRetry={loadCalendarData} />}
      {!loading && !error && viewMode === 'day' && <DayCalendarView selectedDateStr={selectedDateStr} events={dayEvents} isToday={isDayToday} />}
      {!loading && !error && viewMode === 'week' && <WeeklyTimeGrid dayColumns={dayColumns} />}
      {!loading && !error && viewMode === 'month' && (
        <MonthCalendarView
          yearMonthStr={yearMonthStr} sessions={monthSessions} students={students}
          activeTz={activeTz} onSelectDate={(d) => { setSelectedDateStr(d); setViewMode('day'); }}
        />
      )}
      <ScheduleExtraClassModal
        isOpen={isExtraModalOpen} onClose={() => setIsExtraModalOpen(false)} onScheduled={loadCalendarData}
        students={students} packages={packages} classes={classes} initialDate={selectedDateStr} token={token} activeTz={activeTz}
      />
    </div>
  );
};
