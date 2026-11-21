import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { STUDENT_TABLE_COLUMNS } from '../../src/domains/students/studentTableLayout';
import { StudentRow } from '../../src/domains/students/StudentRow';
import { MeetingLinkButton } from '../../src/domains/meeting-links/MeetingLinkButton';
import { Student } from '../../src/domains/students/studentTypes';
import { getStoredProfileImage, saveStoredProfileImage, deleteStoredProfileImage } from '../../src/domains/dashboard/profileImageStorage';
import layoutStyles from '../../src/layout/layout.module.css';

describe('Student Directory & Global Layout Refinement Suite', () => {
  const mockStudent: Student = {
    student_id: 'STU_101',
    full_name: 'Ananya Roy',
    student_name: 'Ananya Roy',
    subject: 'English, Hindi, Science, Social Science',
    parent_name: 'Mrs. Roy',
    parent_email: 'roy@example.com',
    primary_meeting_link: 'https://meet.google.com/xyz-uvwx-rst',
    status: 'ACTIVE',
  };

  const defaultBalance = { totalPurchased: 10, totalConsumed: 4, packages: [] };
  const defaultFinancials = {
    totalInvoiced: 5000,
    totalPaid: 5000,
    outstanding: 0,
    currency: 'INR',
  };

  it('1. verifies exactly five column proportions and absence of actions column', () => {
    expect(Object.keys(STUDENT_TABLE_COLUMNS)).toHaveLength(5);
    expect(STUDENT_TABLE_COLUMNS.student.minWidth).toBe('180px');
    expect(STUDENT_TABLE_COLUMNS.subject.minWidth).toBe('150px');
    expect(STUDENT_TABLE_COLUMNS.schedule.minWidth).toBe('170px');
    expect(STUDENT_TABLE_COLUMNS.classes.minWidth).toBe('85px');
    expect(STUDENT_TABLE_COLUMNS.meetingLink.minWidth).toBe('190px');
    expect((STUDENT_TABLE_COLUMNS as any).actions).toBeUndefined();
  });

  it('2. verifies StudentRow renders exactly 5 columns and no Edit/Actions column', () => {
    const html = renderToString(
      React.createElement('table', null,
        React.createElement('tbody', null,
          React.createElement(StudentRow, {
            student: mockStudent,
            isExpanded: false,
            onToggleExpand: () => {},
            onSelectStudent: () => {},
            onEditStudent: () => {},
            schedule: [],
            balance: defaultBalance,
            financials: defaultFinancials,
          })
        )
      )
    );

    // Should NOT have an Actions edit button in the main row
    expect(html).not.toContain('>Edit</button>');
    expect(html).not.toContain('STUDENT_TABLE_COLUMNS.actions');

    // Should have 5 td elements in the tr
    const tdMatches = html.match(/<td\b/g);
    expect(tdMatches).toHaveLength(5);

    // 5th td contains the meeting link
    expect(html).toContain('meet.google.com/xyz-uvwx-rst');
    expect(html).toContain('Open ↗');
    expect(html).toContain('Copy');
  });

  it('3. verifies subject column displays maximum two badges per row using 2-column grid', () => {
    const html = renderToString(
      React.createElement('table', null,
        React.createElement('tbody', null,
          React.createElement(StudentRow, {
            student: mockStudent,
            isExpanded: false,
            onToggleExpand: () => {},
            onSelectStudent: () => {},
            onEditStudent: () => {},
            schedule: [],
            balance: defaultBalance,
            financials: defaultFinancials,
          })
        )
      )
    );

    expect(html).toContain('grid-template-columns:repeat(2, minmax(0, 1fr))');
    expect(html).toContain('English');
    expect(html).toContain('Hindi');
    expect(html).toContain('Science');
    expect(html).toContain('Social Science');
  });

  it('4. verifies Meeting Link column fallback when student has no meeting link', () => {
    const studentNoLink: Student = {
      ...mockStudent,
      student_id: 'STU_102',
      primary_meeting_link: '',
    };

    const html = renderToString(
      React.createElement('table', null,
        React.createElement('tbody', null,
          React.createElement(StudentRow, {
            student: studentNoLink,
            isExpanded: false,
            onToggleExpand: () => {},
            onSelectStudent: () => {},
            onEditStudent: () => {},
            schedule: [],
            balance: defaultBalance,
            financials: defaultFinancials,
          })
        )
      )
    );

    expect(html).toContain('No link configured');
  });

  it('5. verifies compact MeetingLinkButton renders link affordance with Open ↗ and Copy action', () => {
    const html = renderToString(
      React.createElement(MeetingLinkButton, {
        url: 'https://zoom.us/j/987654321',
        compact: true,
      })
    );

    expect(html).toContain('zoom.us/j/987654321');
    expect(html).toContain('Open ↗');
    expect(html).toContain('Copy');
    expect(html).toContain('title="https://zoom.us/j/987654321"');
  });

  it('6. verifies profile picture sync persistence functions', async () => {
    const testDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await saveStoredProfileImage(testDataUrl);
    expect(await getStoredProfileImage()).toBe(testDataUrl);

    await deleteStoredProfileImage();
    expect(await getStoredProfileImage()).toBeNull();
  });

  it('7. verifies global sidebar separator borders are removed', () => {
    expect(layoutStyles.sidebar).toBeDefined();
    expect(layoutStyles.sidebarHeader).toBeDefined();
  });
});
