import { useState, useEffect, useCallback, useMemo } from 'react';
import { ClassSession } from './classTypes';
import { fetchClasses } from './classApi';
import { WeeklyScheduleEntry } from './scheduleApi';
import { fetchPackages } from '../packages/packageApi';
import { fetchStudents } from '../students/studentApi';
import { Student } from '../students/studentTypes';
import { Package } from '../packages/packageTypes';
import { parseCanonicalScheduleString } from '../students/scheduleFormatter';
import { useOptionalAppData } from '../../context/AppDataContext';

export function useClassScheduleData(
  studentId?: string,
  token?: string | null,
  activeTab: 'upcoming' | 'past' = 'upcoming'
) {
  const ctx = useOptionalAppData();
  const cached = (!studentId && ctx?.dashboardData) ? ctx.dashboardData : null;

  const [upcomingSessions, setUpcomingSessions] = useState<ClassSession[]>(() => cached?.classes || []);
  const [pastSessions, setPastSessions] = useState<ClassSession[]>([]);
  const [pastLoaded, setPastLoaded] = useState(false);
  const [pastLoading, setPastLoading] = useState(false);
  const [packages, setPackages] = useState<Package[]>(() => cached?.packages || []);
  const [students, setStudents] = useState<Student[]>(() => cached?.students || []);
  const [loading, setLoading] = useState(() => !cached);

  const loadBaseData = useCallback(async (isBg = false) => {
    if (!isBg) setLoading(true);
    try {
      const [cls, pkgs, stuList] = await Promise.all([
        fetchClasses(studentId, token, { scope: 'upcoming' }).catch(() => []),
        fetchPackages(studentId, token).catch(() => []),
        studentId ? fetchStudents({ query: studentId }, token).catch(() => []) : fetchStudents({}, token).catch(() => []),
      ]);
      setUpcomingSessions(cls);
      setPackages(pkgs);
      setStudents(stuList);
    } finally {
      setLoading(false);
    }
  }, [studentId, token]);

  const loadPastData = useCallback(async () => {
    if (pastLoaded || pastLoading) return;
    setPastLoading(true);
    try {
      const pastList = await fetchClasses(studentId, token, { scope: 'past' }).catch(() => []);
      setPastSessions(pastList);
      setPastLoaded(true);
    } finally {
      setPastLoading(false);
    }
  }, [studentId, token, pastLoaded, pastLoading]);

  useEffect(() => { loadBaseData(Boolean(cached)); }, [loadBaseData, Boolean(cached)]);

  useEffect(() => {
    if (activeTab === 'past' && !pastLoaded && !pastLoading) loadPastData();
  }, [activeTab, pastLoaded, pastLoading, loadPastData]);

  const refetch = useCallback(async () => {
    setPastLoaded(false);
    await loadBaseData(false);
    if (activeTab === 'past') {
      const pastList = await fetchClasses(studentId, token, { scope: 'past' }).catch(() => []);
      setPastSessions(pastList);
      setPastLoaded(true);
    }
  }, [loadBaseData, activeTab, studentId, token]);

  const sessions = useMemo(() => [...upcomingSessions, ...pastSessions], [upcomingSessions, pastSessions]);

  const getStudentConsumedClasses = (sid: string): { consumed: number; purchased: number } => {
    const stuPkgs = packages.filter((p) => p.student_id === sid);
    let purchased = 0, consumed = 0;
    for (const p of stuPkgs) {
      purchased += Number(p.classes_purchased !== undefined ? p.classes_purchased : p.total_classes) || 0;
      consumed += Number(p.consumed_classes !== undefined ? p.consumed_classes : p.classes_consumed) || 0;
    }
    return { consumed, purchased };
  };

  const getStudentSchedule = (sid: string): WeeklyScheduleEntry[] => {
    const stuPkgs = packages.filter((p) => p.student_id === sid);
    const activePkg = stuPkgs.find((p) => p.status === 'ACTIVE' && Boolean(p.class_schedule)) || stuPkgs.find((p) => Boolean(p.class_schedule)) || stuPkgs[0];
    return activePkg && activePkg.class_schedule ? parseCanonicalScheduleString(activePkg.class_schedule, Number(activePkg.class_duration) || 60) : [];
  };

  const getStudentMeetingLink = (sid: string): any => {
    const s = students.find((st) => st.student_id === sid);
    return s ? {
      student_id: s.student_id, student_name: s.student_name,
      primary_meeting_link: s.primary_meeting_link || '',
      meeting_link_1: s.primary_meeting_link || '',
      meeting_url: s.primary_meeting_link || '',
    } : undefined;
  };

  return {
    sessions, upcomingSessions, pastSessions, pastLoaded, pastLoading,
    packages, students, loading: loading || (activeTab === 'past' && pastLoading && pastSessions.length === 0),
    refetch, getStudentConsumedClasses, getStudentSchedule, getStudentMeetingLink,
  };
}
