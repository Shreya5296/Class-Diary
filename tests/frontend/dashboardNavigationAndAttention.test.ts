import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  shiftDateKey, formatSelectedDateDisplay, formatEmptyStateDate,
} from '../../src/domains/dashboard/scheduleDateNavigation';
import { generateAttentionAlerts } from '../../src/domains/dashboard/attentionAlerts';
import { isSessionAttendanceOverdue, checkFeeAlert } from '../../src/domains/dashboard/attentionAlertsHelpers';
import { Student } from '../../src/domains/students/studentTypes';
import { ClassSession } from '../../src/domains/classes/classTypes';
import { ThingsThatNeedAttention } from '../../src/domains/dashboard/ThingsThatNeedAttention';
import { DashboardWelcomePanel } from '../../src/domains/dashboard/DashboardWelcomePanel';
import { AttentionAlert } from '../../src/domains/dashboard/attentionAlertTypes';

vi.mock('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { email: 'admin@infineo.io', name: 'Shreya Admin' },
    signOut: vi.fn(),
  }),
}));

describe('Dashboard Schedule Date Navigation & Boundaries', () => {
  it('correctly shifts calendar dates forward and backward without UTC drift', () => {
    expect(shiftDateKey('2026-11-19', -1)).toBe('2026-11-18');
    expect(shiftDateKey('2026-11-19', 1)).toBe('2026-11-20');
    expect(shiftDateKey('2026-11-19', 7)).toBe('2026-11-26');
    expect(shiftDateKey('2026-11-19', -19)).toBe('2026-10-31');
  });

  it('handles month boundaries properly across different month lengths', () => {
    expect(shiftDateKey('2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftDateKey('2026-02-01', -1)).toBe('2026-01-31');
    expect(shiftDateKey('2026-04-30', 1)).toBe('2026-05-01');
    expect(shiftDateKey('2026-05-01', -1)).toBe('2026-04-30');
  });

  it('handles leap year vs non-leap year February boundaries accurately', () => {
    expect(shiftDateKey('2026-02-28', 1)).toBe('2026-03-01');
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDateKey('2024-02-28', 1)).toBe('2024-02-29');
    expect(shiftDateKey('2024-02-29', 1)).toBe('2024-03-01');
    expect(shiftDateKey('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('handles year boundaries across New Year seamlessly', () => {
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDateKey('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('formats selected date display to uppercase WEEKDAY, DAY MONTH YEAR', () => {
    expect(formatSelectedDateDisplay('2026-11-19')).toBe('THURSDAY, 19 NOVEMBER 2026');
    expect(formatSelectedDateDisplay('2026-01-01')).toBe('THURSDAY, 1 JANUARY 2026');
  });

  it('formats dynamic empty state dates correctly', () => {
    expect(formatEmptyStateDate('2026-11-18')).toBe('Wednesday, 18 November');
    expect(formatEmptyStateDate('2026-11-20')).toBe('Friday, 20 November');
  });
});

describe('Dashboard Things That Need Attention - Expanded Monitoring', () => {
  const dummyStudent: Student = {
    student_id: 'STU_001',
    student_name: 'Aarav Sharma',
    status: 'ACTIVE',
    primary_meeting_link: 'https://meet.google.com/test',
  };

  it('generates Category A low balance reminders with exact required copy and severity', () => {
    // 0 classes remaining -> danger
    const alerts0 = generateAttentionAlerts({
      students: [dummyStudent],
      schedules: [{ schedule_id: 's1', student_id: 'STU_001', day_of_week: 'MONDAY', start_time: '10:00', end_time: '11:00' }],
      meetingLinks: [],
      packages: [{ student_id: 'STU_001', package_name: 'Test', total_classes: 10, classes_consumed: 10, start_date: '2026-01-01', status: 'ACTIVE' }],
    });
    const bal0 = alerts0.find((a) => a.id.startsWith('alert_balance_'));
    expect(bal0?.reason).toBe('No classes remaining — renewal required.');
    expect(bal0?.severity).toBe('danger');
    expect(bal0?.actionLabel).toBe('Renew Package');
    expect(bal0?.category).toBe('renewal');
    expect(bal0?.urgency).toBe('critical');

    // 1 class remaining -> warning
    const alerts1 = generateAttentionAlerts({
      students: [dummyStudent],
      schedules: [{ schedule_id: 's1', student_id: 'STU_001', day_of_week: 'MONDAY', start_time: '10:00', end_time: '11:00' }],
      meetingLinks: [],
      packages: [{ student_id: 'STU_001', package_name: 'Test', total_classes: 10, classes_consumed: 9, start_date: '2026-01-01', status: 'ACTIVE' }],
    });
    const bal1 = alerts1.find((a) => a.id.startsWith('alert_balance_'));
    expect(bal1?.reason).toBe('Only 1 class remaining — renewal pending.');
    expect(bal1?.severity).toBe('warning');
    expect(bal1?.category).toBe('renewal');
    expect(bal1?.urgency).toBe('pending');

    // 2 classes remaining -> warning
    const alerts2 = generateAttentionAlerts({
      students: [dummyStudent],
      schedules: [{ schedule_id: 's1', student_id: 'STU_001', day_of_week: 'MONDAY', start_time: '10:00', end_time: '11:00' }],
      meetingLinks: [],
      packages: [{ student_id: 'STU_001', package_name: 'Test', total_classes: 10, classes_consumed: 8, start_date: '2026-01-01', status: 'ACTIVE' }],
    });
    const bal2 = alerts2.find((a) => a.id.startsWith('alert_balance_'));
    expect(bal2?.reason).toBe('Only 2 classes remaining — renewal pending.');
    expect(bal2?.severity).toBe('warning');

    // 3 classes remaining -> warning
    const alerts3 = generateAttentionAlerts({
      students: [dummyStudent],
      schedules: [{ schedule_id: 's1', student_id: 'STU_001', day_of_week: 'MONDAY', start_time: '10:00', end_time: '11:00' }],
      meetingLinks: [],
      packages: [{ student_id: 'STU_001', package_name: 'Test', total_classes: 10, classes_consumed: 7, start_date: '2026-01-01', status: 'ACTIVE' }],
    });
    const bal3 = alerts3.find((a) => a.id.startsWith('alert_balance_'));
    expect(bal3?.reason).toBe('Only 3 classes remaining — renewal pending.');
    expect(bal3?.severity).toBe('warning');
  });

  it('evaluates Category C unmarked attendance: only classes whose end time is over appear (Fix F2)', () => {
    const pastStart = new Date('2026-11-19T10:00:00Z').getTime();
    // Class ends at 11:00:00Z (60 min duration)
    const session: ClassSession = {
      session_id: 'sess_1',
      student_id: 'STU_001',
      start_time: '2026-11-19T10:00:00Z',
      duration_minutes: 60,
      status: 'SCHEDULED',
      attendance_status: 'NOT_MARKED',
    };

    // Class that ended 5 minutes ago (11:05:00Z) -> true (shows)
    expect(isSessionAttendanceOverdue(session, pastStart + 65 * 60 * 1000)).toBe(true);

    // Yesterday's class -> true (shows)
    expect(isSessionAttendanceOverdue(session, pastStart + 24 * 60 * 60 * 1000)).toBe(true);

    // Class currently running (started 30 mins ago, 10:30:00Z) -> false (does not show)
    expect(isSessionAttendanceOverdue(session, pastStart + 30 * 60 * 1000)).toBe(false);

    // Class starting in 1 hour (09:00:00Z) -> false (does not show)
    expect(isSessionAttendanceOverdue(session, pastStart - 60 * 60 * 1000)).toBe(false);

    // Class next week -> false (does not show)
    expect(isSessionAttendanceOverdue(session, pastStart - 7 * 24 * 60 * 60 * 1000)).toBe(false);

    // Cancelled class should never trigger unmarked alert
    const cancelledSession: ClassSession = { ...session, session_status: 'CANCELLED' };
    expect(isSessionAttendanceOverdue(cancelledSession, pastStart + 120 * 60 * 1000)).toBe(false);

    // Attended class should never trigger unmarked alert
    const attendedSession: ClassSession = { ...session, attendance_status: 'ATTENDED' };
    expect(isSessionAttendanceOverdue(attendedSession, pastStart + 120 * 60 * 1000)).toBe(false);
  });

  it('evaluates Category B fee alerts for overdue and upcoming due dates', () => {
    // Overdue fee
    const overdue = checkFeeAlert(
      { fee_id: 'f1', amount_due: 5000, outstanding_balance: 5000, due_date: '2026-11-10', status: 'PENDING' },
      '2026-11-19'
    );
    expect(overdue?.severity).toBe('danger');
    expect(overdue?.urgency).toBe('critical');
    expect(overdue?.reason).toContain('Fee overdue: ₹5,000');

    // Due within 7 days
    const dueSoon = checkFeeAlert(
      { fee_id: 'f2', amount_due: 3500, outstanding_balance: 3500, due_date: '2026-11-23', status: 'PENDING' },
      '2026-11-19'
    );
    expect(dueSoon?.severity).toBe('warning');
    expect(dueSoon?.urgency).toBe('upcoming');
    expect(dueSoon?.reason).toBe('Fee due on 2026-11-23: ₹3,500');

    // Due in 15 days (> 7 days) -> no alert
    const dueFar = checkFeeAlert(
      { fee_id: 'f3', amount_due: 3500, outstanding_balance: 3500, due_date: '2026-12-10', status: 'PENDING' },
      '2026-11-19'
    );
    expect(dueFar).toBeNull();

    // Fully paid fee -> no alert
    const paid = checkFeeAlert(
      { fee_id: 'f4', amount_due: 5000, outstanding_balance: 0, due_date: '2026-11-10', status: 'PAID' },
      '2026-11-19'
    );
    expect(paid).toBeNull();
  });

  it('accurately groups alerts by urgency into Critical, Pending, and Upcoming without double counting', () => {
    const alerts = generateAttentionAlerts({
      students: [dummyStudent],
      schedules: [], // missing schedule -> category: schedule, urgency: pending
      meetingLinks: [], // dummyStudent has meeting link -> no alert
      packages: [{ student_id: 'STU_001', package_name: 'Pack', total_classes: 10, classes_consumed: 10, start_date: '2026-01-01', status: 'ACTIVE' }], // 0 classes -> category: renewal, urgency: critical
      fees: [
        { fee_id: 'f_overdue', student_id: 'STU_001', outstanding_balance: 4000, due_date: '2026-11-01', status: 'OVERDUE' }, // category: fee, urgency: critical
        { fee_id: 'f_due_soon', student_id: 'STU_001', outstanding_balance: 2500, due_date: '2026-11-24', status: 'PENDING' }, // category: fee, urgency: upcoming
      ],
      referenceDateStr: '2026-11-19',
    });

    const criticalCount = alerts.filter((a) => a.urgency === 'critical').length;
    const pendingCount = alerts.filter((a) => a.urgency === 'pending').length;
    const upcomingCount = alerts.filter((a) => a.urgency === 'upcoming').length;

    // Critical: zero balance + overdue fee = 2
    expect(criticalCount).toBe(2);
    // Pending: missing schedule = 1
    expect(pendingCount).toBe(1);
    // Upcoming: fee due soon = 1
    expect(upcomingCount).toBe(1);

    // Sum of categorized counts must equal total alerts (no double counting)
    expect(criticalCount + pendingCount + upcomingCount).toBe(alerts.length);
  });
});

describe('Dashboard Welcome Panel & Profile Image Storage', () => {
  it('validates image file types and size limits', async () => {
    const { validateImageFile } = await import('../../src/domains/dashboard/profileImageStorage');

    // Valid PNG
    const validPng = new File(['fake-png-content'], 'avatar.png', { type: 'image/png' });
    expect(validateImageFile(validPng).valid).toBe(true);

    // Valid JPEG
    const validJpg = new File(['fake-jpg-content'], 'avatar.jpg', { type: 'image/jpeg' });
    expect(validateImageFile(validJpg).valid).toBe(true);

    // Valid WebP
    const validWebp = new File(['fake-webp-content'], 'avatar.webp', { type: 'image/webp' });
    expect(validateImageFile(validWebp).valid).toBe(true);

    // Invalid file type (PDF)
    const invalidPdf = new File(['fake-pdf'], 'document.pdf', { type: 'application/pdf' });
    const pdfResult = validateImageFile(invalidPdf);
    expect(pdfResult.valid).toBe(false);
    expect(pdfResult.error).toContain('valid image file');

    // Oversized image (> 5 MB)
    const bigArray = new Uint8Array(5.5 * 1024 * 1024);
    const oversizedFile = new File([bigArray], 'huge.png', { type: 'image/png' });
    const sizeResult = validateImageFile(oversizedFile);
    expect(sizeResult.valid).toBe(false);
    expect(sizeResult.error).toContain('5 MB limit');
  });

  it('persists and deletes profile images in local storage fallback', async () => {
    const {
      getStoredProfileImage, saveStoredProfileImage, deleteStoredProfileImage,
    } = await import('../../src/domains/dashboard/profileImageStorage');

    const sampleDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    await saveStoredProfileImage(sampleDataUrl);
    const loaded = await getStoredProfileImage();
    expect(loaded).toBe(sampleDataUrl);

    await deleteStoredProfileImage();
    const afterDelete = await getStoredProfileImage();
    expect(afterDelete).toBeNull();
  });

  it('renders edit profile picture button with pencil icon and correct aria-label', () => {
    const html = renderToString(React.createElement(DashboardWelcomePanel));
    expect(html).toContain('aria-label="Edit profile picture"');
    // SVG pencil path verification
    expect(html).toContain('d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"');
    // Camera SVG path should NOT be present
    expect(html).not.toContain('d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"');
  });

  it('renders all attention items categorized without View All or truncation when alerts > 2', () => {
    const mockAlerts: AttentionAlert[] = [
      { id: '1', studentId: 's1', studentName: 'Alice', reason: 'Attendance pending', severity: 'warning', actionLabel: 'Mark Attendance', targetSection: 'classes', category: 'attendance', urgency: 'pending' },
      { id: '2', studentId: 's2', studentName: 'Bob', reason: 'Fee overdue: ₹5,000', severity: 'danger', actionLabel: 'Collect Fee', targetSection: 'finances', category: 'fee', urgency: 'critical' },
      { id: '3', studentId: 's3', studentName: 'Charlie', reason: '0 classes remaining', severity: 'danger', actionLabel: 'Renew Package', targetSection: 'students', category: 'renewal', urgency: 'critical' },
      { id: '4', studentId: 's4', studentName: 'David', reason: 'Fee due soon: ₹2,000', severity: 'warning', actionLabel: 'Send Reminder', targetSection: 'finances', category: 'fee', urgency: 'upcoming' },
    ];

    const html = renderToString(
      React.createElement(ThingsThatNeedAttention, {
        alerts: mockAlerts,
        onNavigate: vi.fn(),
      })
    );

    // All 4 alerts must be rendered directly
    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
    expect(html).toContain('Charlie');
    expect(html).toContain('David');

    // Category headers must be rendered
    expect(html).toContain('Student Renewals');
    expect(html).toContain('Fee Reminders');
    expect(html).toContain('Attendance Pending');

    // View all, Show less, and more issues note must NOT be rendered
    expect(html).not.toContain('View all');
    expect(html).not.toContain('Show less');
    expect(html).not.toContain('more pending');
  });

  it('renders zero state caught up banner when alerts list is empty', () => {
    const html = renderToString(
      React.createElement(ThingsThatNeedAttention, {
        alerts: [],
        onNavigate: vi.fn(),
      })
    );
    expect(html).toContain("You&#x27;re all caught up!");
    expect(html).toContain('No pending administrative actions.');
  });
});
