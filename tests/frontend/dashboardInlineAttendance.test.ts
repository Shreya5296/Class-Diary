import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { generateAttentionAlerts } from '../../src/domains/dashboard/attentionAlerts';
import { formatAlertClassDate } from '../../src/domains/dashboard/attentionAlertsHelpers';
import { ThingsThatNeedAttention } from '../../src/domains/dashboard/ThingsThatNeedAttention';
import { InlineAttendanceAlertRow } from '../../src/domains/dashboard/InlineAttendanceAlertRow';
import { AttentionAlert } from '../../src/domains/dashboard/attentionAlertTypes';
import { ClassSession } from '../../src/domains/classes/classTypes';
import * as classApi from '../../src/domains/classes/classApi';

vi.mock('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { email: 'admin@infineo.io', name: 'Shreya Admin' },
    token: 'test_token_123',
    signOut: vi.fn(),
  }),
}));

describe('Dashboard Inline Attendance — Class Date & Multiple Sessions', () => {
  it('formats class date consistently into weekday, day month year', () => {
    expect(formatAlertClassDate('2026-11-18')).toBe('Wednesday, 18 November 2026');
    expect(formatAlertClassDate('2026-11-16')).toBe('Monday, 16 November 2026');
    expect(formatAlertClassDate('2026-01-01')).toBe('Thursday, 1 January 2026');
    expect(formatAlertClassDate('')).toBe('');
    expect(formatAlertClassDate(undefined)).toBe('');
  });

  it('generates distinct, identifiable alerts with exact dates for multiple pending sessions of the same student', () => {
    const student = { student_id: 'STU_KRI', student_name: 'Krishnavi', status: 'ACTIVE' };
    const sessions: ClassSession[] = [
      {
        session_id: 'sess_kri_18',
        student_id: 'STU_KRI',
        student_name: 'Krishnavi',
        schedule_date: '2026-11-18',
        schedule_time: '10:00',
        start_time: '2026-11-18T10:00:00Z',
        duration_minutes: 60,
        status: 'SCHEDULED',
        attendance_status: 'NOT_MARKED',
      },
      {
        session_id: 'sess_kri_16',
        student_id: 'STU_KRI',
        student_name: 'Krishnavi',
        schedule_date: '2026-11-16',
        schedule_time: '11:00',
        start_time: '2026-11-16T11:00:00Z',
        duration_minutes: 60,
        status: 'SCHEDULED',
        attendance_status: 'NOT_MARKED',
      },
    ];

    // Reference time: 2026-11-19 (both sessions are overdue)
    const alerts = generateAttentionAlerts({
      students: [student],
      schedules: [],
      meetingLinks: [],
      packages: [],
      sessions,
      currentTimestampMs: new Date('2026-11-19T12:00:00Z').getTime(),
      activeTz: 'Asia/Kolkata',
    });

    const attAlerts = alerts.filter((a) => a.category === 'attendance');
    expect(attAlerts.length).toBe(2);

    const alert18 = attAlerts.find((a) => a.sessionId === 'sess_kri_18');
    expect(alert18).toBeDefined();
    expect(alert18?.studentName).toBe('Krishnavi');
    expect(alert18?.classDate).toBe('2026-11-18');
    expect(alert18?.formattedClassDate).toBe('Wednesday, 18 November 2026');

    const alert16 = attAlerts.find((a) => a.sessionId === 'sess_kri_16');
    expect(alert16).toBeDefined();
    expect(alert16?.studentName).toBe('Krishnavi');
    expect(alert16?.classDate).toBe('2026-11-16');
    expect(alert16?.formattedClassDate).toBe('Monday, 16 November 2026');
  });

  it('handles missing class date safely without inventing dates', () => {
    const student = { student_id: 'STU_NODATE', student_name: 'NoDate Student', status: 'ACTIVE' };
    const session: ClassSession = {
      session_id: 'sess_nodate',
      student_id: 'STU_NODATE',
      start_time: '2026-11-10T10:00:00Z',
      duration_minutes: 60,
      status: 'SCHEDULED',
      attendance_status: 'NOT_MARKED',
    };

    const alerts = generateAttentionAlerts({
      students: [student],
      schedules: [],
      meetingLinks: [],
      packages: [],
      sessions: [session],
      currentTimestampMs: new Date('2026-11-19T12:00:00Z').getTime(),
    });

    const attAlert = alerts.find((a) => a.sessionId === 'sess_nodate');
    expect(attAlert).toBeDefined();
    expect(attAlert?.classDate).toBeTruthy();
  });
});

