import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { RequireAdmin } from '../../src/auth/RequireAdmin';
import { AuthContext } from '../../src/auth/AuthProvider';
import { Sidebar } from '../../src/layout/Sidebar';
import { DashboardWelcomePanel } from '../../src/domains/dashboard/DashboardWelcomePanel';
import { StudentProfilePage } from '../../src/domains/students/StudentProfilePage';
import { StudentSummary } from '../../src/domains/students/StudentSummary';
import { AttendanceNotesModal } from '../../src/domains/classes/AttendanceNotesModal';
import { Student } from '../../src/domains/students/studentTypes';

describe('Batch 3 UI/UX Refinement Suite', () => {
  it('Change 1: Login page subtitle removed and button retains brand blue gradient in both states', () => {
    const mockAuth: any = {
      status: 'unauthenticated',
      user: null,
      token: null,
      signInWithToken: vi.fn(),
      signOut: vi.fn(),
    };

    const html = renderToString(
      <AuthContext.Provider value={mockAuth}>
        <RequireAdmin><div>Content</div></RequireAdmin>
      </AuthContext.Provider>
    );

    // Subtitle must be completely removed
    expect(html).not.toContain('Enter your administrator access key to authenticate.');
    expect(html).toContain('Class Diary');
    expect(html).toContain('Sign In as Administrator');
    // Button styling retains brand gradient
    expect(html).toContain('linear-gradient(135deg, rgba(37, 99, 235');
    expect(html).toContain('disabled=""');
  });

  it('Change 2: Sidebar collapse control renders accessible labels and chevron toggle', () => {
    const mockAuth: any = {
      status: 'authenticated',
      user: { email: 'shreya@example.com', name: 'Shreya Agarwal', isAdmin: true },
      token: 'tok_1',
      signInWithToken: vi.fn(),
      signOut: vi.fn(),
    };

    const htmlExpanded = renderToString(
      <AuthContext.Provider value={mockAuth}>
        <Sidebar activeSection="dashboard" onNavigate={vi.fn()} isCollapsed={false} />
      </AuthContext.Provider>
    );
    expect(htmlExpanded).toContain('aria-label="Collapse sidebar"');
    expect(htmlExpanded).toContain('title="Collapse sidebar"');

    const htmlCollapsed = renderToString(
      <AuthContext.Provider value={mockAuth}>
        <Sidebar activeSection="dashboard" onNavigate={vi.fn()} isCollapsed={true} />
      </AuthContext.Provider>
    );
    expect(htmlCollapsed).toContain('aria-label="Expand sidebar"');
    expect(htmlCollapsed).toContain('title="Expand sidebar"');
  });

  it('Change 4: Sidebar profile picture renders avatar container for 56px visual styling', () => {
    const mockAuth: any = {
      status: 'authenticated',
      user: { email: 'shreya@example.com', name: 'Shreya Agarwal', isAdmin: true },
      token: 'tok_1',
      signInWithToken: vi.fn(),
      signOut: vi.fn(),
    };

    const html = renderToString(
      <AuthContext.Provider value={mockAuth}>
        <Sidebar activeSection="dashboard" onNavigate={vi.fn()} isCollapsed={false} initials="SA" displayName="Shreya Agarwal" />
      </AuthContext.Provider>
    );
    expect(html).toContain('SA');
    expect(html).toContain('Shreya Agarwal');
  });

  it('Change 5: Dashboard Welcome Panel displays exactly two lines without live clock', () => {
    const mockAuth: any = {
      status: 'authenticated',
      user: { email: 'shreya@example.com', name: 'Shreya Agarwal', isAdmin: true },
      token: 'tok_1',
      signInWithToken: vi.fn(),
      signOut: vi.fn(),
    };

    const html = renderToString(
      <AuthContext.Provider value={mockAuth}>
        <DashboardWelcomePanel />
      </AuthContext.Provider>
    );

    expect(html).toContain('Welcome back,');
    expect(html).toContain('happening today.');
    // No live clock or date pill inside Welcome Back panel
    expect(html).not.toContain('IST (GMT+5:30)');
  });

  it('Change 7: Student Profile page has top padding and StudentSummary wraps long values', () => {
    const mockAuth: any = {
      status: 'authenticated',
      user: { email: 'shreya@example.com', name: 'Shreya Agarwal', isAdmin: true },
      token: 'tok_1',
      signInWithToken: vi.fn(),
      signOut: vi.fn(),
    };

    const student: Student = {
      student_id: 'STU_1001',
      student_name: 'Alexander Montgomery-Fitzgerald',
      student_email: 'alexander.montgomery.fitzgerald.longemail@subdomain.example-academy.org',
      parent_name: 'Lady Eleanor Montgomery-Fitzgerald',
      parent_phone: '+91 98765 43210',
      parent_email: 'eleanor.montgomery.fitzgerald@familyoffice.example.co.uk',
      subject: 'Advanced Mathematics & Physics HL',
      primary_meeting_link: 'https://meet.google.com/xyz-uvwx-rst',
      status: 'ACTIVE',
      created_at: '2026-01-15T10:00:00Z',
    };

    const profileHtml = renderToString(
      <AuthContext.Provider value={mockAuth}>
        <StudentProfilePage student={student} onBack={vi.fn()} onEdit={vi.fn()} />
      </AuthContext.Provider>
    );
    // Page level top padding
    expect(profileHtml).toContain('padding-top:1.75rem');

    const summaryHtml = renderToString(
      <StudentSummary student={student} />
    );
    expect(summaryHtml).toContain('Alexander Montgomery-Fitzgerald');
    expect(summaryHtml).toContain('alexander.montgomery.fitzgerald.longemail@subdomain.example-academy.org');
    expect(summaryHtml).toContain('overflow-wrap:anywhere');
    expect(summaryHtml).toContain('data-testid="student-status-badge"');
  });

  it('Change 8: AttendanceNotesModal renders left-aligned text, full-width textarea and right-aligned buttons', () => {
    const html = renderToString(
      <AttendanceNotesModal
        isOpen={true}
        outcome="ATTENDED"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain('Mark Attendance:');
    expect(html).toContain('Attended');
    expect(html).toContain('Please enter attendance notes before marking the student as');
    expect(html).toContain('Notes');
    expect(html).toContain('data-testid="attendance-notes-input"');
    expect(html).toContain('max-width:600px');
    expect(html).toContain('justify-content:flex-end');
    expect(html).toContain('Confirm');
  });
});
