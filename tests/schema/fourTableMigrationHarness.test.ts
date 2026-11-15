import { describe, it, expect, beforeEach } from 'vitest';
import { MockSpreadsheet } from '../mocks/MockSpreadsheet';
// @ts-expect-error Apps script commonjs export
import { runFourTableCanonicalMigration, generatePreMigrationInventory, runFourTableMigrationPreflight } from '../../02-backend/apps-script/setup/FourTableMigration.gs';

describe('FourTableMigration Hardened Targeting, Preflight & Deletion Gates', () => {
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
      ['stu_03', 'Emma Wilson', 'Frank Wilson', '9876543214', 'frank@test.com', '9876543215', 'emma@test.com', 'Chemistry', 'ACTIVE'],
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
      ['stu_03', 'Emma Wilson', '2026-03-20', '11:00', 'ATTENDED', 'COMPLETED', true, ''],
    ];
    ss.insertSheet('MeetingLinks').rows = [
      ['student_id', 'student_name', 'meeting_link_1', 'meeting_link_2'],
      ['stu_01', 'Alice Smith', 'https://meet.google.com/test-shared-url', ''],
      ['stu_02', 'Charlie Brown', '', ''], // empty record
      ['stu_03', 'Emma Wilson', 'https://meet.google.com/test-shared-url', ''], // shared URL across 2 students
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

  describe('Focused 10 Edge Cases', () => {
    it('1. Empty link records are safely skipped', () => {
      const res = runFourTableCanonicalMigration(spreadsheet);
      expect(res.report.skippedEmptyMeetingLinks).toBe(1);
      // stu_02 has empty links, so stu_02 primary_meeting_link remains empty
      const stuSheet = spreadsheet.getSheetByName('Students')!;
      const colIdx = stuSheet.rows[0].indexOf('primary_meeting_link');
      const stu02Row = stuSheet.rows.find((r) => r[0] === 'stu_02')!;
      expect(stu02Row[colIdx]).toBeUndefined();
    });

    it('2. Empty link records do not block deletion after verification', () => {
      const res = runFourTableCanonicalMigration(spreadsheet);
      expect(res.report.skippedEmptyMeetingLinks).toBe(1);
      expect(res.report.meetingLinksDeletionEligible).toBe(true);
      expect(spreadsheet.getSheetByName('MeetingLinks')).toBeNull();
    });

    it('3. Conflicting links block MeetingLinks deletion', () => {
      const ss = setupTestSpreadsheet();
      const mlSheet = ss.getSheetByName('MeetingLinks')!;
      mlSheet.rows[1] = ['stu_01', 'Alice Smith', 'https://meet.google.com/link-a', 'https://meet.google.com/link-b'];

      const res = runFourTableCanonicalMigration(ss);
      expect(res.report.meetingLinksDeletionEligible).toBe(false);
      expect(res.report.meetingLinksBlockedReasons.some((r: string) => r.includes('Conflicting'))).toBe(true);
      expect(ss.getSheetByName('MeetingLinks')).toBeDefined();
    });

    it('4. Orphaned non-empty links block MeetingLinks deletion', () => {
      const ss = setupTestSpreadsheet();
      const mlSheet = ss.getSheetByName('MeetingLinks')!;
      mlSheet.rows.push(['unknown_stu_999', 'Ghost', 'https://meet.google.com/ghost', '']);

      const res = runFourTableCanonicalMigration(ss);
      expect(res.report.meetingLinksDeletionEligible).toBe(false);
      expect(res.report.meetingLinksBlockedReasons.some((r: string) => r.includes('Orphaned'))).toBe(true);
      expect(ss.getSheetByName('MeetingLinks')).toBeDefined();
    });

    it('5. Unmatched notes cannot be deleted unless archive preservation is verified', () => {
      const res = runFourTableCanonicalMigration(spreadsheet);
      expect(res.report.unmatchedNotes.length).toBe(1);
      const archSheet = spreadsheet.getSheetByName('_Archived_Historical_Notes')!;
      expect(archSheet).toBeDefined();
      expect(archSheet.rows.some((r) => r[4] === 'UNMATCHED_NO_SESSION_ON_DATE')).toBe(true);
      expect(res.report.studentNotesDeletionEligible).toBe(true);
    });

    it('6. Ambiguous notes cannot be deleted unless archive preservation is verified', () => {
      const res = runFourTableCanonicalMigration(spreadsheet);
      expect(res.report.ambiguousNotes.length).toBe(1);
      const archSheet = spreadsheet.getSheetByName('_Archived_Historical_Notes')!;
      expect(archSheet).toBeDefined();
      expect(archSheet.rows.some((r) => r[4] === 'AMBIGUOUS_MULTIPLE_SESSIONS')).toBe(true);
      expect(res.report.studentNotesDeletionEligible).toBe(true);
    });

    it('7. Archive verification failure blocks StudentNotes deletion', () => {
      const ss = setupTestSpreadsheet();
      const origInsert = ss.insertSheet.bind(ss);
      ss.insertSheet = (name: string) => {
        const sh = origInsert(name);
        if (name === '_Archived_Historical_Notes') {
          sh.appendRow = () => {}; // simulate persistence failure in archive sheet
        }
        return sh;
      };

      const res = runFourTableCanonicalMigration(ss);
      expect(res.report.studentNotesDeletionEligible).toBe(false);
      expect(res.report.studentNotesBlockedReasons.some((r: string) => r.includes('Archive verification'))).toBe(true);
      expect(ss.getSheetByName('StudentNotes')).toBeDefined(); // preserved!
    });

    it('8. Successful migration preserves all three current production notes', () => {
      const prodSs = setupTestSpreadsheet();
      const noteSheet = prodSs.getSheetByName('StudentNotes')!;
      noteSheet.rows = [
        ['student_id', 'student_name', 'note_date', 'note_text', 'follow_up_date'],
        ['stu_01', 'Alice Smith', '2026-03-05', 'Note 1 on lesson', ''],
        ['stu_01', 'Alice Smith', '2026-03-12', 'Note 2 on algebra', ''],
        ['stu_03', 'Emma Wilson', '2026-03-20', 'Note 3 on lab', ''],
      ];

      const res = runFourTableCanonicalMigration(prodSs);
      expect(res.report.migratedNotes).toBe(3);
      expect(res.report.unmatchedNotes.length).toBe(0);
      expect(res.report.ambiguousNotes.length).toBe(0);
      expect(res.report.studentNotesDeletionEligible).toBe(true);
      expect(prodSs.getSheetByName('StudentNotes')).toBeNull();

      // Verify all 3 notes exist in ClassSessions
      const clsSheet = prodSs.getSheetByName('ClassSessions')!;
      const notesColIdx = clsSheet.rows[0].indexOf('session_notes');
      const sessionWithNotes = clsSheet.rows.slice(1).filter((r) => Boolean(r[notesColIdx]));
      expect(sessionWithNotes.length).toBe(3);
    });

    it('9. Repeated migration does not duplicate session notes or archive records', () => {
      const res1 = runFourTableCanonicalMigration(spreadsheet);
      expect(res1.success).toBe(true);

      const clsSheet = spreadsheet.getSheetByName('ClassSessions')!;
      const archSheet = spreadsheet.getSheetByName('_Archived_Historical_Notes')!;
      const clsCountBefore = clsSheet.rows.length;
      const archCountBefore = archSheet.rows.length;

      const res2 = runFourTableCanonicalMigration(spreadsheet);
      expect(res2.success).toBe(true);
      expect(clsSheet.rows.length).toBe(clsCountBefore);
      expect(archSheet.rows.length).toBe(archCountBefore);
    });

    it('10. The existing shared URL across two students is not automatically treated as a conflict', () => {
      const pf = runFourTableMigrationPreflight(spreadsheet);
      expect(pf.meetingLinksAnalysis.sharedUrlsObservation.length).toBe(1);
      expect(pf.meetingLinksAnalysis.sharedUrlsObservation[0].url).toBe('https://meet.google.com/test-shared-url');
      expect(pf.meetingLinksAnalysis.sharedUrlsObservation[0].studentIds).toEqual(['stu_01', 'stu_03']);
      expect(pf.meetingLinksAnalysis.cannotBeMappedSafely.length).toBe(0);

      const res = runFourTableCanonicalMigration(spreadsheet);
      expect(res.report.conflictingMeetingLinks.length).toBe(0);
      expect(res.report.migratedMeetingLinks).toBe(2);
    });
  });
});
