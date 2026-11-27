import { Student } from '../students/studentTypes';
import { Package } from '../packages/packageTypes';
import { Payment } from '../payments/paymentTypes';
import { MeetingLink } from '../meeting-links/meetingLinkTypes';
import { WeeklyScheduleEntry } from '../classes/scheduleApi';
import { ClassSession } from '../classes/classTypes';
import { NavSection } from '../../layout/Sidebar';

export type AttentionCategory = 'renewal' | 'fee' | 'attendance' | 'schedule' | 'other';
export type AttentionUrgency = 'critical' | 'pending' | 'upcoming';

export interface AttentionAlert {
  id: string;
  studentId: string;
  studentName: string;
  reason: string;
  severity: 'warning' | 'danger' | 'info';
  actionLabel: string;
  targetSection: NavSection;
  student?: Student;
  category: AttentionCategory;
  urgency: AttentionUrgency;
  sessionId?: string;
  session?: ClassSession;
  classDate?: string;
  formattedClassDate?: string;
}

export interface AttentionAlertParams {
  students: Student[];
  schedules: WeeklyScheduleEntry[];
  meetingLinks: MeetingLink[];
  packages: Package[];
  payments?: Payment[];
  sessions?: ClassSession[];
  fees?: any[];
  activeTz?: string;
  referenceDateStr?: string;
  currentTimestampMs?: number;
}
