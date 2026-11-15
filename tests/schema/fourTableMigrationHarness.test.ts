import { describe, it, expect, beforeEach } from 'vitest';
import { MockSpreadsheet } from '../mocks/MockSpreadsheet';
// @ts-expect-error Apps script commonjs export
import { runFourTableCanonicalMigration, generatePreMigrationInventory, runFourTableMigrationPreflight } from '../../02-backend/apps-script/setup/FourTableMigration.gs';

describe('FourTableMigration Hardened Targeting and Follow-up Archive Harness', () => {
  let spreadsheet: MockSpreadsheet;

  function setupTestSpreadsheet(customId?: string): MockSpreadsheet {
    const ss = new MockSpreadsheet();
    if (customId) {
      ss.getId = () => customId;
    }
    ss.insertSheet('Students').rows = [
      ['student_id', 'student_name', 'parent_name', 'parent_phone', 'parent_email', 'student_phone', 'student_email', 'subject', 'status'],
      ['stu_01', 'Alice Smith', 'Bob Smith', '9876543210', 'bob@test.com', '9876543211', 'alice@test.com', 'Math', 'ACTIVE'],
      ['stu_02', 'Charlie Brown', 'David Brown', '9876543212', 'david@test.com', '9876543213', 'charlie@test.com', 'Physics', 'ACTIVE'],
    ];
    ss.insertSheet('Packages').rows = [
      ['student_id', 'student_name', 'plan_type', 'currency', 'package_price', 'per_class', 'classes_purchased', 'start_date', 'end_date', 'next_due_date', 'class_duration', 'class_schedule'],
      ['stu_01', 'Alice Smith', 'PACKAGE', 'INR', 5000, 1000, 5, '2026-03-01', '2026-04-01', '2026-04-01', 60, ''],
    ];
    ss.insertSheet('Payments').rows = [
      ['student_id', 'student_name', 'payment_date', 'amount', 'currency', 'in_inr'],
      ['stu_01', 'Alice Smith', '2026-03-01', 5000, 'INR', 5000],
    ];
    ss.insertSheet('ClassSessions').rows = [
      ['student_id', 'student_name', 'schedule_date', 'schedule_time', 'attendance_status', 'session_status', 'deduct_class', 'cancellation_reason'],
      ['stu_01', 'Alice Smith', '2026-03-05', '10:00', 'ATTENDED', 'COMPLETED', true, ''],
      ['stu_01', 'Alice Smith', '2026-03-12', '10:00', 'ATTENDED', 'COMPLETED', true, ''],
      ['stu_02', 'Charlie Brown', '2026-03-15', '14:00', 'ATTENDED', 'COMPLETED', true, ''],
      ['stu_02', 'Charlie Brown', '2026-03-15', '16:00', 'ATTENDED', 'COMPLETED', true, ''], // 2 sessions on same day for stu_02 (ambiguous)
    ];
    ss.insertSheet('MeetingLinks').rows = [
      ['student_id', 'student_name', 'meeting_link_1', 'meeting_link_2'],
      ['stu_01', 'Alice Smith', 'https://meet.google.com/test-alice', ''],
    ];
    ss.insertSheet('StudentNotes').rows = [
      ['student_id', 'student_name', 'note_date', 'note_text', 'follow_up_date'],
      ['stu_01', 'Alice Smith', '2026-03-05', 'Standard lesson without follow up', ''],
      ['stu_01', 'Alice Smith', '2026-03-12', 'Algebra test prep', '2026-03-19'],
      ['stu_02', 'Charlie Brown', '2026-03-15', 'Ambiguous multiple session note', '2026-03-22'],
      ['stu_01', 'Alice Smith', '2026-04-01', 'Unmatched future note without session', '2026-04-08'],
    ];
    return ss;
  }

  beforeEach(() => {
    spreadsheet = setupTestSpreadsheet();
  });

  describe('Spreadsheet Targeting & Fail-Closed Guard', () => {
    it('rejects execution when spreadsheet ID does not match canonical ID without modifying sheets', () => {
      const wrongSs = setupTestSpreadsheet('unauthorized_spreadsheet_id_999');
      const res = runFourTableCanonicalMigration(wrongSs);
      expect(res.success).toBe(false);
      expect(res.code).toBe('INVALID_TARGET');
      expect(res.message).toContain('Target spreadsheet ID verification failed');

      // No schema mutation or backups should have occurred
      expect(wrongSs.getSheetByName('_Backup_Pre4Table_Students')).toBeNull();
      expect(wrongSs.getSheetByName('Students')!.rows[0].includes('primary_meeting_link')).toBe(false);
    });

    it('accepts execution when spreadsheet ID matches canonical target', () => {
      const res = runFourTableCanonicalMigration(spreadsheet);
      expect(res.success).toBe(true);
      expect(res.report.verified).toBe(true);
      expect(spreadsheet.getSheetByName('Students')!.rows[0].includes('primary_meeting_link')).toBe(true);
    });
  });

  describe('Follow-up Notes Migration & Archival', () => {
    it('migrates matched notes into session_notes and preserves follow-up notes in structured archive', () => {
      const res = runFourTableCanonicalMigration(spreadsheet);
      expect(res.success).toBe(true);

      const clsSheet = spreadsheet.getSheetByName('ClassSessions')!;
      // Alice 2026-03-05 (no follow up)
      const sess1 = clsSheet.rows.find((r) => r[0] === 'stu_01' && r[2] === '2026-03-05');
      expect(sess1![8]).toBe('Standard lesson without follow up');

      // Alice 2026-03-12 (matched with follow up)
      const sess2 = clsSheet.rows.find((r) => r[0] === 'stu_01' && r[2] === '2026-03-12');
      expect(sess2![8]).toBe('Algebra test prep (Follow-up: 2026-03-19)');

      // Verify _Archived_Historical_Notes
      const archSheet = spreadsheet.getSheetByName('_Archived_Historical_Notes')!;
      expect(archSheet).toBeDefined();

      // Alice follow-up note must be in archive
      const matchedArchived = archSheet.rows.find((r) => r[0] === 'stu_01' && r[1] === '2026-03-12');
      expect(matchedArchived).toBeDefined();
      expect(matchedArchived![2]).toBe('Algebra test prep');
      expect(matchedArchived![3]).toBe('2026-03-19');
      expect(matchedArchived![4]).toBe('MATCHED_WITH_FOLLOW_UP_DATE');

      // Ambiguous note must be in archive
      const ambiguousArchived = archSheet.rows.find((r) => r[0] === 'stu_02' && r[1] === '2026-03-15');
      expect(ambiguousArchived).toBeDefined();
      expect(ambiguousArchived![4]).toBe('AMBIGUOUS_MULTIPLE_SESSIONS');

      // Unmatched note must be in archive
      const unmatchedArchived = archSheet.rows.find((r) => r[0] === 'stu_01' && r[1] === '2026-04-01');
      expect(unmatchedArchived).toBeDefined();
      expect(unmatchedArchived![3]).toBe('2026-04-08');
      expect(unmatchedArchived![4]).toBe('UNMATCHED_NO_SESSION_ON_DATE');
    });

    it('is fully idempotent and does not duplicate session notes or archive records on rerun', () => {
      // First run
      const res1 = runFourTableCanonicalMigration(spreadsheet);
      expect(res1.success).toBe(true);

      const clsSheet = spreadsheet.getSheetByName('ClassSessions')!;
      const archSheet = spreadsheet.getSheetByName('_Archived_Historical_Notes')!;
      const clsRowCountBefore = clsSheet.rows.length;
      const archRowCountBefore = archSheet.rows.length;

      // Second run (simulate re-executing migration)
      const res2 = runFourTableCanonicalMigration(spreadsheet);
      expect(res2.success).toBe(true);

      expect(clsSheet.rows.length).toBe(clsRowCountBefore);
      expect(archSheet.rows.length).toBe(archRowCountBefore);

      const sess2 = clsSheet.rows.find((r) => r[0] === 'stu_01' && r[2] === '2026-03-12');
      expect(sess2![8]).toBe('Algebra test prep (Follow-up: 2026-03-19)');
    });

    it('supports skipBackups option: executes full migration without creating backup tabs', () => {
      const res = runFourTableCanonicalMigration(spreadsheet, { skipBackups: true });
      expect(res.success).toBe(true);
      expect(res.report.verified).toBe(true);
      expect(res.report.backupsCreated.length).toBe(0);

      // Verify no backup tabs were created
      expect(spreadsheet.getSheetByName('_Backup_Pre4Table_Students')).toBeNull();
      expect(spreadsheet.getSheetByName('_Backup_Pre4Table_ClassSessions')).toBeNull();
      expect(spreadsheet.getSheetByName('_Backup_Pre4Table_MeetingLinks')).toBeNull();
      expect(spreadsheet.getSheetByName('_Backup_Pre4Table_StudentNotes')).toBeNull();

      // Verify canonical migration succeeded and old tabs were deleted
      expect(spreadsheet.getSheetByName('Students')!.rows[0].includes('primary_meeting_link')).toBe(true);
      expect(spreadsheet.getSheetByName('ClassSessions')!.rows[0].includes('session_notes')).toBe(true);
      expect(spreadsheet.getSheetByName('MeetingLinks')).toBeNull();
      expect(spreadsheet.getSheetByName('StudentNotes')).toBeNull();
    });

    it('generates pre-migration inventory accurately across all canonical tabs', () => {
      const inv = generatePreMigrationInventory(spreadsheet);
      expect(inv.schemaMatch).toBe(true);
      expect(inv.missingExpectedTabs.length).toBe(0);
      expect(inv.rowCounts['Students']).toBe(3);
      expect(inv.rowCounts['Packages']).toBe(2);
      expect(inv.rowCounts['Payments']).toBe(2);
      expect(inv.rowCounts['ClassSessions']).toBe(5);
      expect(inv.rowCounts['MeetingLinks']).toBe(2);
      expect(inv.rowCounts['StudentNotes']).toBe(5);
      expect(inv.headers['Students']).toContain('student_id');
      expect(inv.headers['ClassSessions']).toContain('schedule_date');
    });

    it('executes read-only preflight and reports record-level analysis accurately without modifying data', () => {
      const pf = runFourTableMigrationPreflight(spreadsheet);
      expect(pf.meetingLinksAnalysis.totalRecords).toBe(1);
      expect(pf.meetingLinksAnalysis.withLink1).toBe(1);
      expect(pf.meetingLinksAnalysis.withLink2).toBe(0);
      expect(pf.meetingLinksAnalysis.orphanedStudentIds.length).toBe(0);

      expect(pf.studentNotesAnalysis.totalNotes).toBe(4);
      expect(pf.studentNotesAnalysis.matchedExactlyOne).toBe(2);
      expect(pf.studentNotesAnalysis.matchedMultiple).toBe(1); // stu_02 on 2026-03-15
      expect(pf.studentNotesAnalysis.matchedNone).toBe(1); // stu_01 on 2026-04-01
      expect(pf.studentNotesAnalysis.withFollowUpDate).toBe(3);

      expect(pf.classSessionsAnalysis.totalSessions).toBe(4);
      expect(pf.classSessionsAnalysis.duplicateStudentDateSessions.length).toBe(1);

      // Verify no changes were made to sheets
      expect(spreadsheet.getSheetByName('Students')!.rows[0].includes('primary_meeting_link')).toBe(false);
      expect(spreadsheet.getSheetByName('ClassSessions')!.rows[0].includes('session_notes')).toBe(false);
      expect(spreadsheet.getSheetByName('MeetingLinks')).toBeDefined();
      expect(spreadsheet.getSheetByName('StudentNotes')).toBeDefined();
    });
  });
});
