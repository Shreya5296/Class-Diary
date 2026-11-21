import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AppShell } from '../../src/layout/AppShell';
import { TopBar } from '../../src/layout/TopBar';
import { Sidebar } from '../../src/layout/Sidebar';
import { getUserProfileIdentity } from '../../src/auth/userProfileStorage';
import { STUDENT_TABLE_COLUMNS, STUDENT_TABLE_GRID_TEMPLATE } from '../../src/domains/students/studentTableLayout';
import { StudentRow } from '../../src/domains/students/StudentRow';
import { Student } from '../../src/domains/students/studentTypes';

const mockUser = {
  id: 'user_1',
  email: 'ananya.sharma@example.com',
  name: 'Ananya Sharma',
  role: 'ADMIN',
};

vi.mock('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
    token: 'test-token',
    signOut: vi.fn(),
  }),
}));

describe('Profile Identity Synchronization & Content-Aware Table Sizing', () => {
  it('1. verifies TopBar and Sidebar render identical fallback initials when no avatar exists', () => {
    const { displayName, initials } = getUserProfileIdentity(mockUser.name, mockUser.email);
    expect(initials).toBe('AS');
    expect(displayName).toBe('Ananya Sharma');

    const topBarHtml = renderToString(
      React.createElement(TopBar, {
        activeSection: 'students',
        initials,
        displayName,
        profileImage: null,
      })
    );

    const sidebarHtml = renderToString(
      React.createElement(Sidebar, {
        activeSection: 'students',
        onNavigate: () => {},
        initials,
        displayName,
        profileImage: null,
      })
    );

    // Both must contain the exact same initials 'AS'
    expect(topBarHtml).toContain('>AS</span>');
    expect(sidebarHtml).toContain('AS</div>');
    // Sidebar must NOT contain single-character 'A'
    expect(sidebarHtml).not.toContain('>A</div>');
  });

  it('2. verifies TopBar and Sidebar render identical image source when avatar exists', () => {
    const testAvatar = 'data:image/png;base64,mockAvatarImageData';
    const { displayName, initials } = getUserProfileIdentity(mockUser.name, mockUser.email);

    const topBarHtml = renderToString(
      React.createElement(TopBar, {
        activeSection: 'students',
        initials,
        displayName,
        profileImage: testAvatar,
      })
    );

    const sidebarHtml = renderToString(
      React.createElement(Sidebar, {
        activeSection: 'students',
        onNavigate: () => {},
        initials,
        displayName,
        profileImage: testAvatar,
      })
    );

    expect(topBarHtml).toContain(`src="${testAvatar}"`);
    expect(topBarHtml).toContain(`alt="${displayName}"`);
    expect(sidebarHtml).toContain(`src="${testAvatar}"`);
    expect(sidebarHtml).toContain(`alt="${displayName}"`);
  });

  it('3. verifies AppShell coordinates identical avatar state to both TopBar and Sidebar', () => {
    const shellHtml = renderToString(
      React.createElement(AppShell, {
        activeSection: 'students',
        onNavigate: () => {},
      }, React.createElement('div', null, 'Content'))
    );

    // Shell renders both topbar and sidebar with identical initials
    expect(shellHtml).toContain('>AS</span>');
    expect(shellHtml).toContain('AS</div>');
  });

  it('4. verifies Student Directory table uses content-aware column styles', () => {
    // Column definitions must have content-aware minWidth and grid template
    expect(STUDENT_TABLE_GRID_TEMPLATE).toBeDefined();
    expect(STUDENT_TABLE_COLUMNS.student.minWidth).toBe('180px');
    expect(STUDENT_TABLE_COLUMNS.student.maxWidth).toBe('220px');
    expect(STUDENT_TABLE_COLUMNS.classes.minWidth).toBe('85px');
    expect(STUDENT_TABLE_COLUMNS.classes.maxWidth).toBe('105px');
    expect(STUDENT_TABLE_COLUMNS.meetingLink.minWidth).toBe('190px');
  });

  it('5. verifies StudentRow cells match STUDENT_TABLE_COLUMNS content-aware sizing', () => {
    const mockStudent: Student = {
      student_id: 'STU_1',
      student_name: 'Aarav Sharma',
      subject: 'Math, Physics',
      primary_meeting_link: 'https://meet.google.com/abc-defg-hij',
    };

    const rowHtml = renderToString(
      React.createElement('table', null,
        React.createElement('tbody', null,
          React.createElement(StudentRow, {
            student: mockStudent,
            isExpanded: false,
            onToggleExpand: () => {},
            onSelectStudent: () => {},
            onEditStudent: () => {},
            schedule: [],
            balance: { totalPurchased: 10, totalConsumed: 4, packages: [] },
            financials: { totalInvoiced: 1000, totalPaid: 1000, outstanding: 0, currency: 'INR' },
          })
        )
      )
    );

    // Cells must have min-width constraints applied directly
    expect(rowHtml).toContain('min-width:180px');
    expect(rowHtml).toContain('min-width:85px');
    expect(rowHtml).toContain('min-width:190px');
  });
});
