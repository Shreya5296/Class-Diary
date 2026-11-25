import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { formatTimeTo12Hour, formatTimeRange12Hour } from '../../src/lib/time12Format';
import { formatDate } from '../../src/lib/dateFormat';
import { SubjectMultiSelect } from '../../src/domains/students/SubjectMultiSelect';
import { AttendanceControl } from '../../src/domains/classes/AttendanceControl';
import { AttendanceNotesModal } from '../../src/domains/classes/AttendanceNotesModal';
import { Sidebar } from '../../src/layout/Sidebar';
import { AuthProvider } from '../../src/auth/AuthProvider';

describe('UI/UX Refinements (Time, Sidebar, Date, Dynamic Subjects & Mandatory Attendance Notes)', () => {
  describe('Change 1: Standardize End Time Display', () => {
    it('formats times in 12-hour AM/PM format for morning, afternoon, evening, noon, and midnight', () => {
      expect(formatTimeTo12Hour('09:00')).toBe('9:00 AM');
      expect(formatTimeTo12Hour('12:00')).toBe('12:00 PM');
      expect(formatTimeTo12Hour('12:30')).toBe('12:30 PM');
      expect(formatTimeTo12Hour('18:00')).toBe('6:00 PM');
      expect(formatTimeTo12Hour('19:00')).toBe('7:00 PM');
      expect(formatTimeTo12Hour('23:45')).toBe('11:45 PM');
      expect(formatTimeTo12Hour('00:00')).toBe('12:00 AM');
    });

    it('formats start and end time ranges consistently in 12-hour AM/PM format', () => {
      expect(formatTimeRange12Hour('18:00', '19:00')).toBe('6:00 PM – 7:00 PM');
      expect(formatTimeRange12Hour('09:30', '10:30')).toBe('9:30 AM – 10:30 AM');
    });
  });

  describe('Change 2: Collapsible Sidebar', () => {
    it('renders expanded sidebar with navigation labels and collapse toggle button', () => {
      const onToggle = vi.fn();
      const html = renderToString(
        React.createElement(AuthProvider, null,
          React.createElement(Sidebar, {
            activeSection: 'dashboard',
            onNavigate: vi.fn(),
            isCollapsed: false,
            onToggleCollapse: onToggle,
          })
        )
      );
      expect(html).toContain('Class Diary');
      expect(html).toContain('Dashboard');
      expect(html).toContain('Collapse sidebar');
    });

    it('renders collapsed sidebar hiding label text and displaying expand button', () => {
      const onToggle = vi.fn();
      const html = renderToString(
        React.createElement(AuthProvider, null,
          React.createElement(Sidebar, {
            activeSection: 'dashboard',
            onNavigate: vi.fn(),
            isCollapsed: true,
            onToggleCollapse: onToggle,
          })
        )
      );
      expect(html).toContain('Expand sidebar');
      expect(html).toContain('aria-label="Dashboard"');
    });
  });

  describe('Change 3: Standardize Date Format Everywhere (DD-MM-YYYY)', () => {
    it('formats dates consistently as DD-MM-YYYY', () => {
      expect(formatDate('2026-11-25')).toBe('25-11-2026');
      expect(formatDate('2026-03-04')).toBe('04-03-2026');
      expect(formatDate('2026-01-05')).toBe('05-01-2026');
      expect(formatDate(null)).toBe('—');
      expect(formatDate('invalid-date')).toBe('—');
    });
  });

  describe('Change 4: Make Subjects Dynamic', () => {
    it('renders selected subjects and allows custom typing', () => {
      const onChange = vi.fn();
      const html = renderToString(
        React.createElement(SubjectMultiSelect, {
          selectedSubjects: ['English', 'Mathematics'],
          onChange,
        })
      );
      expect(html).toContain('English');
      expect(html).toContain('Mathematics');
      expect(html).toContain('Add or filter subjects');
    });
  });

  describe('Change 5: Make Attendance Notes Mandatory', () => {
    it('renders AttendanceNotesModal with required indicator for Attended and No-Show', () => {
      const onConfirm = vi.fn();
      const htmlAttended = renderToString(
        React.createElement(AttendanceNotesModal, {
          isOpen: true,
          outcome: 'PRESENT',
          onConfirm,
          onCancel: vi.fn(),
        })
      );
      expect(htmlAttended).toContain('Attended');
      expect(htmlAttended).toContain('Notes <span style="color:var(--color-danger)">*</span>');

      const htmlNoShow = renderToString(
        React.createElement(AttendanceNotesModal, {
          isOpen: true,
          outcome: 'NO_SHOW',
          onConfirm,
          onCancel: vi.fn(),
        })
      );
      expect(htmlNoShow).toContain('No-Show');
      expect(htmlNoShow).toContain('Notes <span style="color:var(--color-danger)">*</span>');
    });

    it('renders AttendanceControl buttons for Attended, No-Show, and Cancel', () => {
      const html = renderToString(
        React.createElement(AttendanceControl, {
          status: 'SCHEDULED',
          creditEffect: 'PENDING',
          onUpdateStatus: vi.fn(),
          onRestoreCredit: vi.fn(),
        })
      );
      expect(html).toContain('Attended');
      expect(html).toContain('No-Show');
      expect(html).toContain('Cancel');
    });
  });
});
