import React, { useState, useMemo } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useDashboardData } from './useDashboardData';
import { generateAttentionAlerts } from './attentionAlerts';
import { DashboardSummary } from './DashboardSummary';
import { TodayClassesSection } from './TodayClassesSection';
import { ThingsThatNeedAttention } from './ThingsThatNeedAttention';
import { DashboardMiniCalendar } from './DashboardMiniCalendar';
import { toInputDateFormat } from '../../lib/dateFormat';
import { generateCalendarEvents } from './calendarEventGenerator';
import styles from './dashboardPage.module.css';
import { DashboardSkeleton } from '../../components/feedback/Skeleton';
import { ErrorState } from '../../components/feedback/ErrorState';
import { NavSection } from '../../layout/Sidebar';

export interface DashboardPageProps {
  onNavigate: (section: NavSection) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  usePageTitle('Dashboard');
  const { token } = useAuth();
  const {
    overview,
    classes,
    schedules,
    students,
    packages,
    meetingLinks,
    fees,
    loading,
    error,
    refreshData,
  } = useDashboardData(token);

  const activeTz = 'Asia/Kolkata';
  const todayKey = toInputDateFormat(new Date(), activeTz);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

  const selectedDateEvents = useMemo(() => {
    if (schedules.length > 0 || packages.length > 0) {
      return generateCalendarEvents({
        datedSessions: classes,
        recurringSchedules: schedules,
        students,
        packages,
        weekDates: [selectedDateKey],
        activeTz,
      });
    }
    return classes;
  }, [classes, schedules, students, packages, selectedDateKey, activeTz]);

  if (loading && !overview) {
    return <DashboardSkeleton />;
  }

  if (error && !overview) {
    return <ErrorState message={error} onRetry={refreshData} />;
  }

  const defaultOverview = overview || {
    activeStudentsCount: 0,
    classesUpcoming7Days: 0,
    outstandingFeesTotal: 0,
    currency: 'INR',
  };

  const attentionAlerts = generateAttentionAlerts({
    students,
    schedules,
    meetingLinks,
    packages,
    sessions: classes,
    fees,
  });

  return (
    <div className={styles.container}>
      {/* SECTION 1 — TOP ROW: Welcome Back (50%) + Active Students (50%) */}
      <DashboardSummary
        overview={defaultOverview}
        students={students}
        loading={loading}
      />

      {/* SECTION 2 & 3 & CALENDAR — TWO-COLUMN RESPONSIVE LAYOUT */}
      <div className={styles.mainGrid}>
        <div className={styles.scheduleArea}>
          <TodayClassesSection
            classes={selectedDateEvents}
            students={students}
            packages={packages}
            meetingLinks={meetingLinks}
            activeTz={activeTz}
            selectedDateKey={selectedDateKey}
            onSelectDateKey={setSelectedDateKey}
          />
        </div>

        <div className={styles.attentionArea}>
          <ThingsThatNeedAttention
            alerts={attentionAlerts}
            onNavigate={onNavigate}
            error={error}
            onRefresh={refreshData}
          />
        </div>

        <div className={styles.calendarArea}>
          <DashboardMiniCalendar
            classes={classes}
            schedules={schedules}
            students={students}
            packages={packages}
            selectedDateKey={selectedDateKey}
            onSelectDateKey={setSelectedDateKey}
            activeTz={activeTz}
          />
        </div>
      </div>
    </div>
  );
};
