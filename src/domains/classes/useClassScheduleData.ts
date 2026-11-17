import { useState, useEffect, useCallback } from 'react';
import { ClassSession } from './classTypes';
import { fetchClasses } from './classApi';
import { WeeklyScheduleEntry } from './scheduleApi';
import { fetchPackages } from '../packages/packageApi';
import { fetchStudents } from '../students/studentApi';
import { Student } from '../students/studentTypes';
import { Package } from '../packages/packageTypes';
import { parseCanonicalScheduleString } from '../students/scheduleFormatter';

export function useClassScheduleData(studentId?: string, token?: string | null) {
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cls, pkgs, stuList] = await Promise.all([
        fetchClasses(studentId, token).catch(() => []),
        fetchPackages(studentId, token).catch(() => []),
        studentId ? fetchStudents({ query: studentId }, token).catch(() => []) : fetchStudents({}, token).catch(() => []),
      ]);
      setSessions(cls);
      setPackages(pkgs);
      setStudents(stuList);
    } finally {
      setLoading(false);
    }
  }, [studentId, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getStudentConsumedClasses = (sid: string): { consumed: number; purchased: number } => {
    const stuPkgs = packages.filter((p) => p.student_id === sid);
    let purchased = 0;
    let consumed = 0;
    for (const p of stuPkgs) {
      purchased += Number(p.classes_purchased !== undefined ? p.classes_purchased : p.total_classes) || 0;
      consumed += Number(p.consumed_classes !== undefined ? p.consumed_classes : p.classes_consumed) || 0;
    }
    return { consumed, purchased };
  };

  const getStudentSchedule = (sid: string): WeeklyScheduleEntry[] => {
    const stuPkgs = packages.filter((p) => p.student_id === sid);
    const activePkg =
      stuPkgs.find((p) => p.status === 'ACTIVE' && Boolean(p.class_schedule)) ||
      stuPkgs.find((p) => Boolean(p.class_schedule)) ||
      stuPkgs[0];
    if (activePkg && activePkg.class_schedule) {
      return parseCanonicalScheduleString(
        activePkg.class_schedule,
        Number(activePkg.class_duration) || 60
      );
    }
    return [];
  };

  const getStudentMeetingLink = (sid: string): any => {
    const s = students.find((st) => st.student_id === sid);
    if (!s) return undefined;
    return {
      student_id: s.student_id,
      student_name: s.student_name,
      primary_meeting_link: s.primary_meeting_link || '',
      meeting_link_1: s.primary_meeting_link || '',
      meeting_url: s.primary_meeting_link || '',
    };
  };

  return {
    sessions,
    packages,
    students,
    loading,
    refetch: loadData,
    getStudentConsumedClasses,
    getStudentSchedule,
    getStudentMeetingLink,
  };
}
