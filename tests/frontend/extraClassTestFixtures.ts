import { ClassSession } from '../../src/domains/classes/classTypes';
import { Package } from '../../src/domains/packages/packageTypes';
import { Student } from '../../src/domains/students/studentTypes';
import { WeeklyScheduleEntry } from '../../src/domains/classes/scheduleApi';

export const mockStudent1: Student = {
  student_id: 'stu_alice',
  student_name: 'Alice Smith',
  status: 'ACTIVE',
  subject: 'Piano',
};

export const mockStudent2: Student = {
  student_id: 'stu_bob',
  student_name: 'Bob Jones',
  status: 'ACTIVE',
  subject: 'Vocal',
};

export const mockPackage1: Package = {
  package_id: 'pkg_alice_1',
  student_id: 'stu_alice',
  classes_purchased: 10,
  total_classes: 10,
  start_date: '2026-11-02',
  end_date: '2027-01-04',
  class_duration: 60,
  class_schedule: 'MON 17:00',
  status: 'ACTIVE',
};

export const mockPackage2: Package = {
  package_id: 'pkg_bob_1',
  student_id: 'stu_bob',
  classes_purchased: 8,
  total_classes: 8,
  start_date: '2026-11-04',
  end_date: '2026-12-23',
  class_duration: 45,
  class_schedule: 'WED 16:00',
  status: 'ACTIVE',
};

export const recurringAlice: WeeklyScheduleEntry = {
  schedule_id: 'sch_alice',
  student_id: 'stu_alice',
  student_name: 'Alice Smith',
  day_of_week: 'MONDAY',
  start_time: '17:00',
  end_time: '18:00',
  is_active: true,
};

export const recurringBob: WeeklyScheduleEntry = {
  schedule_id: 'sch_bob',
  student_id: 'stu_bob',
  student_name: 'Bob Jones',
  day_of_week: 'WEDNESDAY',
  start_time: '16:00',
  end_time: '16:45',
  is_active: true,
};

export const pastSessionsAlice: ClassSession[] = [
  { session_id: 's1', student_id: 'stu_alice', schedule_date: '2026-11-02', start_time: '17:00', duration_minutes: 60, status: 'COMPLETED', session_status: 'COMPLETED', attendance_status: 'PRESENT', deduct_class: true },
  { session_id: 's2', student_id: 'stu_alice', schedule_date: '2026-11-09', start_time: '17:00', duration_minutes: 60, status: 'COMPLETED', session_status: 'COMPLETED', attendance_status: 'PRESENT', deduct_class: true },
  { session_id: 's3', student_id: 'stu_alice', schedule_date: '2026-11-16', start_time: '17:00', duration_minutes: 60, status: 'COMPLETED', session_status: 'COMPLETED', attendance_status: 'PRESENT', deduct_class: true },
  { session_id: 's4', student_id: 'stu_alice', schedule_date: '2026-11-23', start_time: '17:00', duration_minutes: 60, status: 'COMPLETED', session_status: 'COMPLETED', attendance_status: 'PRESENT', deduct_class: true },
];
