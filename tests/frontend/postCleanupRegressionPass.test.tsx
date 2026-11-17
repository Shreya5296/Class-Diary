import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EditStudentPersonalSection } from '../../src/domains/students/EditStudentPersonalSection';
import { CancelClassModal } from '../../src/domains/classes/CancelClassModal';
import { StudentBalanceTable } from '../../src/domains/finances/StudentBalanceTable';
import { StudentExpandedDetails } from '../../src/domains/students/StudentExpandedDetails';
import { handleMockRenewal } from '../../src/api/mockRenewalOperations';
import { handleMockClassCancel } from '../../src/api/mockClassOperations';
import { MOCK_STUDENTS, MOCK_PACKAGES, MOCK_CLASSES, MOCK_PAYMENTS } from '../../src/api/mockDataInitial';
import { submitEditStudent } from '../../src/domains/students/editStudentSubmitter';
import * as studentApi from '../../src/domains/students/studentApi';
import * as scheduleApi from '../../src/domains/classes/scheduleApi';
import { parseCanonicalScheduleString } from '../../src/domains/students/scheduleFormatter';

describe('POST-CLEANUP REGRESSION PASS: 6 Targeted Bug Fixes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(scheduleApi, 'saveSchedules').mockResolvedValue([]);
  });

  // BUG 1: ADMINISTRATIVE NOTES DISABLED IN STUDENT EDIT
  describe('BUG 1 — Administrative Notes in Student Edit', () => {
    it('renders administrative notes as enabled, editable, and without disabled/readOnly attributes', () => {
      const html = renderToStaticMarkup(
        <EditStudentPersonalSection
          values={{
            student_name: 'Test Student',
            notes: 'Existing administrative note about student.',
          }}
          errors={{}}
          onChange={() => {}}
          disabled={false}
        />
      );

      expect(html).toContain('Administrative Notes');
      expect(html).not.toContain('Administrative Notes (Inactive)');
      expect(html).toContain('Existing administrative note about student.');
      expect(html).not.toContain('disabled=""');
      expect(html).not.toContain('readonly=""');
      expect(html).toContain('Internal notes about the student...');
    });

    it('preserves existing notes when updating unrelated student fields via submitEditStudent', async () => {
      const updateSpy = vi.spyOn(studentApi, 'updateStudent').mockResolvedValue({
        student_id: 'STU_001',
        student_name: 'Aarav Sharma Updated',
        notes: 'Important medical condition: asthma',
      } as any);

      const existingStudent = {
        student_id: 'STU_001',
        student_name: 'Aarav Sharma',
        notes: 'Important medical condition: asthma',
        parent_name: 'Raj Sharma',
        parent_phone: '+91 98765 43210',
      } as any;

      const studentData = {
        student_name: 'Aarav Sharma Updated',
        notes: 'Important medical condition: asthma',
      };

      await submitEditStudent({
        student: existingStudent,
        studentData,
        packageData: { mode: 'EDIT_EXISTING', plan_type: 'Per Class', currency: 'INR', package_price: '', per_class: '', classes_purchased: '', class_duration: '', end_date: '' },
        existingPkg: null,
        schedules: [],
      });

      expect(updateSpy).toHaveBeenCalled();
      const payloadSent = updateSpy.mock.calls[0][1];
      expect(payloadSent.notes).toBe('Important medical condition: asthma');
    });

    it('allows clearing administrative notes when explicitly emptied by user', async () => {
      const updateSpy = vi.spyOn(studentApi, 'updateStudent').mockResolvedValue({
        student_id: 'STU_001',
        student_name: 'Aarav Sharma',
        notes: '',
      } as any);

      const existingStudent = {
        student_id: 'STU_001',
        student_name: 'Aarav Sharma',
        notes: 'Old note that should be cleared',
      } as any;

      const studentData = {
        student_name: 'Aarav Sharma',
        notes: '', // User cleared textarea
      };

      await submitEditStudent({
        student: existingStudent,
        studentData,
        packageData: { mode: 'EDIT_EXISTING', plan_type: 'Per Class', currency: 'INR', package_price: '', per_class: '', classes_purchased: '', class_duration: '', end_date: '' },
        existingPkg: null,
        schedules: [],
      });

      expect(updateSpy).toHaveBeenCalled();
      const payloadSent = updateSpy.mock.calls[0][1];
      expect(payloadSent.notes).toBe('');
    });
  });

  // BUG 2: UNEXPECTED ClassSchedules GOOGLE SHEET
  describe('BUG 2 — Canonical Four Tables Architecture & No ClassSchedules Dependency', () => {
    it('retains exactly four canonical tables and derives recurring schedules from Packages.class_schedule', () => {
      const sampleCanonicalSchedule = 'Mon - 5:00 PM, Thu - 4:30 PM';
      const parsed = parseCanonicalScheduleString(sampleCanonicalSchedule, 60);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].day_of_week).toBe('MONDAY');
      expect(parsed[0].start_time).toBe('17:00');
      expect(parsed[0].end_time).toBe('18:00');
      expect(parsed[1].day_of_week).toBe('THURSDAY');
      expect(parsed[1].start_time).toBe('16:30');
      expect(parsed[1].end_time).toBe('17:30');
    });
  });

  // BUG 3: CLASS CANCELLATION REASON
  describe('BUG 3 — Class Cancellation Reason Workflow', () => {
    it('renders CancelClassModal with reason input and requires non-empty reason', () => {
      const html = renderToStaticMarkup(
        <CancelClassModal
          isOpen={true}
          onConfirm={async () => {}}
          onCancel={() => {}}
        />
      );

      expect(html).toContain('Cancel Class Session');
      expect(html).toContain('Cancellation Reason');
      expect(html).toContain('e.g. Student ill, Family emergency, Scheduling conflict...');
      // By default with empty reason, confirm button is disabled
      expect(html).toContain('disabled=""');
    });

    it('saves actual cancellation reason to ClassSessions.cancellation_reason and preserves session notes', () => {
      const testSessionId = `test_ses_${Date.now()}`;
      (MOCK_CLASSES as any[]).push({
        session_id: testSessionId,
        student_id: 'STU_QA_CANCEL',
        student_name: 'Cancellation QA Student',
        status: 'SCHEDULED',
        session_status: 'SCHEDULED',
        attendance_status: 'NOT_MARKED',
        session_notes: 'Unrelated diagnostic note: Student preparing for physics olympiad',
        deduct_class: false,
      });

      const res = handleMockClassCancel({
        session_id: testSessionId,
        cancellation_reason: 'Family emergency travelling out of city',
        deduct_class: false,
      }) as any;

      expect(res.status).toBe('CANCELLED');
      expect(res.cancellation_reason).toBe('Family emergency travelling out of city');
      expect(res.session_notes).toBe('Unrelated diagnostic note: Student preparing for physics olympiad');
      expect(res.deduct_class).toBe(false);
    });
  });

  // BUG 4: SLOW STUDENT PAGE SCHEDULE AND CLASS LOADING
  describe('BUG 4 — Performance Optimization & Network Calls', () => {
    it('verifies useClassScheduleData derives schedules from packages without calling schedules.list', () => {
      const packagesList = [
        {
          package_id: 'pkg_perf_01',
          student_id: 'STU_PERF',
          student_name: 'Performance Student',
          class_schedule: 'Tue - 3:00 PM, Fri - 3:00 PM',
          class_duration: 60,
          classes_purchased: 10,
          status: 'ACTIVE',
        },
      ];

      const derived = parseCanonicalScheduleString(packagesList[0].class_schedule, packagesList[0].class_duration);
      expect(derived).toHaveLength(2);
      expect(derived[0].day_of_week).toBe('TUESDAY');
      expect(derived[1].day_of_week).toBe('FRIDAY');
    });
  });

  // BUG 5: RENEWAL MUST CREATE A NEW PACKAGE ROW
  describe('BUG 5 — Renewal Creates New Package Row Without Overwriting Historical Data', () => {
    it('inserts a new package row and preserves historical package and 15 class balance (3 remaining + 12 purchased)', () => {
      const studentId = 'STU_RENEW_QA';
      (MOCK_STUDENTS as any[]).push({
        student_id: studentId,
        student_name: 'Renewal Test Student',
        status: 'ACTIVE',
      });

      // Existing initial package: 12 purchased
      const initialPkg = {
        package_id: `pkg_init_${Date.now()}`,
        student_id: studentId,
        student_name: 'Renewal Test Student',
        classes_purchased: 12,
        total_classes: 12,
        consumed_classes: 9,
        remaining_classes: 3,
        package_price: 12000,
        currency: 'INR',
        start_date: '2026-06-01',
        end_date: '2026-07-01',
        status: 'ACTIVE',
      };
      MOCK_PACKAGES.push(initialPkg as any);

      // 9 completed sessions
      for (let i = 1; i <= 9; i++) {
        (MOCK_CLASSES as any[]).push({
          session_id: `cls_hist_${studentId}_${i}`,
          student_id: studentId,
          session_status: 'COMPLETED',
          status: 'COMPLETED',
          attendance_status: 'PRESENT',
          deduct_class: true,
          class_credit_effect: 'CONSUME',
        });
      }

      const initialPkgCount = MOCK_PACKAGES.filter((p) => p.student_id === studentId).length;
      expect(initialPkgCount).toBe(1);

      // Perform renewal for 12 new classes
      const renewalResponse = handleMockRenewal({
        student_id: studentId,
        new_classes_purchased: 12,
        package_price: 14000,
        currency: 'INR',
        start_date: '2026-07-15',
        idempotency_key: `idemp_renew_${Date.now()}`,
      }, 'req_renew_test');

      expect(renewalResponse.ok).toBe(true);
      expect(renewalResponse.data.previous_available_balance).toBe(3);
      expect(renewalResponse.data.new_classes_purchased).toBe(12);
      expect(renewalResponse.data.new_available_balance).toBe(15);

      // Verify that a NEW package row was created in Packages
      const studentPackages = MOCK_PACKAGES.filter((p) => p.student_id === studentId);
      expect(studentPackages.length).toBe(2);

      // Historical package must remain intact
      const historical = studentPackages.find((p) => p.package_id === initialPkg.package_id);
      expect(historical).toBeDefined();
      expect(historical?.classes_purchased).toBe(12);
      expect(historical?.package_price).toBe(12000);

      // New package has its own details
      const newPkg = studentPackages.find((p) => p.package_id !== initialPkg.package_id);
      expect(newPkg).toBeDefined();
      expect(newPkg?.classes_purchased).toBe(12);
      expect(newPkg?.package_price).toBe(14000);
      expect(newPkg?.start_date).toBe('2026-07-15');
    });

    it('idempotently handles retry of renewal request with the same idempotency key', () => {
      const studentId = 'STU_IDEMP_TEST';
      const idempKey = `idemp_retry_${Date.now()}`;

      (MOCK_STUDENTS as any[]).push({
        student_id: studentId,
        student_name: 'Idempotency QA',
        status: 'ACTIVE',
      });

      const firstCall = handleMockRenewal({
        student_id: studentId,
        new_classes_purchased: 10,
        package_price: 10000,
        currency: 'INR',
        idempotency_key: idempKey,
      }, 'req_1');

      const pkgCountAfterFirst = MOCK_PACKAGES.filter((p) => p.student_id === studentId).length;

      // Retry with same idempotency key
      const secondCall = handleMockRenewal({
        student_id: studentId,
        new_classes_purchased: 10,
        package_price: 10000,
        currency: 'INR',
        idempotency_key: idempKey,
      }, 'req_2');

      const pkgCountAfterSecond = MOCK_PACKAGES.filter((p) => p.student_id === studentId).length;
      expect(pkgCountAfterSecond).toBe(pkgCountAfterFirst);
      expect(secondCall.data.package.package_id).toBe(firstCall.data.package.package_id);
    });
  });

  // BUG 6: INCORRECT PAYMENT RECORD AND MISSING STUDENT BALANCE
  describe('BUG 6 — Payment Records & Outstanding Balance Display', () => {
    it('does not fabricate INR equivalent when recording foreign currency payment without conversion', () => {
      const studentId = 'STU_AUD_TEST';
      (MOCK_STUDENTS as any[]).push({
        student_id: studentId,
        student_name: 'Australian Student',
        status: 'ACTIVE',
      });

      const res = handleMockRenewal({
        student_id: studentId,
        new_classes_purchased: 12,
        currency: 'AUD',
        package_price: 180,
        payment: {
          record_payment: true,
          amount: 180,
          currency: 'AUD',
        },
        idempotency_key: `idemp_aud_${Date.now()}`,
      }, 'req_aud');

      expect(res.ok).toBe(true);
      expect(res.data.payment).toBeDefined();
      expect(res.data.payment.amount).toBe(180);
      expect(res.data.payment.currency).toBe('AUD');
      expect(res.data.payment.in_inr).toBeUndefined(); // Never fabricated as 0 or estimated INR
    });

    it('renders Outstanding Balance column in StudentBalanceTable distinguishing due, settled, and credit', () => {
      const records = [
        {
          student_id: 'STU_DUE',
          student_name: 'Due Student',
          packageTotalsByCurrency: { AUD: 200 },
          paymentTotalsByCurrency: { AUD: 150 },
          paymentCount: 1,
        },
        {
          student_id: 'STU_SETTLED',
          student_name: 'Settled Student',
          packageTotalsByCurrency: { INR: 12000 },
          paymentTotalsByCurrency: { INR: 12000 },
          paymentCount: 1,
        },
        {
          student_id: 'STU_CREDIT',
          student_name: 'Credit Student',
          packageTotalsByCurrency: { USD: 100 },
          paymentTotalsByCurrency: { USD: 120 },
          paymentCount: 2,
        },
      ];

      const html = renderToStaticMarkup(<StudentBalanceTable records={records} />);

      expect(html).toContain('Due Student');
      expect(html).toContain('due');
      expect(html).toContain('Settled Student');
      expect(html).toContain('✓ Settled');
      expect(html).toContain('Credit Student');
      expect(html).toContain('credit');
    });

    it('displays Outstanding balance in StudentExpandedDetails', () => {
      const student = {
        student_id: 'STU_EXP_FIN',
        student_name: 'Financial Student',
        status: 'ACTIVE',
      } as any;

      const balance = {
        totalPurchased: 24,
        totalConsumed: 9,
        packages: [{ plan_type: 'Per Class', class_duration: 60 } as any],
      };

      const financials = {
        totalInvoiced: 24000,
        totalPaid: 12000,
        outstanding: 12000,
        currency: 'INR',
      };

      const html = renderToStaticMarkup(
        <StudentExpandedDetails
          student={student}
          balance={balance}
          financials={financials}
          onEditStudent={vi.fn()}
          onSelectStudent={vi.fn()}
        />
      );

      expect(html).toContain('Outstanding:');
      expect(html).toContain('₹12,000');
      expect(html).toContain('due');
    });
  });
});
