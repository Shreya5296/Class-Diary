import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { parseCanonicalScheduleString } from '../students/scheduleFormatter';
import { WeeklyScheduleEntry } from '../classes/scheduleApi';
import { fetchDashboardCombined, DashboardCombinedData } from '../../api/combinedApi';

export function useDashboardData(token?: string | null) {
  let ctx: ReturnType<typeof useAppData> | null = null;
  try {
    ctx = useAppData();
  } catch {
    ctx = null;
  }

  const [localData, setLocalData] = useState<DashboardCombinedData | null>(null);
  const [localLoading, setLocalLoading] = useState(!localData);
  const [localError, setLocalError] = useState<string | null>(null);

  const getDash = ctx?.getDashboard;

  const loadData = useCallback(async (force = false) => {
    if (getDash) {
      await getDash(token, force);
    } else {
      setLocalLoading(true);
      try {
        const res = await fetchDashboardCombined(token);
        setLocalData(res);
      } catch (err: unknown) {
        setLocalError((err as Error).message || 'Failed to load dashboard data');
      } finally {
        setLocalLoading(false);
      }
    }
  }, [getDash, token]);

  useEffect(() => {
    loadData(false);
  }, [token, getDash]);

  const data = ctx ? ctx.dashboardData : localData;
  const loading = ctx ? (!ctx.dashboardData && !ctx.dashboardError && ctx.dashboardLoading) : localLoading;
  const error = ctx ? ctx.dashboardError : localError;

  const schedules = useMemo(() => {
    if (!data) return [];
    let finalScheds = data.schedules || [];
    if (finalScheds.length === 0 && data.packages?.length > 0) {
      const extracted: WeeklyScheduleEntry[] = [];
      for (const p of data.packages) {
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
    return finalScheds;
  }, [data]);

  const meetingLinks = useMemo(() => {
    if (!data?.students) return [];
    return data.students.map((s) => ({
      meeting_link_id: `ml_${s.student_id}`,
      student_id: s.student_id,
      student_name: s.student_name,
      meeting_link_1: s.primary_meeting_link || '',
      meeting_url: s.primary_meeting_link || '',
      provider: 'GOOGLE_MEET' as const,
      is_preferred: true,
    }));
  }, [data?.students]);

  return {
    overview: data?.overview || null,
    classes: data?.classes || [],
    schedules,
    students: data?.students || [],
    packages: data?.packages || [],
    meetingLinks,
    fees: data?.fees || [],
    loading,
    error,
    refreshData: () => loadData(true),
  };
}
