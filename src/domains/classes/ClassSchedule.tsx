import React, { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { AttendanceStatus, ClassSession } from './classTypes';
import { recordAttendance, restoreCredit, cancelClass } from './classApi';
import { DataTable } from '../../components/tables/DataTable';
import { ClassScheduleSkeleton } from '../../components/feedback/Skeleton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { useClassScheduleData } from './useClassScheduleData';
import { toInputDateFormat } from '../../lib/dateFormat';
import { buildClassScheduleColumns } from './classScheduleColumns';
import { buildSessionProgressMap } from './sessionProgressCalculator';
import { getSessionStatusStyle } from './sessionStatusStyles';
import { EditSessionNotesModal } from './EditSessionNotesModal';
import { splitAndSortSessions } from './classSorting';
import { invalidateAppData } from '../../context/AppDataContext';
import styles from './classSchedule.module.css';

export interface ClassScheduleProps {
  studentId?: string;
  onRefreshTrigger?: number;
  toolbarRight?: React.ReactNode;
  scheduleForm?: React.ReactNode;
}

export const ClassSchedule: React.FC<ClassScheduleProps> = ({
  studentId,
  toolbarRight,
  scheduleForm,
}) => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [pastPage, setPastPage] = useState(1);
  const [notesSession, setNotesSession] = useState<ClassSession | null>(null);
  const {
    sessions, packages, loading, refetch, getStudentConsumedClasses, getStudentMeetingLink,
  } = useClassScheduleData(studentId, token, activeTab);

  const activeTz = 'Asia/Kolkata';
  const todayKey = toInputDateFormat(new Date(), activeTz);
  const nowMs = Date.now();

  const progressMap = useMemo(() => buildSessionProgressMap(sessions, packages), [sessions, packages]);

  const { upcoming, past, invalid } = useMemo(() => {
    return splitAndSortSessions(sessions, nowMs, activeTz);
  }, [sessions, nowMs, activeTz]);

  const pagedPast = useMemo(() => past.slice(0, pastPage * 50), [past, pastPage]);
  const displayedSessions = activeTab === 'upcoming' ? upcoming : pagedPast;

  const getProgress = (s: ClassSession) =>
    progressMap.get(s.session_id) || progressMap.get(`${s.student_id}__${s.schedule_date}__${s.schedule_time}`);

  const handleUpdateStatus = async (sessionId: string, outcome: string, cancellationReason?: string, notes?: string) => {
    if (outcome === 'CANCELLED' && cancellationReason) {
      await cancelClass(sessionId, cancellationReason, token);
    } else {
      await recordAttendance(sessionId, outcome as AttendanceStatus, token, cancellationReason, notes);
    }
    invalidateAppData('dashboard');
    await refetch();
  };

  const handleRestore = async (sessionId: string) => {
    await restoreCredit(sessionId, 'Admin manual credit restoration', token);
    invalidateAppData('dashboard');
    await refetch();
  };

  const columns = buildClassScheduleColumns({
    todayKey, nowMs, getStudentConsumedClasses, getStudentMeetingLink, getProgress,
    handleUpdateStatus, handleRestore,
    onEditNotes: (s) => setNotesSession(s),
  });

  const rowStyle = (session: ClassSession) => {
    const s = getSessionStatusStyle(session.session_status || session.status, session.attendance_status);
    return s.rowBg !== 'transparent' ? { backgroundColor: s.rowBg } : undefined;
  };

  return (
    <div className={styles.container}>
      <div className={styles.singleToolbar}>
        <div className={styles.tabBar} role="tablist" aria-label="Class schedule views">
          <button
            type="button" role="tab" aria-selected={activeTab === 'upcoming'}
            className={`${styles.tabButton} ${activeTab === 'upcoming' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('upcoming')}
          >
            <span>Upcoming Classes</span>
            <span className={styles.badge}>{loading ? '-' : upcoming.length}</span>
          </button>
          <button
            type="button" role="tab" aria-selected={activeTab === 'past'}
            className={`${styles.tabButton} ${activeTab === 'past' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('past')}
          >
            <span>Past Classes</span>
            <span className={styles.badge}>{loading && past.length === 0 ? '-' : past.length}</span>
          </button>
        </div>

        <div className={styles.flexibleSpacer} />
        {toolbarRight && <div className={styles.toolbarControls}>{toolbarRight}</div>}
      </div>

      {scheduleForm}
      {loading && displayedSessions.length === 0 && <ClassScheduleSkeleton />}

      {!loading && invalid.length > 0 && (
        <div className={styles.invalidNotice} role="status">
          ⚠️ {invalid.length} session{invalid.length > 1 ? 's have' : ' has'} invalid or missing scheduled dates and {invalid.length > 1 ? 'are' : 'is'} excluded from the schedule view.
        </div>
      )}

      {!loading && displayedSessions.length === 0 && (
        <EmptyState
          title={activeTab === 'upcoming' ? 'No upcoming classes' : 'No past classes'}
          description={activeTab === 'upcoming' ? 'No classes scheduled for now or in the future.' : 'No past scheduled classes recorded.'}
        />
      )}

      {!loading && displayedSessions.length > 0 && (
        <>
          <DataTable fixedLayout minWidth="800px" columns={columns} data={displayedSessions} keyExtractor={(c) => c.session_id} rowStyle={rowStyle} />
          {activeTab === 'past' && pagedPast.length < past.length && (
            <div style={{ textAlign: 'center', margin: '16px 0' }}>
              <button type="button" className={styles.tabButton} onClick={() => setPastPage((p) => p + 1)}>
                Load more past classes ({past.length - pagedPast.length} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {notesSession && (
        <EditSessionNotesModal
          session={notesSession} token={token} isOpen={Boolean(notesSession)}
          onClose={() => setNotesSession(null)} onSaved={refetch}
        />
      )}
    </div>
  );
};
