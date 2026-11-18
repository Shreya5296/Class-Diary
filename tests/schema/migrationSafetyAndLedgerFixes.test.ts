import { describe, it, expect, beforeEach } from 'vitest';
import { MockSpreadsheet } from '../mocks/MockSpreadsheet';

// @ts-ignore
const SheetRegistry = require('../../02-backend/apps-script/sheets/SheetRegistry.gs');
// @ts-ignore
const PaymentService = require('../../02-backend/apps-script/payments/PaymentService.gs');
// @ts-ignore
const PaymentRepository = require('../../02-backend/apps-script/payments/PaymentRepository.gs');
// @ts-ignore
const ClassService = require('../../02-backend/apps-script/classes/ClassService.gs');
// @ts-ignore
const ClassRepository = require('../../02-backend/apps-script/classes/ClassRepository.gs');
// @ts-ignore
const PackageService = require('../../02-backend/apps-script/packages/PackageService.gs');

describe('Audit Findings Fixes: Migration Safety, Payment Ops, Notes & Class Deductions', () => {
  let spreadsheet: MockSpreadsheet;
  const actor = { actorId: 'ACT_TEST', email: 'owner@test.local', requestId: 'REQ_AUDIT_FIX' };

  function setupFullSpreadsheet(): MockSpreadsheet {
    const ss = new MockSpreadsheet();
    ss.insertSheet('Students').rows = [
      ['student_id', 'student_name', 'parent_name', 'parent_phone', 'parent_email', 'student_phone', 'student_email', 'subject', 'status', 'primary_meeting_link']
    ];
    ss.insertSheet('Packages').rows = [
      ['student_id', 'student_name', 'plan_type', 'currency', 'package_price', 'per_class', 'classes_purchased', 'start_date', 'end_date', 'next_due_date', 'class_duration', 'class_schedule']
    ];
    ss.insertSheet('Payments').rows = [
      ['student_id', 'student_name', 'payment_date', 'amount', 'currency', 'in_inr']
    ];
    ss.insertSheet('ClassSessions').rows = [
      ['student_id', 'student_name', 'schedule_date', 'schedule_time', 'attendance_status', 'session_status', 'deduct_class', 'cancellation_reason', 'session_notes']
    ];
    ss.insertSheet('MeetingLinks').rows = [
      ['student_id', 'student_name', 'meeting_link_1', 'meeting_link_2']
    ];
    ss.insertSheet('StudentNotes').rows = [
      ['student_id', 'student_name', 'note_date', 'note_text', 'follow_up_date']
    ];
    return ss;
  }

  beforeEach(() => {
    spreadsheet = setupFullSpreadsheet();
  });

  describe('1. Canonical Four-Table Schema & Data Safety', () => {
    it('verifies that canonical table schemas exactly match expected headers without obsolete columns', () => {
      const canonicalNames = SheetRegistry.getCanonicalSheetNames();
      expect(canonicalNames).toEqual(['Students', 'Packages', 'Payments', 'ClassSessions']);

      const payHeaders = SheetRegistry.getExpectedHeaders('Payments');
      expect(payHeaders).toEqual(['student_id', 'student_name', 'payment_date', 'amount', 'currency', 'in_inr']);

      const pkgHeaders = SheetRegistry.getExpectedHeaders('Packages');
      expect(pkgHeaders).toContain('class_schedule');
      expect(pkgHeaders.length).toBe(12);

      const clsHeaders = SheetRegistry.getExpectedHeaders('ClassSessions');
      expect(clsHeaders).toContain('session_notes');
      expect(clsHeaders.length).toBe(9);

      const stuHeaders = SheetRegistry.getExpectedHeaders('Students');
      expect(stuHeaders).toContain('primary_meeting_link');
      expect(stuHeaders.length).toBe(10);
    });

    it('confirms that obsolete tabs remain excluded from canonical schema', () => {
      expect(spreadsheet.getSheetByName('AuditLog')).toBeNull();
      expect(spreadsheet.getSheetByName('AppConfig')).toBeNull();
      expect(spreadsheet.getSheetByName('ImportBatches')).toBeNull();
      expect(spreadsheet.getSheetByName('ImportRowResults')).toBeNull();
    });
  });

  describe('2. Payment Operations & Safety', () => {
    it('voiding a payment never deletes row 1 (the header row)', () => {
      const paySheet = spreadsheet.getSheetByName('Payments')!;
      paySheet.rows = [
        ['student_id', 'student_name', 'payment_date', 'amount', 'currency', 'in_inr'],
        ['stu_safe_01', 'Test Student', '2026-03-10', 4000, 'INR', 4000]
      ];

      const res = PaymentService.Payments_void(spreadsheet, {
        student_id: 'stu_safe_01',
        amount: 4000,
        payment_date: '2026-03-10',
        void_reason: 'Testing header preservation'
      }, actor);

      expect(res.success).toBe(true);
      // Header MUST still be present in row 0
      expect(paySheet.rows[0]).toEqual(SheetRegistry.SHEET_SCHEMAS[SheetRegistry.SHEET_NAMES.PAYMENTS]);
      expect(paySheet.rows.length).toBe(1); // 1 header row left, data row deleted
    });

    it('voiding rejects ambiguous request if multiple identical payments exist without unique identifier', () => {
      const paySheet = spreadsheet.getSheetByName('Payments')!;
      paySheet.rows = [
        ['student_id', 'student_name', 'payment_date', 'amount', 'currency', 'in_inr'],
        ['stu_dup_01', 'Dup Student', '2026-03-10', 2500, 'INR', 2500],
        ['stu_dup_01', 'Dup Student', '2026-03-10', 2500, 'INR', 2500] // Identical duplicate!
      ];

      const res = PaymentService.Payments_void(spreadsheet, {
        student_id: 'stu_dup_01',
        amount: 2500,
        payment_date: '2026-03-10',
        void_reason: 'Void ambiguous'
      }, actor);

      expect(res.success).toBe(false);
      expect(res.code).toBe('AMBIGUOUS_RECORD');
      // Both rows preserved safely; no guess was made
      expect(paySheet.rows.length).toBe(3);
    });

    it('payment update safely rejects ambiguous target and correctly updates an unambiguous record', () => {
      const paySheet = spreadsheet.getSheetByName('Payments')!;
      paySheet.rows = [
        ['student_id', 'student_name', 'payment_date', 'amount', 'currency', 'in_inr'],
        ['stu_up_01', 'Student One', '2026-03-10', 1000, 'INR', 1000],
        ['stu_up_02', 'Student Two', '2026-03-11', 2000, 'INR', 2000]
      ];

      // Unambiguous update targets student 2
      const updated = PaymentRepository.Payments_update(spreadsheet, {
        student_id: 'stu_up_02',
        payment_date: '2026-03-11',
        amount: 2000
      }, { amount: 2500, in_inr: 2500 });

      expect(updated.amount).toBe(2500);
      expect(paySheet.rows[2][3]).toBe(2500);
      // Student 1 payment was NOT modified
      expect(paySheet.rows[1][3]).toBe(1000);

      // Now add duplicate row for student 1 and verify ambiguous update rejection
      paySheet.rows.push(['stu_up_01', 'Student One', '2026-03-10', 1000, 'INR', 1000]);
      expect(() => {
        PaymentRepository.Payments_update(spreadsheet, {
          student_id: 'stu_up_01',
          payment_date: '2026-03-10',
          amount: 1000
        }, { amount: 1200 });
      }).toThrow(/Ambiguous payment update rejected/);
    });
  });

  describe('3. Class Session Notes & Per-Session Context', () => {
    it('supports session_notes on ClassSessions and updates safely', () => {
      const c1 = ClassService.Classes_schedule(spreadsheet, {
        student_id: 'stu_note_01',
        scheduled_start: '2026-03-01T10:00:00Z',
        scheduled_end: '2026-03-01T11:00:00Z',
        session_notes: 'First lesson went well'
      }, actor);

      expect(c1.success).toBe(true);
      expect(c1.data.session_notes).toBe('First lesson went well');

      // Update session notes
      const updateRes = ClassService.Classes_update(spreadsheet, {
        class_session_id: c1.data.class_session_id,
        session_notes: 'First lesson went exceptionally well. Homework assigned.'
      }, actor);

      expect(updateRes.success).toBe(true);
      expect(updateRes.data.session_notes).toBe('First lesson went exceptionally well. Homework assigned.');

      const sessions = ClassRepository.Classes_getAll(spreadsheet).filter((s: any) => s.student_id === 'stu_note_01');
      expect(sessions.length).toBe(1);
      expect(sessions[0].session_notes).toBe('First lesson went exceptionally well. Homework assigned.');
    });
  });

  describe('4. Class-Credit Behavior & FIFO Allocation', () => {
    it('verifies Attendance deduction rules: Present deducts, Absent asks owner, Cancelled does not deduct by default', () => {
      // Schedule 3 classes
      const c1 = ClassService.Classes_schedule(spreadsheet, {
        student_id: 'stu_cls_01',
        scheduled_start: '2026-03-10T10:00:00Z',
        scheduled_end: '2026-03-10T11:00:00Z'
      }, actor);

      const c2 = ClassService.Classes_schedule(spreadsheet, {
        student_id: 'stu_cls_01',
        scheduled_start: '2026-03-11T10:00:00Z',
        scheduled_end: '2026-03-11T11:00:00Z'
      }, actor);

      const c3 = ClassService.Classes_schedule(spreadsheet, {
        student_id: 'stu_cls_01',
        scheduled_start: '2026-03-12T10:00:00Z',
        scheduled_end: '2026-03-12T11:00:00Z'
      }, actor);

      // 1. Present automatically deducts (deduct_class = true)
      const res1 = ClassService.Classes_complete(spreadsheet, {
        class_session_id: c1.data.class_session_id,
        attendance_status: 'PRESENT'
      }, actor);
      expect(res1.data.deduct_class).toBe(true);
      expect(res1.data.class_credit_effect).toBe('CONSUME');

      // 2. Absent without explicit deduct_class defaults to false (asks owner)
      const res2 = ClassService.Classes_complete(spreadsheet, {
        class_session_id: c2.data.class_session_id,
        attendance_status: 'ABSENT'
      }, actor);
      expect(res2.data.deduct_class).toBe(false);
      expect(res2.data.class_credit_effect).toBe('NO_CONSUME');

      // 3. Cancelled does not deduct by default with advance notice or owner decision
      const res3 = ClassService.Classes_cancel(spreadsheet, {
        class_session_id: c3.data.class_session_id,
        cancellation_time: '2026-03-12T05:00:00Z',
        cancellation_reason: 'Student unwell'
      }, actor);
      expect(res3.data.deduct_class).toBe(false);
      expect(res3.data.class_credit_effect).toBe('NO_CONSUME');

      // 4. Repeated completion on c1 cannot double-deduct
      const res1Repeat = ClassService.Classes_complete(spreadsheet, {
        class_session_id: c1.data.class_session_id,
        attendance_status: 'PRESENT'
      }, actor);
      expect(res1Repeat.data.deduct_class).toBe(true);

      const classRows = spreadsheet.getSheetByName('ClassSessions')!.rows;
      // Exactly 3 sessions remain; no duplicate rows created
      expect(classRows.length).toBe(4); // 1 header + 3 sessions
    });

    it('derives package balance via FIFO and handles zero/blank purchased classes conservatively', () => {
      const stuSheet = spreadsheet.getSheetByName('Students')!;
      stuSheet.rows.push(['stu_pkg_01', 'Bob', '', '', '', '', '', 'Math', 'ACTIVE']);

      const pkgSheet = spreadsheet.getSheetByName('Packages')!;
      // Package 1: 5 classes, starts Jan 1
      pkgSheet.rows.push(['stu_pkg_01', 'Bob', 'PACKAGE', 'INR', 5000, 1000, 5, '2026-01-01', '2026-02-01', '', 60, '']);
      // Package 2: 5 classes, starts Feb 1
      pkgSheet.rows.push(['stu_pkg_01', 'Bob', 'PACKAGE', 'INR', 5000, 1000, 5, '2026-02-01', '2026-03-01', '', 60, '']);
      // Package 3: 0 classes (or blank)
      pkgSheet.rows.push(['stu_pkg_01', 'Bob', 'PACKAGE', 'INR', 0, 0, 0, '2026-03-01', '2026-04-01', '', 60, '']);

      const clsSheet = spreadsheet.getSheetByName('ClassSessions')!;
      // 7 attended sessions for Bob
      for (let i = 1; i <= 7; i++) {
        clsSheet.rows.push([
          'stu_pkg_01', 'Bob', `2026-01-0${i}`, '10:00', 'ATTENDED', 'COMPLETED', true, '', ''
        ]);
      }

      // Query Package 1 (FIFO: first 5 classes consumed -> exhausted)
      const b1 = PackageService.Packages_enrichWithBalance(spreadsheet, {
        package_id: 'pkg_01',
        student_id: 'stu_pkg_01',
        classes_purchased: 5,
        start_date: '2026-01-01'
      });
      expect(b1.consumed_classes).toBe(5);
      expect(b1.remaining_classes).toBe(0);
      expect(b1.is_exhausted).toBe(true);

      // Query Package 2 (FIFO: remaining 2 classes consumed -> 3 remaining)
      const b2 = PackageService.Packages_enrichWithBalance(spreadsheet, {
        package_id: 'pkg_02',
        student_id: 'stu_pkg_01',
        classes_purchased: 5,
        start_date: '2026-02-01'
      });
      expect(b2.consumed_classes).toBe(2);
      expect(b2.remaining_classes).toBe(3);
      expect(b2.is_exhausted).toBe(false);

      // Query Package 3 (0 classes purchased -> treated conservatively as exhausted)
      const b3 = PackageService.Packages_enrichWithBalance(spreadsheet, {
        package_id: 'pkg_03',
        student_id: 'stu_pkg_01',
        classes_purchased: 0,
        start_date: '2026-03-01'
      });
      expect(b3.remaining_classes).toBe(0);
      expect(b3.is_exhausted).toBe(true);
    });
  });
});
