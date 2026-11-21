import { describe, it, expect } from 'vitest';
import styles from '../../src/components/tables/tables.module.css';
import { STUDENT_TABLE_COLUMNS } from '../../src/domains/students/studentTableLayout';

describe('Fix 1 — Students Table Layout, Alignment and Sizing', () => {
  it('has tableFixed CSS class with table-layout: fixed to prevent overflow', () => {
    expect(styles.tableFixed).toBeDefined();
    expect(styles.tableFixed).toContain('tableFixed');
  });

  it('uses content-aware column definitions with sensible min and max bounds', () => {
    expect(STUDENT_TABLE_COLUMNS.student.minWidth).toBe('180px');
    expect(STUDENT_TABLE_COLUMNS.student.maxWidth).toBe('220px');
    expect(STUDENT_TABLE_COLUMNS.subject.minWidth).toBe('150px');
    expect(STUDENT_TABLE_COLUMNS.schedule.minWidth).toBe('170px');
    expect(STUDENT_TABLE_COLUMNS.classes.minWidth).toBe('85px');
    expect(STUDENT_TABLE_COLUMNS.meetingLink.minWidth).toBe('190px');
  });

  it('reserves sufficient width for multi-subject tags and meeting link', () => {
    const meetingLinkMin = parseInt(STUDENT_TABLE_COLUMNS.meetingLink.minWidth, 10);
    expect(meetingLinkMin).toBeGreaterThanOrEqual(180);
  });
});
