import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { STUDENT_TABLE_COLUMNS, STUDENT_TABLE_GRID_TEMPLATE } from '../../src/domains/students/studentTableLayout';
import { StudentRow } from '../../src/domains/students/StudentRow';
import { StudentList } from '../../src/domains/students/StudentList';
import { StudentToolbar } from '../../src/domains/students/StudentToolbar';
import { ClassesPage } from '../../src/domains/classes/ClassesPage';
import { buildClassScheduleColumns } from '../../src/domains/classes/classScheduleColumns';
import { ClassSession } from '../../src/domains/classes/classTypes';
import classStyles from '../../src/domains/classes/classSchedule.module.css';
import studentRowStyles from '../../src/domains/students/studentRow.module.css';

// Mock AuthProvider
vi.mock('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({ token: 'mock-token', user: { email: 'admin@infineo.io' } }),
}));

// Mock fetchStudents
vi.mock('../../src/domains/students/studentApi', () => ({
  fetchStudents: vi.fn().mockResolvedValue([
    { student_id: 'STU_001', student_name: 'Krishnavi', full_name: 'Krishnavi' },
    { student_id: 'STU_002', student_name: 'Sudarshini', full_name: 'Sudarshini' },
  ]),
}));

// Mock useClassScheduleData
vi.mock('../../src/domains/classes/useClassScheduleData', () => ({
  useClassScheduleData: () => ({
    sessions: [
      {
        session_id: 'SES_001',
        student_id: 'STU_001',
        student_name: 'Krishnavi',
        schedule_date: '2026-11-20',
        schedule_time: '18:00',
        duration_minutes: 30,
        status: 'SCHEDULED',
        session_notes: 'Grammar exercises completed',
      },
    ],
    packages: [],
    loading: false,
    refetch: vi.fn(),
    getStudentConsumedClasses: () => ({ consumed: 4, purchased: 12 }),
    getStudentMeetingLink: () => 'https://meet.google.com/abc-def-ghi',
  }),
}));

