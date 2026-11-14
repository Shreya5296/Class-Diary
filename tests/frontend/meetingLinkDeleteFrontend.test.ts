import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MeetingLinkButton } from '../../src/domains/meeting-links/MeetingLinkButton';
import { EditStudentLinksSection } from '../../src/domains/students/EditStudentLinksSection';
import { handleMockApiRequest } from '../../src/api/mockDataStore';
import { Student } from '../../src/domains/students/studentTypes';

describe('Frontend Meeting Link Management via Students Domain', () => {
  it('renders Primary Meeting Link input and preview in EditStudentLinksSection', () => {
    const onChangeMock = vi.fn();
    const html = renderToString(
      React.createElement(EditStudentLinksSection, {
        meetingLink: 'https://meet.google.com/abc-defg-hij',
        onChange: onChangeMock,
      })
    );

    expect(html).toContain('Primary Meeting Link');
    expect(html).toContain('https://meet.google.com/abc-defg-hij');
    expect(html).toContain('Google Meet');
  });

  it('renders empty state indicator when no meeting link is configured in EditStudentLinksSection', () => {
    const html = renderToString(
      React.createElement(EditStudentLinksSection, {
        meetingLink: '',
        onChange: vi.fn(),
      })
    );

    expect(html).toContain('Primary Meeting Link');
    expect(html).toContain('No primary meeting link configured');
  });

  it('renders MeetingLinkButton with platform styling and copy action', () => {
    const html = renderToString(
      React.createElement(MeetingLinkButton, {
        url: 'https://zoom.us/j/123456789',
      })
    );

    expect(html).toContain('title="https://zoom.us/j/123456789"');
    expect(html).toContain('Meeting link for ZOOM');
    expect(html).toContain('Copy');
  });

  it('updates primary_meeting_link in mock data store via students.update', () => {
    const res = handleMockApiRequest<Student>('students.update', {
      student_id: 'STU_001',
      primary_meeting_link: 'https://meet.google.com/new-link',
    }, 'req_stu_ml_update');

    expect(res.ok).toBe(true);
    expect(res.data.primary_meeting_link).toBe('https://meet.google.com/new-link');
  });

  it('clears primary_meeting_link safely in mock data store via students.update', () => {
    const res = handleMockApiRequest<Student>('students.update', {
      student_id: 'STU_001',
      primary_meeting_link: '',
    }, 'req_stu_ml_clear');

    expect(res.ok).toBe(true);
    expect(res.data.primary_meeting_link).toBe('');
  });
});
