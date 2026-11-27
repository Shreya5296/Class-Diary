import { Student, StudentInput } from './studentTypes';
import { PackageFormData } from './EditStudentPackageSection';
import { Package } from '../packages/packageTypes';
import { ScheduleItem } from './registrationTypes';
import { WeeklyScheduleEntry, saveSchedules } from '../classes/scheduleApi';
import { updateStudent } from './studentApi';
import { createPackage, updatePackage } from '../packages/packageApi';
import { calculateEndTime } from '../classes/scheduleDurationCalculator';
import { formatCanonicalScheduleString } from './scheduleFormatter';
import { generatePackageClasses } from '../classes/packageClassGeneratorApi';
import { invalidateAppData } from '../../context/AppDataContext';

export interface SubmitEditStudentParams {
  student: Student;
  studentData: StudentInput;
  meetingLink?: string;
  meetingLinks?: { link1: string; link2?: string };
  packageData: PackageFormData;
  existingPkg: Package | null;
  schedules: ScheduleItem[];
  firstClassDate?: string;
  autoSchedule?: boolean;
  dur?: number;
  token?: string | null;
}

export async function submitEditStudent(params: SubmitEditStudentParams): Promise<{
  updatedStudent: Student;
  successMessage: string;
}> {
  const {
    student, studentData, packageData, existingPkg,
    schedules, firstClassDate, autoSchedule, dur, token,
  } = params;

  const linkToSave = params.meetingLink !== undefined
    ? params.meetingLink.trim()
    : (params.meetingLinks?.link1 !== undefined ? params.meetingLinks.link1.trim() : studentData.primary_meeting_link);

  const preservedData = {
    ...studentData,
    status: studentData.status ? String(studentData.status).trim().toUpperCase() : 'ACTIVE',
    student_phone: studentData.student_phone !== undefined ? studentData.student_phone : (student.student_phone || ''),
    student_email: studentData.student_email !== undefined ? studentData.student_email : (student.student_email || ''),
    notes: studentData.notes !== undefined ? studentData.notes : (student.notes || ''),
    primary_meeting_link: linkToSave !== undefined ? linkToSave : (student.primary_meeting_link || ''),
  };

  const updatedStu = await updateStudent(student.student_id, preservedData, token);

  const hasPkg = packageData.package_price.trim() || packageData.classes_purchased.trim() || packageData.class_duration;
  const durNum = dur || undefined;
  let currentPkgId = existingPkg?.package_id;

  const schedsToSave: WeeklyScheduleEntry[] = schedules.map((s) => ({
    schedule_id: (s.id && !s.id.startsWith('temp_') && !/^\d+$/.test(s.id)) ? s.id : undefined,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time || calculateEndTime(s.start_time, dur || 60) || '',
  }));
  const schedStr = formatCanonicalScheduleString(schedsToSave);

  if (hasPkg) {
    const pkgTargetId = existingPkg?.package_id || student.student_id;
    if (packageData.mode === 'EDIT_EXISTING' && existingPkg) {
      await updatePackage(pkgTargetId, {
        student_id: student.student_id,
        plan_type: packageData.plan_type,
        currency: packageData.currency,
        package_price: Number(packageData.package_price || 0),
        per_class: Number(packageData.per_class || 0),
        total_classes: Number(packageData.classes_purchased || 0),
        classes_purchased: Number(packageData.classes_purchased || 0),
        class_duration: durNum,
        class_schedule: schedStr,
        start_date: firstClassDate || existingPkg.start_date,
        end_date: packageData.end_date,
      }, token);
    } else if (packageData.classes_purchased || packageData.package_price) {
      const created = await createPackage({
        student_id: student.student_id,
        student_name: updatedStu.student_name,
        package_name: `${updatedStu.student_name} ${packageData.plan_type}`,
        plan_type: packageData.plan_type,
        currency: packageData.currency,
        package_price: Number(packageData.package_price || 0),
        per_class: Number(packageData.per_class || 0),
        total_classes: Number(packageData.classes_purchased || 0),
        classes_purchased: Number(packageData.classes_purchased || 0),
        class_duration: durNum,
        class_schedule: schedStr,
        start_date: firstClassDate || new Date().toISOString().slice(0, 10),
        end_date: packageData.end_date,
      }, token);
      currentPkgId = created.package_id || student.student_id;
    }
  }

  await saveSchedules(student.student_id, schedsToSave, token);

  let successMessage = 'Student details saved successfully';

  if (autoSchedule && firstClassDate && schedsToSave.length > 0) {
    try {
      await generatePackageClasses(student.student_id, token, {
        regenerateFuture: true,
        startDate: firstClassDate,
        packageId: currentPkgId,
      });
      successMessage = 'Class schedule and sessions updated successfully.';
    } catch (e) {
      console.warn('Auto-generation of future package classes:', e);
    }
  } else if (schedsToSave.length > 0) {
    // Automatically regenerate future package classes when schedule is added or edited
    try {
      await generatePackageClasses(student.student_id, token, {
        regenerateFuture: true,
        startDate: firstClassDate || undefined,
        packageId: currentPkgId,
      });
    } catch (e) {
      console.warn('Auto-generation of future package classes:', e);
    }
  }

  invalidateAppData('all');
  return { updatedStudent: updatedStu, successMessage };
}