describe('Student Directory Alignment & Class Schedule Refinement Suite', () => {
  const baseStudent = {
    student_id: 'STU_001',
    full_name: 'Krishnavi Roy',
    student_name: 'Krishnavi Roy',
    subject: 'English, Science',
    primary_meeting_link: 'https://meet.google.com/test-room',
    status: 'ACTIVE',
  };

  const dummyBalance = { totalPurchased: 10, totalConsumed: 4, packages: [] };
  const dummyFinancials = { totalInvoiced: 1000, totalPaid: 1000, outstanding: 0, currency: 'INR' };

  it('1. verifies continuous horizontal border on row and absence of gapped cell borders', () => {
    const html = renderToString(
      React.createElement(StudentRow, {
        student: baseStudent,
        isExpanded: false,
        onToggleExpand: () => {},
        onSelectStudent: () => {},
        onEditStudent: () => {},
        schedule: [{ schedule_id: '1', student_id: 'STU_001', day_of_week: 'MONDAY', start_time: '18:00', end_time: '18:30' }],
        balance: dummyBalance,
        financials: dummyFinancials,
      })
    );

    expect(html).toContain('border-bottom:1px solid var(--color-border-subtle)');
    expect(studentRowStyles.row).toBeDefined();
    // Cells do not render conflicting bottom borders
    expect(html).toContain('border-bottom:none');
  });

  it('2 & 3. verifies equal cell heights and variable height handling with multi-subject and multi-schedule', () => {
    const multiSubjectStudent = {
      ...baseStudent,
      subject: 'Maths, Physics, Chemistry, Biology',
    };
    const multiSchedules = [
      { schedule_id: '1', student_id: 'STU_001', day_of_week: 'MONDAY', start_time: '16:00', end_time: '17:00' },
      { schedule_id: '2', student_id: 'STU_001', day_of_week: 'WEDNESDAY', start_time: '16:00', end_time: '17:00' },
      { schedule_id: '3', student_id: 'STU_001', day_of_week: 'FRIDAY', start_time: '16:00', end_time: '17:00' },
    ];

    const html = renderToString(
      React.createElement(StudentRow, {
        student: multiSubjectStudent,
        isExpanded: false,
        onToggleExpand: () => {},
        onSelectStudent: () => {},
        onEditStudent: () => {},
        schedule: multiSchedules,
        balance: dummyBalance,
        financials: dummyFinancials,
      })
    );

    // Row uses CSS grid with alignItems: stretch so all cells share row height
    expect(html).toContain('align-items:stretch');
    // Content is vertically centered inside stretched cells
    expect(html).toContain('display:flex;align-items:center');
    // 2-column subject badges
    expect(html).toContain('grid-template-columns:repeat(2, minmax(0, 1fr))');
    expect(html).toContain('Maths');
    expect(html).toContain('Biology');
    // All 3 schedule lines rendered
    expect(html).toContain('Mon - 4:00 - 5:00 PM');
    expect(html).toContain('Wed - 4:00 - 5:00 PM');
    expect(html).toContain('Fri - 4:00 - 5:00 PM');
  });

  it('4 & 5. verifies Filter by Student and Schedule Class share one toolbar, and Refresh button is absent', () => {
    const html = renderToString(React.createElement(ClassesPage));

    // Filter by Student label is completely absent (as per refinement specification)
    expect(html).not.toContain('Filter by Student:');
    expect(html).toContain('filter-schedule-student');
    // Toolbar contains + Schedule Class button
    expect(html).toContain('+ Schedule Class');
    // Refresh button is completely absent
    expect(html).not.toContain('↻ Refresh');
    expect(html).not.toContain('Refresh classes');
  });

  it('6. verifies Upcoming/Past tabs match Student Directory underline and badge styling without rounded container', () => {
    expect(classStyles.tabBar).toBeDefined();
    expect(classStyles.tabButton).toBeDefined();
    expect(classStyles.tabButtonActive).toBeDefined();
    expect(classStyles.badge).toBeDefined();

    const html = renderToString(React.createElement(ClassesPage));
    expect(html).toContain('Upcoming Classes');
    expect(html).toContain('Past Classes');
    expect(html).toContain(classStyles.tabBar);
  });

  it('7, 8, 9, 10. verifies exactly 5 columns, student name + time together, and absence of redundant text / old columns', () => {
    let notesEditedSession: ClassSession | null = null;
    let attendanceRecorded = false;

    const cols = buildClassScheduleColumns({
      todayKey: '2026-11-20',
      nowMs: Date.now(),
      getStudentConsumedClasses: () => ({ consumed: 4, purchased: 12 }),
      getStudentMeetingLink: () => 'https://meet.google.com/test',
      handleUpdateStatus: async () => { attendanceRecorded = true; },
      handleRestore: async () => {},
      onEditNotes: (s) => { notesEditedSession = s; },
    });

    // Exactly 5 columns
    expect(cols).toHaveLength(5);
    const keys = cols.map((c) => c.key);
    expect(keys).toEqual(['student', 'date', 'consumed', 'attendance', 'notes']);

    // Exact headers
    expect(cols.map((c) => c.header)).toEqual(['Student Name', 'Date', 'Balance', 'Status', 'Notes']);

    // Content-aware column widths
    expect(cols.find((c) => c.key === 'student')?.width).toBe('20%');
    expect(cols.find((c) => c.key === 'date')?.width).toBe('15%');
    expect(cols.find((c) => c.key === 'consumed')?.width).toBe('13%');
    expect(cols.find((c) => c.key === 'notes')?.width).toBe('28%');
    expect(cols.find((c) => c.key === 'attendance')?.width).toBe('24%');

    // Old columns absent
    expect(cols.find((c) => c.key === 'start_time')).toBeUndefined();
    expect(cols.find((c) => c.key === 'join')).toBeUndefined();

    // Verify student cell rendering
    const testSession: ClassSession = {
      session_id: 'SES_099',
      student_id: 'STU_001',
      student_name: 'Krishnavi',
      schedule_date: '2026-11-20',
      schedule_time: '18:00',
      duration_minutes: 30,
      status: 'SCHEDULED',
      session_notes: 'Great class',
    };

    const studentCol = cols.find((c) => c.key === 'student')!;
    const renderedStudent = renderToString(studentCol.render!(testSession) as React.ReactElement);

    // Displays Student Name
    expect(renderedStudent).toContain('Krishnavi');
    // Displays actual class time range under student name
    expect(renderedStudent).toContain('6:00 PM – 6:30 PM');
    // Redundant text is absent
    expect(renderedStudent).not.toContain('Krishnavi - Session');
    expect(renderedStudent).not.toContain('Class Session');

    // 11. Attendance controls functional
    const attCol = cols.find((c) => c.key === 'attendance')!;
    const renderedAtt = renderToString(attCol.render!(testSession) as React.ReactElement);
    expect(renderedAtt).toContain('Attended');
    expect(renderedAtt).toContain('No-Show');
    expect(renderedAtt).toContain('Cancel');

    // 12. Session Notes functional
    const notesCol = cols.find((c) => c.key === 'notes')!;
    const renderedNotes = renderToString(notesCol.render!(testSession) as React.ReactElement);
    expect(renderedNotes).toContain('Great class');
    expect(renderedNotes).toContain('✎');
  });

  it('13. verifies Students Directory toolbar left-to-right element order: Active -> Inactive -> All Students -> Search -> Status Filter -> Renew Package -> Add Student', () => {
    const html = renderToString(
      React.createElement(StudentToolbar, {
        searchQuery: '',
        onSearchChange: () => {},
        activeTab: 'ACTIVE',
        onTabChange: () => {},
        activeCount: 3,
        inactiveCount: 1,
        allCount: 4,
        statusFilter: '',
        onStatusFilterChange: () => {},
        onRenew: () => {},
        onAddStudent: () => {},
      })
    );

    const activeIdx = html.indexOf('student-tab-active');
    const inactiveIdx = html.indexOf('student-tab-inactive');
    const allIdx = html.indexOf('student-tab-all');
    const searchIdx = html.indexOf('Search by student name');
    const filterIdx = html.indexOf('Filter students by status');
    const renewIdx = html.indexOf('Renew Package');
    const addIdx = html.indexOf('+ Add Student');

    expect(html).toContain('leftGroup');
    expect(html).toContain('rightGroup');
    expect(html).toContain('Search by student name');
    expect(html).toContain('padding:0 0.75rem');
    expect(html).toContain('text-align:left');
    expect(activeIdx).toBeGreaterThan(-1);
    expect(inactiveIdx).toBeGreaterThan(activeIdx);
    expect(allIdx).toBeGreaterThan(inactiveIdx);
    expect(searchIdx).toBeGreaterThan(allIdx);
    expect(filterIdx).toBeGreaterThan(searchIdx);
    expect(renewIdx).toBeGreaterThan(filterIdx);
    expect(addIdx).toBeGreaterThan(renewIdx);
  });
});