describe('Dashboard Inline Attendance — Markup & Inline Actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockAlert: AttentionAlert = {
    id: 'alert_att_sess_101',
    sessionId: 'sess_101',
    studentId: 'STU_001',
    studentName: 'Krishnavi',
    classDate: '2026-11-18',
    formattedClassDate: 'Wednesday, 18 November 2026',
    reason: 'Attendance not marked',
    severity: 'warning',
    actionLabel: 'Mark Attendance',
    targetSection: 'classes',
    category: 'attendance',
    urgency: 'pending',
  };

  it('renders unexpanded row displaying student name, class date, and Attendance not marked', () => {
    const html = renderToString(
      React.createElement(InlineAttendanceAlertRow, {
        alert: mockAlert,
        isExpanded: false,
        onToggle: vi.fn(),
      })
    );

    expect(html).toContain('Krishnavi');
    expect(html).toContain('Class date: Wednesday, 18 November 2026');
    expect(html).toContain('Attendance not marked');
    expect(html).toContain('Mark Attendance →');
    expect(html).not.toContain('Select attendance status:');
  });

  it('renders expanded row with Present, Absent, and Rescheduled buttons', () => {
    const html = renderToString(
      React.createElement(InlineAttendanceAlertRow, {
        alert: mockAlert,
        isExpanded: true,
        onToggle: vi.fn(),
      })
    );

    expect(html).toContain('Krishnavi');
    expect(html).toContain('Class date: Wednesday, 18 November 2026');
    expect(html).not.toContain('Select attendance status:');
    expect(html).toContain('Enter attendance notes...');
    expect(html).toContain('Present');
    expect(html).toContain('Absent');
    expect(html).toContain('Rescheduled');
    expect(html).toContain('Cancel');
  });

  it('submits Present action with notes to recordAttendance and triggers onRefresh', async () => {
    const recordSpy = vi.spyOn(classApi, 'recordAttendance').mockResolvedValue({} as any);
    const refreshSpy = vi.fn().mockResolvedValue(undefined);

    // Call recordAttendance directly with notes
    await classApi.recordAttendance('sess_101', 'PRESENT', 'test_token_123', undefined, 'Student was actively participating');
    await refreshSpy();

    expect(recordSpy).toHaveBeenCalledWith('sess_101', 'PRESENT', 'test_token_123', undefined, 'Student was actively participating');
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('submits Absent action with notes to recordAttendance and triggers onRefresh', async () => {
    const recordSpy = vi.spyOn(classApi, 'recordAttendance').mockResolvedValue({} as any);
    const refreshSpy = vi.fn().mockResolvedValue(undefined);

    await classApi.recordAttendance('sess_101', 'NO_SHOW', 'test_token_123', undefined, 'Unexcused no show');
    await refreshSpy();

    expect(recordSpy).toHaveBeenCalledWith('sess_101', 'NO_SHOW', 'test_token_123', undefined, 'Unexcused no show');
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('performs rescheduling by cancelling old session and scheduling replacement', async () => {
    const cancelSpy = vi.spyOn(classApi, 'cancelClass').mockResolvedValue({} as any);
    const scheduleSpy = vi.spyOn(classApi, 'scheduleClass').mockResolvedValue({} as any);

    await classApi.cancelClass('sess_101', 'Rescheduled to 2026-11-21 at 10:00', 'test_token_123');
    await classApi.scheduleClass({
      student_id: 'STU_001',
      student_name: 'Krishnavi',
      schedule_date: '2026-11-21',
      schedule_time: '10:00',
      start_time: '2026-11-21T10:00:00Z',
      duration_minutes: 60,
    }, 'test_token_123');

    expect(cancelSpy).toHaveBeenCalledWith('sess_101', 'Rescheduled to 2026-11-21 at 10:00', 'test_token_123');
    expect(scheduleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        student_id: 'STU_001',
        schedule_date: '2026-11-21',
        schedule_time: '10:00',
      }),
      'test_token_123'
    );
  });
});
