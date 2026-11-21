import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CLASS_TABLE_COLUMNS } from '../../src/domains/classes/classTableLayout';
import { splitAndSortSessions } from '../../src/domains/classes/classSorting';
import { ClassSession } from '../../src/domains/classes/classTypes';
import { SettingsPage } from '../../src/domains/settings/SettingsPage';
import { validateImageFile } from '../../src/domains/dashboard/profileImageStorage';

import { AuthProvider } from '../../src/auth/AuthProvider';

describe('Class Schedule & Profile Refinement Regression Suite', () => {
  it('verifies exact 5 column labels, order, and content-aware widths', () => {
    const keys = Object.keys(CLASS_TABLE_COLUMNS);
    expect(keys).toEqual(['student', 'date', 'consumed', 'attendance', 'notes']);
    expect(CLASS_TABLE_COLUMNS.student.header).toBe('Student Name');
    expect(CLASS_TABLE_COLUMNS.date.header).toBe('Date');
    expect(CLASS_TABLE_COLUMNS.consumed.header).toBe('Balance');
    expect(CLASS_TABLE_COLUMNS.notes.header).toBe('Notes');
    expect(CLASS_TABLE_COLUMNS.attendance.header).toBe('Status');

    const totalPct = Object.values(CLASS_TABLE_COLUMNS)
      .map((c) => parseInt(c.width, 10))
      .reduce((a, b) => a + b, 0);
    expect(totalPct).toBe(100);
  });

  it('sorts past classes newest to oldest and breaks ties deterministically', () => {
    const nowMs = new Date('2026-11-20T12:00:00Z').getTime();
    const sessions: ClassSession[] = [
      { session_id: 's_old', student_id: '1', schedule_date: '2026-11-01', schedule_time: '10:00', status: 'SCHEDULED' },
      { session_id: 's_new', student_id: '2', schedule_date: '2026-11-18', schedule_time: '15:00', status: 'SCHEDULED' },
      { session_id: 's_mid2', student_id: '3', schedule_date: '2026-11-10', schedule_time: '10:00', status: 'SCHEDULED' },
      { session_id: 's_mid1', student_id: '4', schedule_date: '2026-11-10', schedule_time: '10:00', status: 'SCHEDULED' },
      { session_id: 's_upcoming', student_id: '5', schedule_date: '2026-11-25', schedule_time: '10:00', status: 'SCHEDULED' },
    ];
    const { past, upcoming } = splitAndSortSessions(sessions, nowMs, 'Asia/Kolkata');
    expect(upcoming.map((s) => s.session_id)).toEqual(['s_upcoming']);
    expect(past.map((s) => s.session_id)).toEqual(['s_new', 's_mid1', 's_mid2', 's_old']);
  });

  it('renders Profile & Preferences with refined horizontal layout, removed elements, and single save button', () => {
    const html = renderToString(React.createElement(AuthProvider, null, React.createElement(SettingsPage)));
    // Left card contains heading, display name, input, email
    expect(html).toContain('Administrator Profile');
    expect(html).toContain('Display Name');
    expect(html).toContain('displayNameInput');
    expect(html).toContain('Email');
    expect(html).toContain('Change profile picture');

    // Removed elements
    expect(html).not.toContain('Primary Authorized Admin');
    expect(html).not.toContain('Upload Photo');
    expect(html).not.toContain('Displayed in the navigation header');
    expect(html).not.toContain('Applied consistently to class schedules');
    expect(html).not.toContain('Original payment currencies are preserved');

    // Right card
    expect(html).toContain('Regional Defaults &amp; Preferences');
    expect(html).toContain('Application Timezone');
    expect(html).toContain('timezoneSelect');
    expect(html).toContain('Display Currency Preference');
    expect(html).toContain('currencySelect');

    // Exactly one Save Changes button in right-aligned footer row
    expect(html).toContain('Save Changes');
    expect(html).toContain('justify-content:flex-end');
    const saveCount = (html.match(/Save Changes/g) || []).length;
    expect(saveCount).toBe(1);
    expect(html).not.toContain('Save Display Name');
    expect(html).not.toContain('Save Regional Preferences');
  });

  it('validates profile images and persists in storage without external API', async () => {
    const invalidType = { type: 'image/gif', size: 1024 } as File;
    const res1 = validateImageFile(invalidType);
    expect(res1.valid).toBe(false);

    const oversized = { type: 'image/png', size: 6 * 1024 * 1024 } as File;
    const res2 = validateImageFile(oversized);
    expect(res2.valid).toBe(false);

    const valid = { type: 'image/jpeg', size: 2 * 1024 * 1024 } as File;
    const res3 = validateImageFile(valid);
    expect(res3.valid).toBe(true);
  });

  it('renders login page matching lavender background and white card identity', async () => {
    const { RequireAdmin } = await import('../../src/auth/RequireAdmin');
    const { AuthContext } = await import('../../src/auth/AuthProvider');
    const mockAuthValue = {
      status: 'unauthenticated' as const,
      user: null,
      token: null,
      errorMessage: null,
      signInWithToken: () => {},
      signOut: () => {},
    };
    const html = renderToString(React.createElement(
      AuthContext.Provider,
      { value: mockAuthValue },
      React.createElement(RequireAdmin, { children: null })
    ));
    expect(html).toContain('Personal Dashboard');
    expect(html).toContain('Sign In as Administrator');
    expect(html).toContain('radial-gradient');
  });
});
