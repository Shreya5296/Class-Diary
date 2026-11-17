import { useState, useEffect, useCallback } from 'react';
import { fetchDashboardOverview } from './dashboardApi';
import { fetchClasses } from '../classes/classApi';
import { fetchSchedules, WeeklyScheduleEntry } from '../classes/scheduleApi';
import { parseCanonicalScheduleString } from '../students/scheduleFormatter';
import { fetchStudents } from '../students/studentApi';
import { fetchPackages } from '../packages/packageApi';
import { ClassSession } from '../classes/classTypes';
import { Student } from '../students/studentTypes';
import { Package } from '../packages/packageTypes';
import { DashboardOverviewData } from './dashboardTypes';

export function useDashboardData(token?: string | null) {
  const [overview, setOverview] = useState<DashboardOverviewData | null>(null);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [schedules, setSchedules] = useState<WeeklyScheduleEntry[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [meetingLinks, setMeetingLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, cls, schedList, stuList, pkgList] = await Promise.all([
        fetchDashboardOverview(token),
        fetchClasses(undefined, token).catch(() => []),
        fetchSchedules(undefined, token).catch(() => []),
        fetchStudents({}, token).catch(() => []),
        fetchPackages(undefined, token).catch(() => []),
      ]);
      let finalScheds = schedList;
      if (finalScheds.length === 0 && pkgList.length > 0) {
        const extracted: WeeklyScheduleEntry[] = [];
        for (const p of pkgList) {
          if (p.class_schedule) {
            const parsed = parseCanonicalScheduleString(p.class_schedule, Number(p.class_duration) || 60);
            for (const entry of parsed) {
              entry.student_id = p.student_id;
              entry.student_name = p.student_name;
              extracted.push(entry);
            }
          }
        }
        if (extracted.length > 0) finalScheds = extracted;
      }
      setOverview(ov);
      setClasses(cls);
      setSchedules(finalScheds);
      setStudents(stuList);
      setPackages(pkgList);
      const derived = stuList.map((s) => ({
        student_id: s.student_id,
        student_name: s.student_name,
        meeting_link_1: s.primary_meeting_link || '',
        meeting_url: s.primary_meeting_link || '',
      }));
      setMeetingLinks(derived);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    overview,
    classes,
    schedules,
    students,
    packages,
    meetingLinks,
    loading,
    error,
    refreshData: loadData,
  };
}
