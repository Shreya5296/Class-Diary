import { useState, useEffect } from 'react';
import { Student } from './studentTypes';
import { Package } from '../packages/packageTypes';
import { PackageFormData } from './EditStudentPackageSection';
import { ScheduleItem } from './registrationTypes';
import { fetchPackages } from '../packages/packageApi';
import { parseCanonicalScheduleString } from './scheduleFormatter';

export function useEditStudentInitialData(student: Student, token?: string | null) {
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [meetingLink, setMeetingLink] = useState(student.primary_meeting_link || '');
  const [existingPkg, setExistingPkg] = useState<Package | null>(null);
  const [packageData, setPackageData] = useState<PackageFormData>({
    mode: 'EDIT_EXISTING',
    plan_type: 'Package',
    currency: 'INR',
    package_price: '',
    per_class: '',
    classes_purchased: '',
    class_duration: '',
    end_date: '',
  });
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    setMeetingLink(student.primary_meeting_link || '');
    fetchPackages(student.student_id, token)
      .catch(() => [])
      .then((pkgs) => {
        if (!isMounted) return;
        if (pkgs.length > 0) {
          const p = pkgs[0];
          setExistingPkg(p);
          const dur = p.class_duration || p.duration_minutes;
          setPackageData({
            mode: 'EDIT_EXISTING',
            package_id: p.package_id,
            plan_type: p.plan_type || 'Package',
            currency: p.currency || 'INR',
            package_price: p.package_price !== undefined ? String(p.package_price) : (p.price !== undefined ? String(p.price) : ''),
            per_class: p.per_class !== undefined ? String(p.per_class) : '',
            classes_purchased: p.classes_purchased !== undefined ? String(p.classes_purchased) : (p.total_classes !== undefined ? String(p.total_classes) : ''),
            class_duration: dur ? String(dur) : '',
            end_date: p.end_date || p.expiry_date || '',
          });
        }
        let activeScheds: Array<{ schedule_id?: string; day_of_week: string; start_time: string; end_time: string }> = [];
        if (pkgs.length > 0 && pkgs[0].class_schedule) {
          activeScheds = parseCanonicalScheduleString(pkgs[0].class_schedule, Number(pkgs[0].class_duration) || 60);
        }
        setSchedules(activeScheds.map((s, idx) => ({
          id: s.schedule_id || String(idx),
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
        })));
        setLoadingInitial(false);
      });
    return () => { isMounted = false; };
  }, [student.student_id, student.primary_meeting_link, token]);

  return {
    loadingInitial,
    meetingLink,
    setMeetingLink,
    // Keep meetingLinks object accessor for backward-compat if needed
    meetingLinks: { link1: meetingLink, link2: '' },
    setMeetingLinks: (updater: any) => {
      if (typeof updater === 'function') {
        const next = updater({ link1: meetingLink, link2: '' });
        setMeetingLink(next.link1 || '');
      } else if (updater && updater.link1 !== undefined) {
        setMeetingLink(updater.link1 || '');
      }
    },
    existingPkg,
    packageData,
    setPackageData,
    schedules,
    setSchedules,
  };
}
