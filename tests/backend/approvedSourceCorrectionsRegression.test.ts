import { describe, it, expect, beforeEach } from 'vitest';
import { MockSpreadsheet } from '../mocks/MockSpreadsheet';

// @ts-ignore
const StudentService = require('../../02-backend/apps-script/students/StudentService.gs');
// @ts-ignore
const StudentRepository = require('../../02-backend/apps-script/students/StudentRepository.gs');
// @ts-ignore
const PackageService = require('../../02-backend/apps-script/packages/PackageService.gs');
// @ts-ignore
const PackageRepository = require('../../02-backend/apps-script/packages/PackageRepository.gs');
// @ts-ignore
const ClassScheduleService = require('../../02-backend/apps-script/classes/ClassScheduleService.gs');
// @ts-ignore
const RenewalService = require('../../02-backend/apps-script/packages/RenewalService.gs');
// @ts-ignore
const PaymentRepository = require('../../02-backend/apps-script/payments/PaymentRepository.gs');
// @ts-ignore
const PaymentService = require('../../02-backend/apps-script/payments/PaymentService.gs');
// @ts-ignore
const RenewalIdempotency = require('../../02-backend/apps-script/packages/RenewalIdempotency.gs');
// @ts-ignore
const ClassRepository = require('../../02-backend/apps-script/classes/ClassRepository.gs');

describe('APPROVED BACKEND SOURCE CORRECTIONS REGRESSION SUITE', () => {
  let spreadsheet: MockSpreadsheet;
  const adminActor = { actorId: 'ACT_ADMIN', email: 'admin@example.com', role: 'admin' };

  beforeEach(() => {
    spreadsheet = new MockSpreadsheet();

    // Students sheet
    const stuSheet = spreadsheet.insertSheet('Students');
    stuSheet.appendRow([
      'student_id', 'student_name', 'parent_name', 'parent_phone', 'parent_email',
      'student_phone', 'student_email', 'subject', 'status', 'primary_meeting_link', 'notes'
    ]);

    // Packages sheet
    const pkgSheet = spreadsheet.insertSheet('Packages');
    pkgSheet.appendRow([
      'student_id', 'student_name', 'plan_type', 'currency', 'package_price',
      'per_class', 'classes_purchased', 'start_date', 'end_date', 'next_due_date',
      'class_duration', 'class_schedule'
    ]);

    // Payments sheet (6 columns)
    const paySheet = spreadsheet.insertSheet('Payments');
    paySheet.appendRow([
      'student_id', 'student_name', 'payment_date', 'amount', 'currency', 'in_inr'
    ]);

    // ClassSessions sheet (9 columns)
    const clsSheet = spreadsheet.insertSheet('ClassSessions');
    clsSheet.appendRow([
      'student_id', 'student_name', 'schedule_date', 'schedule_time',
      'attendance_status', 'session_status', 'deduct_class', 'cancellation_reason', 'session_notes'
    ]);

    // @ts-ignore
    if (typeof globalThis !== 'undefined') {
      // @ts-ignore
      globalThis.__renewalIdempCache = {};
      // @ts-ignore
      globalThis.__mockPropertiesStore = {};
    }
  });

  // FIX 1 — Administrative Notes
  describe('FIX 1 — Administrative Notes Persistence, Clearing, and Omission', () => {
    it('preserves existing notes when omitted in updates, and when unrelated fields change', () => {
      const createRes = StudentService.Students_create(spreadsheet, {
        student_name: 'Ananya Roy',
        parent_name: 'Deb Roy',
        parent_phone: '+91 98765 00001',
        subject: 'Math',
        notes: 'Initial administrative note: prefers weekend morning slots'
      }, adminActor);

      expect(createRes.success).toBe(true);
      const sid = createRes.data.student_id;

      // Unrelated update: update parent phone without passing notes
      const updateRes1 = StudentService.Students_update(spreadsheet, sid, {
        parent_phone: '+91 98765 99999'
      }, adminActor);

      expect(updateRes1.success).toBe(true);
      expect(updateRes1.data.parent_phone).toBe('+91 98765 99999');
      expect(updateRes1.data.notes).toBe('Initial administrative note: prefers weekend morning slots');

      const reloaded1 = StudentRepository.Students_getById(spreadsheet, sid);
      expect(reloaded1.notes).toBe('Initial administrative note: prefers weekend morning slots');
    });

    it('updates notes when explicitly supplied with non-empty string', () => {
      const createRes = StudentService.Students_create(spreadsheet, {
        student_name: 'Rohan Sen',
        parent_name: 'Amit Sen',
        parent_phone: '+91 98765 00002',
        notes: 'Old note'
      }, adminActor);
      const sid = createRes.data.student_id;

      const updateRes = StudentService.Students_update(spreadsheet, sid, {
        notes: 'Updated note: student preparing for competition'
      }, adminActor);

      expect(updateRes.success).toBe(true);
      expect(updateRes.data.notes).toBe('Updated note: student preparing for competition');

      const reloaded = StudentRepository.Students_getById(spreadsheet, sid);
      expect(reloaded.notes).toBe('Updated note: student preparing for competition');
    });

    it('clears notes when explicitly supplied as an empty string', () => {
      const createRes = StudentService.Students_create(spreadsheet, {
        student_name: 'Priya Das',
        parent_name: 'S Das',
        parent_phone: '+91 98765 00003',
        notes: 'Note to be cleared'
      }, adminActor);
      const sid = createRes.data.student_id;

      const updateRes = StudentService.Students_update(spreadsheet, sid, {
        notes: ''
      }, adminActor);

      expect(updateRes.success).toBe(true);
      expect(updateRes.data.notes).toBe('');

      const reloaded = StudentRepository.Students_getById(spreadsheet, sid);
      expect(reloaded.notes).toBe('');
    });
  });

  // FIX 2 — Remove ClassSchedules as a Data Table
  describe('FIX 2 — Canonical Four Tables Architecture & No ClassSchedules Sheet', () => {
    it('persists schedules exclusively into Packages.class_schedule and never creates ClassSchedules tab', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Kavita Mehta',
        parent_name: 'V Mehta',
        parent_phone: '+91 98765 00004',
        subject: 'Vedic Math'
      }, adminActor);
      const sid = s.data.student_id;

      PackageService.Packages_create(spreadsheet, {
        student_id: sid,
        plan_type: 'Per Class',
        currency: 'INR',
        package_price: 10000,
        classes_purchased: 10,
        class_duration: 60,
        start_date: '2026-10-01'
      }, adminActor);

      // Save schedule
      const saveRes = ClassScheduleService.Schedules_save(spreadsheet, sid, [
        { day_of_week: 'MONDAY', start_time: '17:00', end_time: '18:00' },
        { day_of_week: 'THURSDAY', start_time: '16:30', end_time: '17:30' }
      ], adminActor);

      expect(saveRes.success).toBe(true);
      expect(saveRes.meta.source).toBe('Packages');

      // VERIFY: Fifth sheet ClassSchedules was NOT created
      expect(spreadsheet.getSheetByName('ClassSchedules')).toBeNull();

      // VERIFY: Schedule written to Packages.class_schedule
      const pkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(pkgs.length).toBe(1);
      expect(pkgs[0].class_schedule).toBe('Mon - 5:00 PM, Thu - 4:30 PM');

      // VERIFY: Schedules_list derives from Packages
      const listRes = ClassScheduleService.Schedules_list(spreadsheet, sid);
      expect(listRes.success).toBe(true);
      expect(listRes.data.length).toBe(2);
      expect(listRes.data[0].day_of_week).toBe('MONDAY');
      expect(listRes.data[0].start_time).toBe('17:00');
      expect(listRes.data[1].day_of_week).toBe('THURSDAY');
      expect(listRes.data[1].start_time).toBe('16:30');
    });

    it('correctly updates the active package and preserves historical packages when student has multiple packages', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Vikram Joshi',
        parent_name: 'S Joshi',
        parent_phone: '+91 98765 00005',
        subject: 'Physics'
      }, adminActor);
      const sid = s.data.student_id;

      // Historical package (completed/older)
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid,
        student_name: 'Vikram Joshi',
        plan_type: 'Per Class',
        currency: 'INR',
        package_price: 8000,
        classes_purchased: 8,
        start_date: '2026-08-01',
        end_date: '2026-09-01',
        class_duration: 60,
        class_schedule: 'Wed - 4:00 PM',
        status: 'COMPLETED'
      });

      // Active package
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid,
        student_name: 'Vikram Joshi',
        plan_type: 'Per Class',
        currency: 'INR',
        package_price: 12000,
        classes_purchased: 12,
        start_date: '2026-10-01',
        end_date: '2026-12-01',
        class_duration: 60,
        class_schedule: 'Fri - 5:00 PM',
        status: 'ACTIVE'
      });

      // Save a new schedule for Vikram
      ClassScheduleService.Schedules_save(spreadsheet, sid, [
        { day_of_week: 'SATURDAY', start_time: '11:00', end_time: '12:00' }
      ], adminActor);

      const pkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(pkgs.length).toBe(2);

      const historical = pkgs.find((p: any) => p.start_date === '2026-08-01');
      const active = pkgs.find((p: any) => p.start_date === '2026-10-01');

      // Historical package must NOT be modified
      expect(historical.class_schedule).toBe('Wed - 4:00 PM');
      expect(historical.classes_purchased).toBe(8);

      // Active package receives the new schedule
      expect(active.class_schedule).toBe('Sat - 11:00 AM');
      expect(active.classes_purchased).toBe(12);

      // No ClassSchedules sheet exists
      expect(spreadsheet.getSheetByName('ClassSchedules')).toBeNull();
    });
  });

  // FIX 3 & FIX 4 — Renewal Must Insert a New Package & Payment Integrity
  describe('FIX 3 & 4 — Renewal Creates New Package Row Without Overwriting Historical Data', () => {
    it('executes class balance rule: 12 purchased, 9 consumed (3 remaining) + 12 newly purchased = 15 available balance', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Tara Bose',
        parent_name: 'K Bose',
        parent_phone: '+91 98765 00006',
        subject: 'Chemistry'
      }, adminActor);
      const sid = s.data.student_id;

      // Package 1: 12 purchased, price 12000
      PackageService.Packages_create(spreadsheet, {
        student_id: sid,
        plan_type: 'Per Class',
        currency: 'INR',
        package_price: 12000,
        classes_purchased: 12,
        start_date: '2026-06-01'
      }, adminActor);

      // Record 9 completed sessions
      for (let i = 1; i <= 9; i++) {
        const day = i < 10 ? `0${i}` : `${i}`;
        ClassRepository.Classes_insert(spreadsheet, {
          student_id: sid,
          student_name: 'Tara Bose',
          schedule_date: `2026-06-${day}`,
          schedule_time: '14:00',
          attendance_status: 'PRESENT',
          session_status: 'COMPLETED',
          deduct_class: true
        });
      }

      // Renew with 12 newly purchased classes, price 14000, with payment of 14000
      const renewalRes = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid,
        new_classes_purchased: 12,
        currency: 'INR',
        package_price: 14000,
        start_date: '2026-07-01',
        payment: {
          record_payment: true,
          amount: 14000,
          currency: 'INR'
        },
        idempotency_key: 'idemp_tara_renewal'
      }, adminActor);

      expect(renewalRes.success).toBe(true);
      expect(renewalRes.data.previous_available_balance).toBe(3);
      expect(renewalRes.data.new_classes_purchased).toBe(12);
      expect(renewalRes.data.new_available_balance).toBe(15);
      expect(renewalRes.data.cumulative_purchased).toBe(24);
      expect(renewalRes.data.cumulative_consumed).toBe(9);

      // CRITICAL ASSERTION: Two separate package rows exist in Packages sheet
      const pkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(pkgs.length).toBe(2);

      // Historical row remains unchanged (12 purchased, price 12000)
      const historicalPkg = pkgs.find((p: any) => p.start_date === '2026-06-01');
      expect(historicalPkg.classes_purchased).toBe(12);
      expect(historicalPkg.package_price).toBe(12000);

      // New package row stores newly purchased classes (12 purchased, price 14000)
      const newPkg = pkgs.find((p: any) => p.start_date === '2026-07-01');
      expect(newPkg.classes_purchased).toBe(12);
      expect(newPkg.package_price).toBe(14000);

      // Neither individual row stores 24
      expect(pkgs.every((p: any) => p.classes_purchased !== 24)).toBe(true);

      // Payment record verified
      const pays = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid);
      expect(pays.length).toBe(1);
      expect(pays[0].amount).toBe(14000);
      expect(pays[0].currency).toBe('INR');
      expect(pays[0].in_inr).toBe(14000);
    });

    it('idempotently prevents duplicate package rows and duplicate payments on retry', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Idemp Student',
        parent_name: 'P Idemp',
        parent_phone: '+91 98765 00007',
        subject: 'Math'
      }, adminActor);
      const sid = s.data.student_id;

      PackageService.Packages_create(spreadsheet, {
        student_id: sid,
        plan_type: 'Per Class',
        currency: 'USD',
        package_price: 300,
        classes_purchased: 10,
        start_date: '2026-05-01'
      }, adminActor);

      const idempKey = 'idemp_key_unique_test';
      const payload = {
        student_id: sid,
        new_classes_purchased: 10,
        currency: 'USD',
        package_price: 350,
        start_date: '2026-06-01',
        payment: {
          record_payment: true,
          amount: 350,
          currency: 'USD'
        },
        idempotency_key: idempKey
      };

      // First renewal attempt
      const res1 = RenewalService.Packages_renew(spreadsheet, payload, adminActor);
      expect(res1.success).toBe(true);

      // Verify state after first attempt
      const pkgsAfterFirst = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(pkgsAfterFirst.length).toBe(2);
      const paysAfterFirst = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid);
      expect(paysAfterFirst.length).toBe(1);

      // In foreign currency payment, amount and currency are strictly preserved and in_inr is blank string
      expect(paysAfterFirst[0].amount).toBe(350);
      expect(paysAfterFirst[0].currency).toBe('USD');
      expect(paysAfterFirst[0].in_inr).toBe('');
      expect(paysAfterFirst[0].in_inr).not.toBe(0);

      // Retry renewal with SAME idempotency key
      const res2 = RenewalService.Packages_renew(spreadsheet, payload, adminActor);
      expect(res2.success).toBe(true);

      // Packages and Payments rows must NOT be duplicated
      const pkgsAfterRetry = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(pkgsAfterRetry.length).toBe(2);
      const paysAfterRetry = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid);
      expect(paysAfterRetry.length).toBe(1);
    });
  });

  // SECTION 1 — PaymentService Foreign-Currency Conversion & Row Inspection
  describe('SECTION 1 — PaymentService Foreign-Currency Conversion & Row Inspection', () => {
    it('stores payment amount in in_inr when currency is INR', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'INR Payee', parent_name: 'P Parent', parent_phone: '+91 98765 10001'
      }, adminActor);
      const sid = s.data.student_id;

      const rec = PaymentService.Payments_record(spreadsheet, {
        student_id: sid,
        amount: 5000,
        currency: 'INR',
        payment_date: '2026-11-01'
      }, adminActor);

      expect(rec.success).toBe(true);
      expect(rec.data.amount).toBe(5000);
      expect(rec.data.currency).toBe('INR');
      expect(rec.data.in_inr).toBe(5000);

      // Inspect sheet row directly
      const paySheet = spreadsheet.getSheetByName('Payments');
      const lastRowValues = paySheet.rows[paySheet.rows.length - 1];
      expect(lastRowValues[3]).toBe(5000); // amount
      expect(lastRowValues[4]).toBe('INR'); // currency
      expect(lastRowValues[5]).toBe(5000); // in_inr
    });

    it('stores explicit in_inr when supplied for foreign-currency payment', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'USD Payee Explicit', parent_name: 'P Parent', parent_phone: '+91 98765 10002'
      }, adminActor);
      const sid = s.data.student_id;

      const rec = PaymentService.Payments_record(spreadsheet, {
        student_id: sid,
        amount: 300,
        currency: 'USD',
        in_inr: 25500,
        payment_date: '2026-11-02'
      }, adminActor);

      expect(rec.success).toBe(true);
      expect(rec.data.amount).toBe(300);
      expect(rec.data.currency).toBe('USD');
      expect(rec.data.in_inr).toBe(25500);

      const paySheet = spreadsheet.getSheetByName('Payments');
      const lastRowValues = paySheet.rows[paySheet.rows.length - 1];
      expect(lastRowValues[3]).toBe(300);
      expect(lastRowValues[4]).toBe('USD');
      expect(lastRowValues[5]).toBe(25500);
    });

    it('stores calculated in_inr when valid conversion_rate or exchange_rate is supplied', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'USD Rate Payee', parent_name: 'P Parent', parent_phone: '+91 98765 10003'
      }, adminActor);
      const sid = s.data.student_id;

      const rec = PaymentService.Payments_record(spreadsheet, {
        student_id: sid,
        amount: 100,
        currency: 'USD',
        conversion_rate: 85.5,
        payment_date: '2026-11-03'
      }, adminActor);

      expect(rec.success).toBe(true);
      expect(rec.data.amount).toBe(100);
      expect(rec.data.currency).toBe('USD');
      expect(rec.data.in_inr).toBe(8550);

      const paySheet = spreadsheet.getSheetByName('Payments');
      const lastRowValues = paySheet.rows[paySheet.rows.length - 1];
      expect(lastRowValues[5]).toBe(8550);
    });

    it('stores empty string (never zero) when foreign currency has no conversion', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'USD No Rate Payee', parent_name: 'P Parent', parent_phone: '+91 98765 10004'
      }, adminActor);
      const sid = s.data.student_id;

      const rec = PaymentService.Payments_record(spreadsheet, {
        student_id: sid,
        amount: 250,
        currency: 'USD',
        payment_date: '2026-11-04'
      }, adminActor);

      expect(rec.success).toBe(true);
      expect(rec.data.amount).toBe(250);
      expect(rec.data.currency).toBe('USD');
      expect(rec.data.in_inr).toBe('');
      expect(rec.data.in_inr).not.toBe(0);

      const paySheet = spreadsheet.getSheetByName('Payments');
      const lastRowValues = paySheet.rows[paySheet.rows.length - 1];
      expect(lastRowValues[3]).toBe(250);
      expect(lastRowValues[4]).toBe('USD');
      expect(lastRowValues[5]).toBe('');
      expect(lastRowValues[5]).not.toBe(0);
    });
  });

  // SECTION 3 — Row-Specific Renewal Retry Recovery Across Multi-Package Scenarios
  describe('SECTION 3 — Row-Specific Renewal Retry Recovery Across Multi-Package Scenarios', () => {
    it('Case 1: Stops before package row index persistence -> retry fails closed with AMBIGUOUS_RENEWAL_RECOVERY without duplicate package or payment', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Retry Case 1', parent_name: 'P One', parent_phone: '+91 98765 20001'
      }, adminActor);
      const sid = s.data.student_id;

      // Existing historical package
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Retry Case 1', plan_type: 'Per Class',
        currency: 'INR', package_price: 10000, classes_purchased: 10, start_date: '2026-01-01'
      });

      const key = 'idemp_case_1';
      const pkgSheet1 = spreadsheet.getSheetByName('Packages');
      const preRow1 = pkgSheet1 ? pkgSheet1.getLastRow() : 0;
      // Simulate intent written where inserted_row_index was never confirmed
      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 10, 20, {
        new_classes_purchased: 10, currency: 'INR', package_price: 12000, start_date: '2026-02-01',
        payment: { amount: 12000, currency: 'INR', record_payment: true }
      }, adminActor, [], '', 1, preRow1);

      // Client retries with the same key
      const res = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid,
        new_classes_purchased: 10,
        currency: 'INR',
        package_price: 12000,
        start_date: '2026-02-01',
        payment: { amount: 12000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      // Must fail closed because durable store cannot prove whether insertion was attempted
      expect(res.success).toBe(false);
      expect(res.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');

      // Zero new packages inserted
      const pkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(pkgs.length).toBe(1);
      expect(pkgs[0].classes_purchased).toBe(10);

      // Zero payments recorded
      const pays = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid);
      expect(pays.length).toBe(0);

      // Intent preserved in STARTED
      const ds = RenewalIdempotency._getDurableStore();
      const raw = ds.getProperty('renewal_idemp_' + key);
      expect(raw).toBeDefined();
      expect(JSON.parse(raw).outcome).toBe('STARTED');
    });

    it('Case 2 & 3: Stops immediately after package insertion -> retry identifies exact row and records payment without duplicate package', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Retry Case 2', parent_name: 'P Two', parent_phone: '+91 98765 20002'
      }, adminActor);
      const sid = s.data.student_id;

      // Existing historical package
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Retry Case 2', plan_type: 'Per Class',
        currency: 'INR', package_price: 8000, classes_purchased: 8, start_date: '2026-01-01'
      });

      const key = 'idemp_case_2';
      const pkgSheet2 = spreadsheet.getSheetByName('Packages');
      const preRow2 = pkgSheet2 ? pkgSheet2.getLastRow() : 0;
      // Record durable intent with initialPkgCount = 1
      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 8, 16, {
        new_classes_purchased: 8, currency: 'INR', package_price: 9000, start_date: '2026-03-01',
        payment: { amount: 9000, currency: 'INR', record_payment: true }
      }, adminActor, [], '', 1, preRow2);

      // Simulate crash immediately AFTER package was inserted into sheet and row index persisted
      const insPkg2 = PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Retry Case 2', plan_type: 'Per Class',
        currency: 'INR', package_price: 9000, classes_purchased: 8, start_date: '2026-03-01'
      });
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key, insPkg2._rowIndex);

      // At this crash point: 2 packages exist, but 0 payments exist
      expect(PackageRepository.Packages_getByStudentId(spreadsheet, sid).length).toBe(2);
      expect(PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length).toBe(0);

      // Client retries renewal with the same key
      const res = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid,
        new_classes_purchased: 8,
        currency: 'INR',
        package_price: 9000,
        start_date: '2026-03-01',
        payment: { amount: 9000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      expect(res.success).toBe(true);

      // MUST NOT have inserted a 3rd package row!
      const pkgsAfterRetry = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(pkgsAfterRetry.length).toBe(2);

      // Payment MUST have been completed
      const paysAfterRetry = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid);
      expect(paysAfterRetry.length).toBe(1);
      expect(paysAfterRetry[0].amount).toBe(9000);
    });

    it('Case 4 & 5: Completed renewal idempotently returns completed result with zero mutations', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Retry Case 4', parent_name: 'P Four', parent_phone: '+91 98765 20004'
      }, adminActor);
      const sid = s.data.student_id;

      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Retry Case 4', plan_type: 'Per Class',
        currency: 'INR', package_price: 5000, classes_purchased: 5, start_date: '2026-01-01'
      });

      const key = 'idemp_case_completed';
      const payload = {
        student_id: sid,
        new_classes_purchased: 5,
        currency: 'INR',
        package_price: 5500,
        start_date: '2026-02-01',
        payment: { amount: 5500, currency: 'INR', record_payment: true },
        idempotency_key: key
      };

      const res1 = RenewalService.Packages_renew(spreadsheet, payload, adminActor);
      expect(res1.success).toBe(true);

      // Retry after full completion
      const res2 = RenewalService.Packages_renew(spreadsheet, payload, adminActor);
      expect(res2.success).toBe(true);
      expect(res2.meta?.idempotentRetry).toBe(true);

      expect(PackageRepository.Packages_getByStudentId(spreadsheet, sid).length).toBe(2);
      expect(PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length).toBe(1);
    });

    it('Separate legitimate renewal with different idempotency key creates a separate package row', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Multi Renewal', parent_name: 'P Multi', parent_phone: '+91 98765 20005'
      }, adminActor);
      const sid = s.data.student_id;

      // Initial package
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Multi Renewal', plan_type: 'Per Class',
        currency: 'INR', package_price: 6000, classes_purchased: 6, start_date: '2026-01-01'
      });

      // First renewal
      const res1 = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid,
        new_classes_purchased: 6,
        currency: 'INR',
        package_price: 6500,
        start_date: '2026-03-01',
        payment: { amount: 6500, currency: 'INR', record_payment: true },
        idempotency_key: 'idemp_ren_legit_1'
      }, adminActor);
      expect(res1.success).toBe(true);

      // Second legitimate renewal with different key
      const res2 = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid,
        new_classes_purchased: 6,
        currency: 'INR',
        package_price: 7000,
        start_date: '2026-05-01',
        payment: { amount: 7000, currency: 'INR', record_payment: true },
        idempotency_key: 'idemp_ren_legit_2'
      }, adminActor);
      expect(res2.success).toBe(true);

      // Total 3 distinct package rows and 2 payments
      const pkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(pkgs.length).toBe(3);
      expect(pkgs.every((p: any) => p.classes_purchased === 6)).toBe(true);

      const pays = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid);
      expect(pays.length).toBe(2);
      expect(pays[0].amount).toBe(6500);
      expect(pays[1].amount).toBe(7000);
    });

    // CHALLENGE SCENARIOS FOR RENEWAL RECOVERY HEURISTIC
    describe('Challenging Renewal Recovery Heuristic: Unambiguous Package Identification', () => {
      it('Scenario 1: Student already has a historical package with same classes_purchased and start_date -> retry never reuses historical package', () => {
        const s = StudentService.Students_create(spreadsheet, {
          student_name: 'Identical Historical Student', parent_name: 'P Parent', parent_phone: '+91 98765 30001'
        }, adminActor);
        const sid = s.data.student_id;

        // Historical package: 10 classes, start_date 2026-06-01
        PackageRepository.Packages_insert(spreadsheet, {
          student_id: sid, student_name: 'Identical Historical Student', plan_type: 'Per Class',
          currency: 'INR', package_price: 10000, classes_purchased: 10, start_date: '2026-06-01'
        });

        const key = 'idemp_identical_historical_retry';
        const payload = {
          student_id: sid,
          new_classes_purchased: 10,
          currency: 'INR',
          package_price: 10000,
          start_date: '2026-06-01', // Identical attributes!
          payment: { amount: 10000, currency: 'INR', record_payment: true },
          idempotency_key: key
        };

        // First attempt succeeds
        const res1 = RenewalService.Packages_renew(spreadsheet, payload, adminActor);
        expect(res1.success).toBe(true);

        const pkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
        expect(pkgs.length).toBe(2); // Two separate rows exist

        // Retry returns idempotent completed data without creating a 3rd row
        const res2 = RenewalService.Packages_renew(spreadsheet, payload, adminActor);
        expect(res2.success).toBe(true);

        const pkgsAfterRetry = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
        expect(pkgsAfterRetry.length).toBe(2);
      });

      it('Scenario 2: Two historical packages have identical purchase counts and dates -> retry never binds to either historical package', () => {
        const s = StudentService.Students_create(spreadsheet, {
          student_name: 'Twin Historical Student', parent_name: 'P Twin', parent_phone: '+91 98765 30002'
        }, adminActor);
        const sid = s.data.student_id;

        // Two identical historical packages
        PackageRepository.Packages_insert(spreadsheet, {
          student_id: sid, student_name: 'Twin Historical Student', plan_type: 'Per Class',
          currency: 'INR', package_price: 8000, classes_purchased: 8, start_date: '2026-04-01'
        });
        PackageRepository.Packages_insert(spreadsheet, {
          student_id: sid, student_name: 'Twin Historical Student', plan_type: 'Per Class',
          currency: 'INR', package_price: 8000, classes_purchased: 8, start_date: '2026-04-01'
        });

        const key = 'idemp_twin_historical';
        const res = RenewalService.Packages_renew(spreadsheet, {
          student_id: sid,
          new_classes_purchased: 8,
          currency: 'INR',
          package_price: 8000,
          start_date: '2026-04-01',
          payment: { amount: 8000, currency: 'INR', record_payment: true },
          idempotency_key: key
        }, adminActor);

        expect(res.success).toBe(true);
        const allPkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
        expect(allPkgs.length).toBe(3); // Exactly 1 new package appended (total 3)
      });

      it('Scenario 3: Renewal A partially completed, Renewal B completed, then Request A retries -> binds strictly to own row', () => {
        const s = StudentService.Students_create(spreadsheet, {
          student_name: 'Interleaved Student', parent_name: 'P Inter', parent_phone: '+91 98765 30003'
        }, adminActor);
        const sid = s.data.student_id;

        const pkgSheet = spreadsheet.getSheetByName('Packages');
        const preRow = pkgSheet ? pkgSheet.getLastRow() : 0;

        // Renewal A starts
        const keyA = 'idemp_interleaved_A';
        RenewalIdempotency._recordRenewalInitiated(spreadsheet, keyA, sid, 0, 10, {
          new_classes_purchased: 10, currency: 'INR', package_price: 10000, start_date: '2026-07-01',
          payment: { amount: 10000, currency: 'INR', record_payment: true }
        }, adminActor, [], '', 0, preRow);

        // Renewal A inserts row at preRow + 1
        PackageRepository.Packages_insert(spreadsheet, {
          student_id: sid, student_name: 'Interleaved Student', plan_type: 'Per Class',
          currency: 'INR', package_price: 10000, classes_purchased: 10, start_date: '2026-07-01'
        });
        RenewalIdempotency._recordRenewalPackageRow(spreadsheet, keyA, preRow + 1);

        // Now Renewal B completes with different key and different date
        const keyB = 'idemp_interleaved_B';
        const resB = RenewalService.Packages_renew(spreadsheet, {
          student_id: sid,
          new_classes_purchased: 12,
          currency: 'INR',
          package_price: 12000,
          start_date: '2026-08-01',
          payment: { amount: 12000, currency: 'INR', record_payment: true },
          idempotency_key: keyB
        }, adminActor);
        expect(resB.success).toBe(true);

        // Now Request A retries
        const resA = RenewalService.Packages_renew(spreadsheet, {
          student_id: sid,
          new_classes_purchased: 10,
          currency: 'INR',
          package_price: 10000,
          start_date: '2026-07-01',
          payment: { amount: 10000, currency: 'INR', record_payment: true },
          idempotency_key: keyA
        }, adminActor);
        expect(resA.success).toBe(true);

        const pkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
        expect(pkgs.length).toBe(2); // Exactly 2 packages: Row A and Row B
        expect(pkgs.some((p: any) => p.classes_purchased === 10 && p.start_date === '2026-07-01')).toBe(true);
        expect(pkgs.some((p: any) => p.classes_purchased === 12 && p.start_date === '2026-08-01')).toBe(true);
      });

      it('Scenario 4 & 5: When multiple candidates match and target index is corrupted/unverified -> returns AMBIGUOUS_RENEWAL_RECOVERY', () => {
        const s = StudentService.Students_create(spreadsheet, {
          student_name: 'Ambiguous Student', parent_name: 'P Ambi', parent_phone: '+91 98765 30004'
        }, adminActor);
        const sid = s.data.student_id;

        // Two identical packages already in sheet
        PackageRepository.Packages_insert(spreadsheet, {
          student_id: sid, student_name: 'Ambiguous Student', plan_type: 'Per Class',
          currency: 'INR', package_price: 5000, classes_purchased: 5, start_date: '2026-09-01'
        });
        PackageRepository.Packages_insert(spreadsheet, {
          student_id: sid, student_name: 'Ambiguous Student', plan_type: 'Per Class',
          currency: 'INR', package_price: 5000, classes_purchased: 5, start_date: '2026-09-01'
        });

        // Simulate an intent with invalid/shifted row pointer
        const key = 'idemp_corrupted_pointer';
        RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 0, 5, {
          new_classes_purchased: 5, currency: 'INR', package_price: 5000, start_date: '2026-09-01',
          payment: { amount: 5000, currency: 'INR', record_payment: true }
        }, adminActor, [], '', 0, 999); // 999 is invalid pre_insert_last_row

        const res = RenewalService.Packages_renew(spreadsheet, {
          student_id: sid,
          new_classes_purchased: 5,
          currency: 'INR',
          package_price: 5000,
          start_date: '2026-09-01',
          payment: { amount: 5000, currency: 'INR', record_payment: true },
          idempotency_key: key
        }, adminActor);

        expect(res.success).toBe(false);
        expect(res.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
      });
    });
  });

  // SECTION 2 — Schedule Writes: Target Package Selection & Ambiguity Rejection
  describe('SECTION 2 — Schedule Writes: Target Package Selection & Ambiguity Rejection', () => {
    it('rejects schedule save with AMBIGUOUS_PACKAGE_TARGET when all packages are historical/expired in the past', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Historical Schedule Student', parent_name: 'P Hist', parent_phone: '+91 98765 40001'
      }, adminActor);
      const sid = s.data.student_id;

      // Two expired packages in the past
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Historical Schedule Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 5000, classes_purchased: 5, start_date: '2025-01-01', end_date: '2025-02-01'
      });
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Historical Schedule Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 5000, classes_purchased: 5, start_date: '2025-03-01', end_date: '2025-04-01'
      });

      const res = ClassScheduleService.Schedules_save(spreadsheet, sid, [
        { day_of_week: 'MONDAY', start_time: '15:00', end_time: '16:00' }
      ], adminActor);

      expect(res.success).toBe(false);
      expect(res.code).toBe('AMBIGUOUS_PACKAGE_TARGET');
    });

    it('rejects schedule save with AMBIGUOUS_PACKAGE_TARGET when multiple packages have the exact same start date', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Same Start Date Student', parent_name: 'P Same', parent_phone: '+91 98765 40002'
      }, adminActor);
      const sid = s.data.student_id;

      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Same Start Date Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 6000, classes_purchased: 6, start_date: '2026-12-01', end_date: '2027-01-01'
      });
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Same Start Date Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 6000, classes_purchased: 6, start_date: '2026-12-01', end_date: '2027-01-01'
      });

      const res = ClassScheduleService.Schedules_save(spreadsheet, sid, [
        { day_of_week: 'TUESDAY', start_time: '10:00', end_time: '11:00' }
      ], adminActor);

      expect(res.success).toBe(false);
      expect(res.code).toBe('AMBIGUOUS_PACKAGE_TARGET');
    });

    it('rejects schedule save with AMBIGUOUS_PACKAGE_TARGET when multiple packages are synthesized as ACTIVE with same dates', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Dual Active Student', parent_name: 'P Dual', parent_phone: '+91 98765 40003'
      }, adminActor);
      const sid = s.data.student_id;

      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Dual Active Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 7000, classes_purchased: 7, start_date: '2026-11-01', end_date: '2027-02-01',
        package_status: 'ACTIVE'
      });
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Dual Active Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 7000, classes_purchased: 7, start_date: '2026-11-01', end_date: '2027-02-01',
        package_status: 'ACTIVE'
      });

      const res = ClassScheduleService.Schedules_save(spreadsheet, sid, [
        { day_of_week: 'WEDNESDAY', start_time: '14:00', end_time: '15:00' }
      ], adminActor);

      expect(res.success).toBe(false);
      expect(res.code).toBe('AMBIGUOUS_PACKAGE_TARGET');
    });

    it('unambiguously targets the new package after a renewal followed by a schedule update', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Renewal Schedule Student', parent_name: 'P RenSched', parent_phone: '+91 98765 40004'
      }, adminActor);
      const sid = s.data.student_id;

      // Historical package: ended 2026-05-01
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Renewal Schedule Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 8000, classes_purchased: 8, start_date: '2026-03-01', end_date: '2026-05-01',
        class_schedule: 'Mon - 10:00 AM'
      });

      // Renewal: new package starting 2026-11-01, ending 2027-03-01
      const renRes = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid,
        new_classes_purchased: 10,
        currency: 'INR',
        package_price: 11000,
        start_date: '2026-11-01',
        end_date: '2027-03-01',
        payment: { amount: 11000, currency: 'INR', record_payment: true },
        idempotency_key: 'idemp_ren_followed_by_sched'
      }, adminActor);
      expect(renRes.success).toBe(true);

      // Now update schedule
      const schedRes = ClassScheduleService.Schedules_save(spreadsheet, sid, [
        { day_of_week: 'FRIDAY', start_time: '16:00', end_time: '17:00' }
      ], adminActor);

      expect(schedRes.success).toBe(true);

      const pkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      const historical = pkgs.find((p: any) => p.start_date === '2026-03-01');
      const active = pkgs.find((p: any) => p.start_date === '2026-11-01');

      // Historical package is UNCHANGED
      expect(historical.class_schedule).toBe('Mon - 10:00 AM');

      // Renewal package has received the new schedule
      expect(active.class_schedule).toBe('Fri - 4:00 PM');
    });

    it('resolves options.package_id to real package row and preserves historical packages', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'PkgId Student', parent_name: 'P PkgId', parent_phone: '+91 98765 40005'
      }, adminActor);
      const sid = s.data.student_id;

      const p1 = PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'PkgId Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 5000, classes_purchased: 5, start_date: '2026-01-01',
        class_schedule: 'Mon - 10:00 AM'
      });
      const p2 = PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'PkgId Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 5000, classes_purchased: 5, start_date: '2026-02-01',
        class_schedule: 'Tue - 11:00 AM'
      });

      // Target row 1 explicitly via _rowIndex
      const res = ClassScheduleService.Schedules_save(spreadsheet, sid, [
        { day_of_week: 'SATURDAY', start_time: '18:00', end_time: '19:00' }
      ], adminActor, { _rowIndex: p1._rowIndex });

      expect(res.success).toBe(true);
      const pkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      const updatedP1 = pkgs.find((p: any) => p._rowIndex === p1._rowIndex);
      const unchangedP2 = pkgs.find((p: any) => p._rowIndex === p2._rowIndex);

      expect(updatedP1.class_schedule).toBe('Sat - 6:00 PM');
      expect(unchangedP2.class_schedule).toBe('Tue - 11:00 AM');
    });

    it('strictly validates _rowIndex against requested student ID; rejects stale row index from another student with TARGET_PACKAGE_NOT_FOUND without mutating foreign package', () => {
      const s1 = StudentService.Students_create(spreadsheet, {
        student_name: 'Owner Student', parent_name: 'P Owner', parent_phone: '+91 98765 40006'
      }, adminActor);
      const s2 = StudentService.Students_create(spreadsheet, {
        student_name: 'Foreign Student', parent_name: 'P Foreign', parent_phone: '+91 98765 40007'
      }, adminActor);

      const foreignPkg = PackageRepository.Packages_insert(spreadsheet, {
        student_id: s2.data.student_id, student_name: 'Foreign Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 6000, classes_purchased: 6, start_date: '2026-03-01',
        class_schedule: 'Wed - 12:00 PM'
      });

      // Attempt to update s1 using foreignPkg's _rowIndex
      const res = ClassScheduleService.Schedules_save(spreadsheet, s1.data.student_id, [
        { day_of_week: 'THURSDAY', start_time: '15:00', end_time: '16:00' }
      ], adminActor, { _rowIndex: foreignPkg._rowIndex });

      expect(res.success).toBe(false);
      expect(res.code).toBe('TARGET_PACKAGE_NOT_FOUND');

      // Verify foreign package was NOT touched
      const foreignPkgs = PackageRepository.Packages_getByStudentId(spreadsheet, s2.data.student_id);
      expect(foreignPkgs[0].class_schedule).toBe('Wed - 12:00 PM');
    });

    it('rejects schedule save with TARGET_PACKAGE_NOT_FOUND when synthetic package_id points to a stale or shifted row', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Stale Id Student', parent_name: 'P Stale', parent_phone: '+91 98765 40008'
      }, adminActor);
      const sid = s.data.student_id;

      // Create a package
      const pkg = PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Stale Id Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 6000, classes_purchased: 6, start_date: '2026-04-01',
        class_schedule: 'Mon - 11:00 AM'
      });

      // Synthetic package_id registered in memory map pointing to row index 2
      const syntheticId = 'pkg_synthetic_stale_test';
      if (!(globalThis as any).__pkgMemoryMap) (globalThis as any).__pkgMemoryMap = {};
      (globalThis as any).__pkgMemoryMap[syntheticId] = {
        student_id: sid,
        classes_purchased: 99, // Mismatched class count (stale)
        start_date: '2026-04-01',
        _rowIndex: pkg._rowIndex
      };

      // Packages_getById should reject resolving to a package with mismatched attributes
      const resolved = PackageRepository.Packages_getById(spreadsheet, syntheticId);
      expect(resolved).toBeNull();

      // Schedules_save should fail closed rather than updating an unverified package
      const res = ClassScheduleService.Schedules_save(spreadsheet, sid, [
        { day_of_week: 'TUESDAY', start_time: '12:00', end_time: '13:00' }
      ], adminActor, { package_id: syntheticId });

      expect(res.success).toBe(false);
      expect(res.code).toBe('TARGET_PACKAGE_NOT_FOUND');
    });
  });

  // SECTION 4 — Durable Intent Checkpoints & ScriptProperties Write Failures
  describe('SECTION 4 — Durable Intent Checkpoints & ScriptProperties Write Failures', () => {
    it('stops renewal with DURABLE_INTENT_FAILED before package or payment write if ScriptProperties write fails at pre-insert checkpoint', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Pre Failure Student', parent_name: 'P Pre', parent_phone: '+91 98765 50001'
      }, adminActor);
      const sid = s.data.student_id;

      const ds = RenewalIdempotency._getDurableStore();
      const origSet = ds.setProperty;
      ds.setProperty = () => { throw new Error('Simulated ScriptProperties pre-insert failure'); };

      try {
        const prePkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
        const res = RenewalService.Packages_renew(spreadsheet, {
          student_id: sid,
          new_classes_purchased: 10,
          currency: 'INR',
          package_price: 10000,
          start_date: '2026-10-01',
          payment: { amount: 10000, currency: 'INR', record_payment: true },
          idempotency_key: 'idemp_pre_insert_fail'
        }, adminActor);

        expect(res.success).toBe(false);
        expect(res.code).toBe('DURABLE_INTENT_FAILED');

        // ZERO package rows inserted
        const postPkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
        expect(postPkgs.length).toBe(prePkgs.length);

        // ZERO payments recorded
        const paySheet = spreadsheet.getSheetByName('Payments');
        const payData = paySheet.getDataRange().getValues();
        const studentPays = payData.filter((r: any) => r[1] === sid);
        expect(studentPays.length).toBe(0);
      } finally {
        ds.setProperty = origSet;
      }
    });

    it('never treats in-memory fallback as durable recovery state when ScriptProperties lacks durable intent', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Transient Mem Student', parent_name: 'P Trans', parent_phone: '+91 98765 50002'
      }, adminActor);
      const sid = s.data.student_id;

      const ds = RenewalIdempotency._getDurableStore();
      // Ensure ScriptProperties does NOT have the intent
      ds.deleteProperty('renewal_idemp_key_transient_mem');

      // Inject into in-memory cache directly
      const mem = (RenewalIdempotency as any)._getIdempMem ? (RenewalIdempotency as any)._getIdempMem() : {};
      mem['renewal_idemp_key_transient_mem'] = {
        outcome: 'SUCCESS',
        student_id: sid,
        resultData: { success: true }
      };

      const check = RenewalIdempotency._checkRenewalIdempotency(spreadsheet, 'renewal_idemp_key_transient_mem', {
        student_id: sid, new_classes_purchased: 10
      });

      // Must be null: transient memory without ScriptProperties backing is NEVER trusted
      expect(check).toBeNull();
    });

    it('halts renewal with DURABLE_PERSIST_FAILED before payment or completion if ScriptProperties write fails at post-insert row pointer checkpoint', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Post Failure Student', parent_name: 'P Post', parent_phone: '+91 98765 50003'
      }, adminActor);
      const sid = s.data.student_id;

      const ds = RenewalIdempotency._getDurableStore();
      let callCount = 0;
      const origSet = ds.setProperty;
      ds.setProperty = (k: string, v: string) => {
        callCount++;
        // Allow pre-insert intent write (call 1), fail on post-insert row update (call 2)
        if (callCount >= 2) {
          throw new Error('Simulated ScriptProperties post-insert row pointer failure');
        }
        return origSet.call(ds, k, v);
      };

      try {
        const key = 'idemp_post_insert_fail';
        const res = RenewalService.Packages_renew(spreadsheet, {
          student_id: sid,
          new_classes_purchased: 8,
          currency: 'INR',
          package_price: 8000,
          start_date: '2026-11-01',
          payment: { amount: 8000, currency: 'INR', record_payment: true },
          idempotency_key: key
        }, adminActor);

        expect(res.success).toBe(false);
        expect(res.code).toBe('DURABLE_PERSIST_FAILED');
        expect(res.package_row_index).toBeGreaterThan(0);

        // ZERO payments recorded because execution halted immediately
        const paySheet = spreadsheet.getSheetByName('Payments');
        const payData = paySheet.getDataRange().getValues();
        const studentPays = payData.filter((r: any) => r[1] === sid);
        expect(studentPays.length).toBe(0);
      } finally {
        ds.setProperty = origSet;
      }
    });

    it('fails closed with AMBIGUOUS_RENEWAL_RECOVERY when crash occurs before row index persistence and sheet row count changed', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Crash Recovery Student', parent_name: 'P Crash', parent_phone: '+91 98765 50004'
      }, adminActor);
      const sid = s.data.student_id;

      const pkgSheet = spreadsheet.getSheetByName('Packages');
      const preRow = pkgSheet ? pkgSheet.getLastRow() : 0;
      const key = 'idemp_crash_before_row_stamping';

      // 1. Pre-insert intent recorded with pre_insert_last_row
      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 0, 12, {
        new_classes_purchased: 12, currency: 'INR', package_price: 12000, start_date: '2026-12-01',
        payment: { amount: 12000, currency: 'INR', record_payment: true }
      }, adminActor, [], '', 0, preRow);

      // Simulate intent where inserted_row_index was NOT persisted before crash
      const ds = RenewalIdempotency._getDurableStore();
      const raw = ds.getProperty('renewal_idemp_' + key);
      const parsed = JSON.parse(raw);
      parsed.inserted_row_index = null;
      ds.setProperty('renewal_idemp_' + key, JSON.stringify(parsed));

      // 2. Package inserted, plus another package inserted (sheet row count changed beyond preRow + 1)
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Crash Recovery Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 12000, classes_purchased: 12, start_date: '2026-12-01'
      });
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Crash Recovery Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 12000, classes_purchased: 12, start_date: '2026-12-01'
      });

      // 3. Retry arrives: since row index was never durably persisted and sheet state changed,
      // it must FAIL CLOSED with AMBIGUOUS_RENEWAL_RECOVERY rather than guessing
      const res = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid,
        new_classes_purchased: 12,
        currency: 'INR',
        package_price: 12000,
        start_date: '2026-12-01',
        payment: { amount: 12000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      expect(res.success).toBe(false);
      expect(res.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
    });

    it('safely recovers and re-attaches to exact row when row index was durably persisted before crash', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Proven Row Student', parent_name: 'P Proven', parent_phone: '+91 98765 50005'
      }, adminActor);
      const sid = s.data.student_id;

      const pkgSheet = spreadsheet.getSheetByName('Packages');
      const preRow = pkgSheet ? pkgSheet.getLastRow() : 0;
      const key = 'idemp_proven_row_index';

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 0, 10, {
        new_classes_purchased: 10, currency: 'INR', package_price: 10000, start_date: '2026-12-15',
        payment: { amount: 10000, currency: 'INR', record_payment: true }
      }, adminActor, [], '', 0, preRow);

      // Package inserted and row index durably recorded
      const pkg = PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Proven Row Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 10000, classes_purchased: 10, start_date: '2026-12-15'
      });
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key, pkg._rowIndex);

      // System crashed before payment write. Retry arrives:
      const res = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid,
        new_classes_purchased: 10,
        currency: 'INR',
        package_price: 10000,
        start_date: '2026-12-15',
        payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      expect(res.success).toBe(true);
      const pkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(pkgs.length).toBe(1);
      expect(pkgs[0]._rowIndex).toBe(pkg._rowIndex);

      const paySheet = spreadsheet.getSheetByName('Payments');
      const payData = paySheet.getDataRange().getValues();
      const studentPays = payData.filter((r: any) => r[0] === sid);
      expect(studentPays.length).toBe(1);
      expect(Number(studentPays[0][3])).toBe(10000);
    });

    it('fails closed when an unrelated package is inserted before unpersisted renewal retries', () => {
      const s1 = StudentService.Students_create(spreadsheet, {
        student_name: 'Interleaved Student 1', parent_name: 'P Int1', parent_phone: '+91 98765 50006'
      }, adminActor);
      const s2 = StudentService.Students_create(spreadsheet, {
        student_name: 'Unrelated Student 2', parent_name: 'P Int2', parent_phone: '+91 98765 50007'
      }, adminActor);

      const pkgSheet = spreadsheet.getSheetByName('Packages');
      const preRow = pkgSheet ? pkgSheet.getLastRow() : 0;
      const keyA = 'idemp_interleaved_unrelated';

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, keyA, s1.data.student_id, 0, 8, {
        new_classes_purchased: 8, currency: 'INR', package_price: 8000, start_date: '2026-10-01',
        payment: { amount: 8000, currency: 'INR', record_payment: true }
      }, adminActor, [], '', 0, preRow);

      const ds = RenewalIdempotency._getDurableStore();
      const raw = ds.getProperty('renewal_idemp_' + keyA);
      const parsed = JSON.parse(raw);
      parsed.inserted_row_index = null;
      ds.setProperty('renewal_idemp_' + keyA, JSON.stringify(parsed));

      // Renewal A inserts a package
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: s1.data.student_id, student_name: 'Interleaved Student 1', plan_type: 'Per Class',
        currency: 'INR', package_price: 8000, classes_purchased: 8, start_date: '2026-10-01'
      });

      // Unrelated package for Student 2 is appended before Renewal A completes
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: s2.data.student_id, student_name: 'Unrelated Student 2', plan_type: 'Per Class',
        currency: 'INR', package_price: 5000, classes_purchased: 5, start_date: '2026-10-01'
      });

      // Renewal A retries: fails closed rather than latching onto or misidentifying row
      const resA = RenewalService.Packages_renew(spreadsheet, {
        student_id: s1.data.student_id,
        new_classes_purchased: 8,
        currency: 'INR',
        package_price: 8000,
        start_date: '2026-10-01',
        payment: { amount: 8000, currency: 'INR', record_payment: true },
        idempotency_key: keyA
      }, adminActor);

      expect(resA.success).toBe(false);
      expect(resA.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
    });

    it('fails closed when persisted row index points to a moved/deleted row (row shifted)', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Shifted Row Student', parent_name: 'P Shift', parent_phone: '+91 98765 50008'
      }, adminActor);
      const sid = s.data.student_id;

      const pkgSheet = spreadsheet.getSheetByName('Packages');
      const preRow = pkgSheet ? pkgSheet.getLastRow() : 0;
      const key = 'idemp_shifted_row_key';

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 0, 6, {
        new_classes_purchased: 6, currency: 'INR', package_price: 6000, start_date: '2026-10-01',
        payment: { amount: 6000, currency: 'INR', record_payment: true }
      }, adminActor, [], '', 0, preRow);

      // Persist row index pointing to row 999 (which does not exist)
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key, 999);

      const res = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid,
        new_classes_purchased: 6,
        currency: 'INR',
        package_price: 6000,
        start_date: '2026-10-01',
        payment: { amount: 6000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      expect(res.success).toBe(false);
      expect(res.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
    });
  });

  // SECTION 5 — ClassSchedules Strict Audit & Read-Only Verdict
  describe('SECTION 5 — ClassSchedules Strict Audit & Read-Only Verdict', () => {
    it('flags duplicate schedule rows and enforces safeToArchive === false', () => {
      const auditSheet = spreadsheet.getSheetByName('ClassSchedules') || spreadsheet.insertSheet('ClassSchedules');
      auditSheet.appendRow(['schedule_id', 'student_id', 'day_of_week', 'start_time', 'end_time']);
      auditSheet.appendRow(['csch_1', 'STU_DUP', 'MONDAY', '10:00', '11:00']);
      auditSheet.appendRow(['csch_2', 'STU_DUP', 'MONDAY', '10:00', '11:00']); // Duplicate

      const audit = ClassScheduleService.auditClassSchedulesSheetStrict(spreadsheet);
      expect(audit.safeToArchive).toBe(false);
      expect(audit.isSafeToArchive).toBe(false);
      expect(audit.duplicateRows.length).toBeGreaterThan(0);
    });

    it('flags malformed schedule times and enforces safeToArchive === false', () => {
      const auditSheet = spreadsheet.getSheetByName('ClassSchedules') || spreadsheet.insertSheet('ClassSchedules');
      auditSheet.clear();
      auditSheet.appendRow(['schedule_id', 'student_id', 'day_of_week', 'start_time', 'end_time']);
      auditSheet.appendRow(['csch_bad', 'STU_MAL', 'MONDAY', '99:99', '11:00']); // Malformed start time

      const audit = ClassScheduleService.auditClassSchedulesSheetStrict(spreadsheet);
      expect(audit.safeToArchive).toBe(false);
      expect(audit.malformedRows.length).toBeGreaterThan(0);
    });

    it('flags unmatched students and ambiguous packages, enforcing safeToArchive === false', () => {
      const auditSheet = spreadsheet.getSheetByName('ClassSchedules') || spreadsheet.insertSheet('ClassSchedules');
      auditSheet.clear();
      auditSheet.appendRow(['schedule_id', 'student_id', 'day_of_week', 'start_time', 'end_time']);
      auditSheet.appendRow(['csch_unmatched', 'STU_NONEXISTENT', 'WEDNESDAY', '15:00', '16:00']);

      const audit = ClassScheduleService.auditClassSchedulesSheetStrict(spreadsheet);
      expect(audit.safeToArchive).toBe(false);
      expect(audit.unmatchedRows.length).toBeGreaterThan(0);
    });

    it('produces safeToArchive === true only when sheet is completely clean and matching, without mutating any sheet data', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Clean Audit Student', parent_name: 'P Clean', parent_phone: '+91 98765 60001'
      }, adminActor);
      const sid = s.data.student_id;

      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Clean Audit Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 5000, classes_purchased: 5, start_date: '2026-05-01',
        class_schedule: 'Fri - 2:00 PM'
      });

      const auditSheet = spreadsheet.getSheetByName('ClassSchedules') || spreadsheet.insertSheet('ClassSchedules');
      auditSheet.clear();
      auditSheet.appendRow(['schedule_id', 'student_id', 'day_of_week', 'start_time', 'end_time']);
      auditSheet.appendRow(['csch_clean', sid, 'FRIDAY', '14:00', '15:00']);

      const preRowData = auditSheet.getDataRange().getValues();

      const audit = ClassScheduleService.auditClassSchedulesSheetStrict(spreadsheet);
      expect(audit.safeToArchive).toBe(true);
      expect(audit.isSafeToArchive).toBe(true);
      expect(audit.validRows.length).toBe(1);
      expect(audit.duplicateRows.length).toBe(0);
      expect(audit.malformedRows.length).toBe(0);
      expect(audit.unmatchedRows.length).toBe(0);

      // Strictly read-only check: sheet data was NOT altered
      const postRowData = auditSheet.getDataRange().getValues();
      expect(postRowData).toEqual(preRowData);
    });
  });

  // SECTION 6 — Renewal Identity Safety and Synthetic Package ID Resolution (Fail-Closed)
  describe('SECTION 6 — Final Renewal Identity Safety Correction & Adversarial Scenarios', () => {
    // 1. Crash after package insertion before row index persistence
    it('Scenario 1: Crash after package insertion before row index persistence fails closed with AMBIGUOUS_RENEWAL_RECOVERY', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Crash Pre-Index Student', parent_name: 'P Crash', parent_phone: '+91 98765 70001'
      }, adminActor);
      const sid = s.data.student_id;

      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Crash Pre-Index Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 5000, classes_purchased: 5, start_date: '2026-01-01'
      });

      const key = 'idemp_crash_before_index_save';
      const pkgSheet = spreadsheet.getSheetByName('Packages');
      const preRow = pkgSheet.getLastRow();

      // Step 1: Intent recorded with inserted_row_index: null
      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 5, 15, {
        new_classes_purchased: 10, currency: 'INR', package_price: 10000, start_date: '2026-02-01',
        payment: { amount: 10000, currency: 'INR', record_payment: true }
      }, adminActor, [], '', 1, preRow);

      // Step 2: Package inserted into Packages sheet, but system crashes BEFORE _recordRenewalPackageRow persists inserted_row_index
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Crash Pre-Index Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 10000, classes_purchased: 10, start_date: '2026-02-01'
      });
      // CRASH! (No _recordRenewalPackageRow called)

      // Step 3: Retry occurs
      const retryRes = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 10, currency: 'INR', package_price: 10000,
        start_date: '2026-02-01', payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      // Assert fail-closed behavior
      expect(retryRes.success).toBe(false);
      expect(retryRes.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');

      // Assert zero duplicate packages inserted on retry
      const pkgsAfter = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(pkgsAfter.length).toBe(2); // 1 initial + 1 from first attempt, no 3rd package

      // Assert zero payments recorded
      const paysAfter = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid);
      expect(paysAfter.length).toBe(0);
    });

    // 2. Row reorder with unchanged last-row count
    it('Scenario 2: Row reorder with unchanged last-row count fails closed with AMBIGUOUS_RENEWAL_RECOVERY', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Row Reorder Student', parent_name: 'P Reorder', parent_phone: '+91 98765 70002'
      }, adminActor);
      const sid = s.data.student_id;

      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Row Reorder Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 6000, classes_purchased: 6, start_date: '2026-03-01'
      });

      const key = 'idemp_reorder_test';
      const pkgSheet = spreadsheet.getSheetByName('Packages');
      const preRow = pkgSheet.getLastRow();

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 6, 12, {
        new_classes_purchased: 6, currency: 'INR', package_price: 6500, start_date: '2026-04-01',
        payment: { amount: 6500, currency: 'INR', record_payment: true }
      }, adminActor, [], '', 1, preRow);

      // Package inserted
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Row Reorder Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 6500, classes_purchased: 6, start_date: '2026-04-01'
      });

      // Rows are externally reordered/swapped in the sheet, keeping net last-row count identical
      const row1 = pkgSheet.rows[1]; // Header is index 0
      const row2 = pkgSheet.rows[2];
      pkgSheet.rows[1] = row2;
      pkgSheet.rows[2] = row1;

      // Retry renewal without persisted row index
      const retryRes = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 6, currency: 'INR', package_price: 6500,
        start_date: '2026-04-01', payment: { amount: 6500, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      expect(retryRes.success).toBe(false);
      expect(retryRes.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
    });

    // 3. Balanced delete-and-insert operation preserving net row count
    it('Scenario 3: Balanced delete-and-insert preserving net row count fails closed with AMBIGUOUS_RENEWAL_RECOVERY', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Balanced Churn Student', parent_name: 'P Churn', parent_phone: '+91 98765 70003'
      }, adminActor);
      const sid = s.data.student_id;

      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Balanced Churn Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 7000, classes_purchased: 7, start_date: '2026-05-01'
      });

      const key = 'idemp_balanced_churn';
      const pkgSheet = spreadsheet.getSheetByName('Packages');
      const preRow = pkgSheet.getLastRow();

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 7, 14, {
        new_classes_purchased: 7, currency: 'INR', package_price: 7500, start_date: '2026-06-01',
        payment: { amount: 7500, currency: 'INR', record_payment: true }
      }, adminActor, [], '', 1, preRow);

      // Package inserted
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Balanced Churn Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 7500, classes_purchased: 7, start_date: '2026-06-01'
      });

      // An unrelated package is deleted and another package inserted, so last row count is unchanged
      pkgSheet.rows.splice(1, 1); // Delete first package
      pkgSheet.appendRow(['STU_OTHER', 'Other Student', 'Per Class', 'INR', 3000, 3000, 3, '2026-06-01', '', '', 60, '']);

      const retryRes = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 7, currency: 'INR', package_price: 7500,
        start_date: '2026-06-01', payment: { amount: 7500, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      expect(retryRes.success).toBe(false);
      expect(retryRes.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
    });

    // 4. Duplicate packages with identical attributes
    it('Scenario 4: Duplicate historical packages with identical attributes fails closed without durably persisted row index', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Twin Attr Student', parent_name: 'P TwinAttr', parent_phone: '+91 98765 70004'
      }, adminActor);
      const sid = s.data.student_id;

      // Existing package with 10 classes and same start date
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Twin Attr Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 10000, classes_purchased: 10, start_date: '2026-07-01'
      });

      const key = 'idemp_twin_attrs_test';
      const pkgSheet = spreadsheet.getSheetByName('Packages');
      const preRow = pkgSheet.getLastRow();

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 10, 20, {
        new_classes_purchased: 10, currency: 'INR', package_price: 10000, start_date: '2026-07-01',
        payment: { amount: 10000, currency: 'INR', record_payment: true }
      }, adminActor, [], '', 1, preRow);

      // System crashes before package insertion or row index save, but candidate exists in sheet
      const retryRes = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 10, currency: 'INR', package_price: 10000,
        start_date: '2026-07-01', payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      // Must fail closed because matching candidate exists and inserted_row_index was not persisted
      expect(retryRes.success).toBe(false);
      expect(retryRes.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
    });

    // 5. Stale synthetic ID after row movement/swap
    it('Scenario 5: Stale synthetic package ID returns null and TARGET_PACKAGE_NOT_FOUND after row movement/swap', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Synthetic Stale Student', parent_name: 'P Stale', parent_phone: '+91 98765 70005'
      }, adminActor);
      const sid = s.data.student_id;

      // Create package 1
      const p1 = PackageService.Packages_create(spreadsheet, {
        student_id: sid, plan_type: 'Per Class', classes_purchased: 5, currency: 'INR',
        package_price: 5000, start_date: '2026-08-01'
      }, adminActor);
      expect(p1.success).toBe(true);
      const pkg1Id = p1.data.package_id;

      // Insert twin package directly to create multiple identical candidates in the sheet
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Synthetic Stale Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 5000, classes_purchased: 5, start_date: '2026-08-01'
      });

      // Multiple packages with identical attributes exist: Packages_getById detects ambiguity and returns null
      const resByIdTwin = PackageRepository.Packages_getById(spreadsheet, pkg1Id);
      expect(resByIdTwin).toBeNull();

      // Schedules_save using ambiguous package ID fails closed with TARGET_PACKAGE_NOT_FOUND
      const schedRes = ClassScheduleService.Schedules_save(spreadsheet, sid, [
        { day_of_week: 'TUESDAY', start_time: '14:00', end_time: '15:00' }
      ], adminActor, { package_id: pkg1Id });
      expect(schedRes.success).toBe(false);
      expect(schedRes.code).toBe('TARGET_PACKAGE_NOT_FOUND');

      // Test row shift on unique package:
      const sUnique = StudentService.Students_create(spreadsheet, {
        student_name: 'Unique Shift Student', parent_name: 'P Shift', parent_phone: '+91 98765 70007'
      }, adminActor);
      const sidUnique = sUnique.data.student_id;
      const pUnique = PackageService.Packages_create(spreadsheet, {
        student_id: sidUnique, plan_type: 'Per Class', classes_purchased: 12, currency: 'INR',
        package_price: 12000, start_date: '2026-11-01'
      }, adminActor);
      const uniquePkgId = pUnique.data.package_id;

      // Artificially shift memory map pointer so _rowIndex no longer matches sheet row
      // @ts-ignore
      globalThis.__pkgMemoryMap[uniquePkgId]._rowIndex = 999;
      expect(PackageRepository.Packages_getById(spreadsheet, uniquePkgId)).toBeNull();
    });

    // 6. Retry after ambiguous recovery asserts zero duplicate packages and zero payments recorded
    it('Scenario 6: Subsequent retries after AMBIGUOUS_RENEWAL_RECOVERY consistently fail closed with zero mutations', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Idempotent Ambiguity Student', parent_name: 'P AmbiRetry', parent_phone: '+91 98765 70006'
      }, adminActor);
      const sid = s.data.student_id;

      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Idempotent Ambiguity Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 9000, classes_purchased: 9, start_date: '2026-09-01'
      });

      const key = 'idemp_subsequent_ambiguity_retry';
      const pkgSheet = spreadsheet.getSheetByName('Packages');
      const preRow = pkgSheet.getLastRow();

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 9, 18, {
        new_classes_purchased: 9, currency: 'INR', package_price: 9500, start_date: '2026-10-01',
        payment: { amount: 9500, currency: 'INR', record_payment: true }
      }, adminActor, [], '', 1, preRow);

      // Package inserted, crash before row pointer persistence
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Idempotent Ambiguity Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 9500, classes_purchased: 9, start_date: '2026-10-01'
      });

      const initialPkgCount = PackageRepository.Packages_getByStudentId(spreadsheet, sid).length;
      const initialPayCount = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length;

      // Retry 1: Fails closed
      const retry1 = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 9, currency: 'INR', package_price: 9500,
        start_date: '2026-10-01', payment: { amount: 9500, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);
      expect(retry1.success).toBe(false);
      expect(retry1.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');

      // Retry 2: Still fails closed
      const retry2 = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 9, currency: 'INR', package_price: 9500,
        start_date: '2026-10-01', payment: { amount: 9500, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);
      expect(retry2.success).toBe(false);
      expect(retry2.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');

      // Assert zero mutations
      const postPkgCount = PackageRepository.Packages_getByStudentId(spreadsheet, sid).length;
      const postPayCount = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length;
      expect(postPkgCount).toBe(initialPkgCount);
      expect(postPayCount).toBe(initialPayCount);

      // Assert idempotency record remains preserved in STARTED state (not marked completed or corrupt)
      const ds = RenewalIdempotency._getDurableStore();
      const rawStored = ds.getProperty('renewal_idemp_' + key);
      expect(rawStored).toBeDefined();
      const stored = JSON.parse(rawStored);
      expect(stored.outcome).toBe('STARTED');
      expect(stored.inProgress).toBe(true);
    });

    // 7. Adversarial sequence: attributes edited and row deleted to restore preInsertLastRow
    it('Scenario 7: Adversarial no-insertion inference sequence fails closed with AMBIGUOUS_RENEWAL_RECOVERY', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Adversarial Inference Student', parent_name: 'P Adv', parent_phone: '+91 98765 80001'
      }, adminActor);
      const sid = s.data.student_id;

      // Dummy initial packages so we can delete one later
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Adversarial Inference Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 3000, classes_purchased: 3, start_date: '2026-01-01'
      });
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: 'STU_DUMMY', student_name: 'Dummy Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 1000, classes_purchased: 1, start_date: '2026-01-01'
      });

      const key = 'idemp_adversarial_inference';
      const pkgSheet = spreadsheet.getSheetByName('Packages');
      const preRow = pkgSheet.getLastRow(); // e.g. 3 (header + 2 packages)

      // Step 1: Renewal A records its initial checkpoint
      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 3, 13, {
        new_classes_purchased: 10, currency: 'INR', package_price: 10000, start_date: '2026-02-01',
        payment: { amount: 10000, currency: 'INR', record_payment: true }
      }, adminActor, [], '', 1, preRow);

      // Step 2: Renewal A inserts its package
      const insPkg = PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Adversarial Inference Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 10000, classes_purchased: 10, start_date: '2026-02-01'
      });

      // Step 3: Execution crashes before inserted_row_index is persisted (inserted_row_index remains null)

      // Step 4: The inserted package's classes_purchased or start_date is edited out of band
      // insPkg is at last row of pkgSheet.rows
      const insIdx = pkgSheet.rows.length - 1;
      pkgSheet.rows[insIdx][6] = 99; // classes_purchased altered to 99

      // Step 5: Another row is deleted so the sheet's last-row count returns to preInsertLastRow
      pkgSheet.rows.splice(2, 1); // Delete dummy package at row index 2

      expect(pkgSheet.getLastRow()).toBe(preRow); // Last row count exactly equals preInsertLastRow!

      const preRetryPkgCount = PackageRepository.Packages_getByStudentId(spreadsheet, sid).length;
      const preRetryPayCount = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length;

      // Step 6: Renewal A retries
      const retryRes = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid,
        new_classes_purchased: 10,
        currency: 'INR',
        package_price: 10000,
        start_date: '2026-02-01',
        payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      // Assert: The retry must NOT insert another package; must fail closed with AMBIGUOUS_RENEWAL_RECOVERY
      expect(retryRes.success).toBe(false);
      expect(retryRes.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');

      // Assert zero side effects
      const postRetryPkgCount = PackageRepository.Packages_getByStudentId(spreadsheet, sid).length;
      const postRetryPayCount = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length;
      expect(postRetryPkgCount).toBe(preRetryPkgCount);
      expect(postRetryPayCount).toBe(preRetryPayCount);

      // Original intent remains available in STARTED state for reconciliation
      const ds = RenewalIdempotency._getDurableStore();
      const rawStored = ds.getProperty('renewal_idemp_' + key);
      expect(rawStored).toBeDefined();
      expect(JSON.parse(rawStored).outcome).toBe('STARTED');

      // Repeated retry also fails closed
      const retry2 = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 10, currency: 'INR', package_price: 10000,
        start_date: '2026-02-01', payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);
      expect(retry2.success).toBe(false);
      expect(retry2.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
    });

    // 8. Persisted row index: original package moved, another identical package moved into recorded index
    it('Scenario 8: Original package moved and identical replacement moved into recorded row index fails closed with AMBIGUOUS_RENEWAL_RECOVERY', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Swap Attr Student', parent_name: 'P Swap', parent_phone: '+91 98765 80002'
      }, adminActor);
      const sid = s.data.student_id;

      // Initial historical package (row 2)
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Swap Attr Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 8000, classes_purchased: 8, start_date: '2026-03-01'
      });

      const key = 'idemp_persisted_swap';
      const pkgSheet = spreadsheet.getSheetByName('Packages');
      const preRow = pkgSheet.getLastRow();

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 8, 16, {
        new_classes_purchased: 8, currency: 'INR', package_price: 8000, start_date: '2026-04-01',
        payment: { amount: 8000, currency: 'INR', record_payment: true }
      }, adminActor, [], '', 1, preRow);

      // Package inserted at row 3
      const origPkg = PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Swap Attr Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 8000, classes_purchased: 8, start_date: '2026-04-01'
      });
      const recordedRowIndex = origPkg._rowIndex; // Row 3
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key, recordedRowIndex);

      // Another identical package is inserted (row 4)
      const replacementPkg = PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Swap Attr Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 8000, classes_purchased: 8, start_date: '2026-04-01'
      });

      // Rows are swapped: original moved to row 4, replacement moved to recorded row 3
      const row3Vals = pkgSheet.rows[2]; // row index 3
      const row4Vals = pkgSheet.rows[3]; // row index 4
      pkgSheet.rows[2] = row4Vals;
      pkgSheet.rows[3] = row3Vals;

      const preCount = PackageRepository.Packages_getByStudentId(spreadsheet, sid).length;
      const prePays = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length;

      // Renewal retries: recovery must NEVER silently attach to replacement package!
      const retryRes = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid,
        new_classes_purchased: 8,
        currency: 'INR',
        package_price: 8000,
        start_date: '2026-04-01',
        payment: { amount: 8000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      // Because multiple packages share identical attributes, identity cannot be proven -> fail closed!
      expect(retryRes.success).toBe(false);
      expect(retryRes.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');

      // Assert zero mutations
      expect(PackageRepository.Packages_getByStudentId(spreadsheet, sid).length).toBe(preCount);
      expect(PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length).toBe(prePays);
    });

    // 9. Persisted row index: original row deleted and identical replacement takes its index
    it('Scenario 9: Original row deleted and identical replacement takes its index fails closed with AMBIGUOUS_RENEWAL_RECOVERY', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Delete Shift Student', parent_name: 'P DelShift', parent_phone: '+91 98765 80003'
      }, adminActor);
      const sid = s.data.student_id;

      // Row 2: identical package
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Delete Shift Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 5000, classes_purchased: 5, start_date: '2026-06-01'
      });

      const key = 'idemp_del_shift';
      const pkgSheet = spreadsheet.getSheetByName('Packages');
      const preRow = pkgSheet.getLastRow();

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 5, 10, {
        new_classes_purchased: 5, currency: 'INR', package_price: 5000, start_date: '2026-06-01',
        payment: { amount: 5000, currency: 'INR', record_payment: true }
      }, adminActor, [], '', 1, preRow);

      // Row 3: original package inserted
      const origPkg = PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Delete Shift Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 5000, classes_purchased: 5, start_date: '2026-06-01'
      });
      const recordedRowIndex = origPkg._rowIndex; // Row 3
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key, recordedRowIndex);

      // Row 4: another identical package
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Delete Shift Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 5000, classes_purchased: 5, start_date: '2026-06-01'
      });

      // Delete row 3 (original package) so row 4 (identical replacement) shifts into row 3
      pkgSheet.rows.splice(2, 1); // Remove row index 3

      const retryRes = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid,
        new_classes_purchased: 5,
        currency: 'INR',
        package_price: 5000,
        start_date: '2026-06-01',
        payment: { amount: 5000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      // Must fail closed because multiple packages had identical attributes and row identity cannot be proven
      expect(retryRes.success).toBe(false);
      expect(retryRes.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
    });

    // 10. Two packages have identical values in all 12 physical columns
    it('Scenario 10: Two packages identical in all 12 physical columns fails closed with AMBIGUOUS_RENEWAL_RECOVERY', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Full 12 Col Twin Student', parent_name: 'P Full12', parent_phone: '+91 98765 80004'
      }, adminActor);
      const sid = s.data.student_id;

      // Two packages with identical values in all 12 physical columns
      const twinAttrs = {
        student_id: sid, student_name: 'Full 12 Col Twin Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 15000, per_class: 1500, classes_purchased: 10,
        start_date: '2026-07-01', end_date: '2026-08-01', next_due_date: '2026-08-01',
        class_duration: 60, class_schedule: 'Mon, Wed 17:00'
      };
      PackageRepository.Packages_insert(spreadsheet, twinAttrs);
      PackageRepository.Packages_insert(spreadsheet, twinAttrs);

      const key = 'idemp_full_12_twin';
      const pkgSheet = spreadsheet.getSheetByName('Packages');
      const preRow = pkgSheet.getLastRow();

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 20, 30, {
        new_classes_purchased: 10, currency: 'INR', package_price: 15000, start_date: '2026-07-01',
        payment: { amount: 15000, currency: 'INR', record_payment: true }
      }, adminActor, [], '', 2, preRow);

      // Attempt retry
      const retryRes = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 10, currency: 'INR', package_price: 15000,
        start_date: '2026-07-01', payment: { amount: 15000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      expect(retryRes.success).toBe(false);
      expect(retryRes.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
    });

    // 11. Exact adversarial scenario: Package A moved from row 10 to 11, replacement package for same student with matching classes and date but different price/plan moved into row 10
    it('Scenario 11: Exact adversarial scenario: Package A moved to row 11, replacement with different price/plan moved to row 10 fails closed with AMBIGUOUS_RENEWAL_RECOVERY', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Adversarial Row 10 Student', parent_name: 'P Row10', parent_phone: '+91 98765 80005'
      }, adminActor);
      const sid = s.data.student_id;

      // Fill rows 2 to 9 with dummy packages so that next insert is at row 10
      for (let i = 1; i <= 8; i++) {
        PackageRepository.Packages_insert(spreadsheet, {
          student_id: 'STU_DUMMY_' + i, student_name: 'Dummy ' + i, plan_type: 'Per Class',
          currency: 'INR', package_price: 1000, classes_purchased: 1, start_date: '2026-01-01'
        });
      }

      const pkgSheet = spreadsheet.getSheetByName('Packages');
      expect(pkgSheet.getLastRow()).toBe(9); // Next row will be 10

      const keyA = 'idemp_adv_row10_exact';
      const payloadA = {
        student_id: sid,
        new_classes_purchased: 10,
        currency: 'INR',
        package_price: 10000,
        plan_type: 'Per Class',
        start_date: '2026-05-01',
        payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: keyA
      };

      // 1. Renewal A records intent with pre_insert_last_row = 9
      RenewalIdempotency._recordRenewalInitiated(spreadsheet, keyA, sid, 0, 10, payloadA, adminActor, [], '', 0, 9);

      // 2. Renewal A inserts package A at row 10
      const pkgA = PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Adversarial Row 10 Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 10000, per_class: 1000, classes_purchased: 10,
        start_date: '2026-05-01', end_date: '', next_due_date: '', class_duration: 60, class_schedule: ''
      });
      expect(pkgA._rowIndex).toBe(10);
      expect(pkgSheet.getLastRow()).toBe(10);

      // 3. inserted_row_index = 10 is successfully persisted
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, keyA, 10);
      const ds = RenewalIdempotency._getDurableStore();
      const storedIntent = JSON.parse(ds.getProperty('renewal_idemp_' + keyA));
      expect(storedIntent.inserted_row_index).toBe(10);

      // 4. An external editor moves package A to row 11
      // 5. A different package for the same student is moved into row 10:
      // Same: student_id, classes_purchased (10), start_date ('2026-05-01')
      // Different: package_price (15000), plan_type ('Monthly') -> NOT identical across all 12 columns
      const replacementRow = [
        sid, 'Adversarial Row 10 Student', 'Monthly', 'INR', 15000, 1500, 10,
        '2026-05-01', '', '', 60, ''
      ];
      const packageARow = pkgSheet.rows[9]; // index 9 corresponds to row 10 in sheet

      pkgSheet.rows[9] = replacementRow; // Row 10 now holds replacement package
      pkgSheet.rows.push(packageARow);   // Row 11 now holds Package A
      expect(pkgSheet.getLastRow()).toBe(11);

      const preRetryPkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(preRetryPkgs.length).toBe(2);
      const preRetryPays = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid);
      expect(preRetryPays.length).toBe(0);

      // 6. Renewal A retries
      const retryRes = RenewalService.Packages_renew(spreadsheet, payloadA, adminActor);

      // Expected result:
      // - AMBIGUOUS_RENEWAL_RECOVERY
      expect(retryRes.success).toBe(false);
      expect(retryRes.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');

      // - No package insertion
      const postRetryPkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(postRetryPkgs.length).toBe(2);

      // - No payment insertion
      const postRetryPays = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid);
      expect(postRetryPays.length).toBe(0);

      // - Renewal remains incomplete in STARTED outcome
      const postIntent = JSON.parse(ds.getProperty('renewal_idemp_' + keyA));
      expect(postIntent.outcome).toBe('STARTED');
      expect(postIntent.inProgress).toBe(true);

      // Repeated retry also fails closed
      const repeatRetry = RenewalService.Packages_renew(spreadsheet, payloadA, adminActor);
      expect(repeatRetry.success).toBe(false);
      expect(repeatRetry.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
    });

    // 12. Scenario 12 — Replacement differs only in an unchecked column (end_date or class_duration)
    it('Scenario 12: Replacement differs only in an unchecked column (end_date/class_duration) fails closed with AMBIGUOUS_RENEWAL_RECOVERY', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Scenario 12 Student', parent_name: 'P S12', parent_phone: '+91 98765 80012'
      }, adminActor);
      const sid = s.data.student_id;

      // Fill rows 2 to 9 with dummy packages so that next insert is at row 10
      for (let i = 1; i <= 8; i++) {
        PackageRepository.Packages_insert(spreadsheet, {
          student_id: 'STU_DUMMY_S12_' + i, student_name: 'Dummy S12', plan_type: 'Per Class',
          currency: 'INR', package_price: 1000, classes_purchased: 1, start_date: '2026-01-01'
        });
      }

      const pkgSheet = spreadsheet.getSheetByName('Packages');
      expect(pkgSheet.getLastRow()).toBe(9);

      const key12 = 'idemp_adv_scenario_12';
      const payload12 = {
        student_id: sid,
        student_name: 'Scenario 12 Student',
        new_classes_purchased: 10,
        currency: 'INR',
        package_price: 10000,
        per_class: 1000,
        plan_type: 'Per Class',
        start_date: '2026-05-01',
        end_date: '2026-06-01',
        next_due_date: '2026-06-01',
        class_duration: 60,
        class_schedule: 'Mon 17:00',
        payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key12
      };

      // 1. Original package A is inserted at row 10 and row index persisted
      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key12, sid, 0, 10, payload12, adminActor, [], '', 0, 9);
      const pkgA = PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Scenario 12 Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 10000, per_class: 1000, classes_purchased: 10,
        start_date: '2026-05-01', end_date: '2026-06-01', next_due_date: '2026-06-01',
        class_duration: 60, class_schedule: 'Mon 17:00'
      });
      expect(pkgA._rowIndex).toBe(10);
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key12, 10);

      // 2. Package A moves to row 11
      const packageARow = pkgSheet.rows[9];
      pkgSheet.rows.push(packageARow);

      // 3. Replacement B moves into row 10.
      // B matches all six previously checked fields (sid, classes=10, start_date='2026-05-01', plan='Per Class', price=10000, currency='INR').
      // BUT Replacement B differs ONLY in class_duration (45 instead of 60) and end_date ('2026-06-15' instead of '2026-06-01')
      const replacementBRow = [
        sid, 'Scenario 12 Student', 'Per Class', 'INR', 10000, 1000, 10,
        '2026-05-01', '2026-06-15', '2026-06-01', 45, 'Mon 17:00'
      ];
      pkgSheet.rows[9] = replacementBRow;
      expect(pkgSheet.getLastRow()).toBe(11);

      const preCount = PackageRepository.Packages_getByStudentId(spreadsheet, sid).length;
      expect(preCount).toBe(2);

      // 4. Retry Renewal A
      const retryRes = RenewalService.Packages_renew(spreadsheet, payload12, adminActor);

      // Expected result:
      // - AMBIGUOUS_RENEWAL_RECOVERY because row 10 differs in class_duration / end_date
      expect(retryRes.success).toBe(false);
      expect(retryRes.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');

      // - Zero package insertion
      expect(PackageRepository.Packages_getByStudentId(spreadsheet, sid).length).toBe(preCount);

      // - Zero payment insertion
      const pays = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid);
      expect(pays.length).toBe(0);

      // - Incomplete in STARTED
      const ds = RenewalIdempotency._getDurableStore();
      const raw = ds.getProperty('renewal_idemp_' + key12);
      expect(JSON.parse(raw).outcome).toBe('STARTED');
    });

    // 13. Scenario 13 — Original package moved and modified
    it('Scenario 13: Original package moved and modified, replacement at persisted index fails closed with AMBIGUOUS_RENEWAL_RECOVERY', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Scenario 13 Student', parent_name: 'P S13', parent_phone: '+91 98765 80013'
      }, adminActor);
      const sid = s.data.student_id;

      // Reach row 9
      for (let i = 1; i <= 8; i++) {
        PackageRepository.Packages_insert(spreadsheet, {
          student_id: 'STU_DUMMY_S13_' + i, student_name: 'Dummy S13', plan_type: 'Per Class',
          currency: 'INR', package_price: 1000, classes_purchased: 1, start_date: '2026-01-01'
        });
      }

      const pkgSheet = spreadsheet.getSheetByName('Packages');
      const key13 = 'idemp_adv_scenario_13';
      const payload13 = {
        student_id: sid,
        student_name: 'Scenario 13 Student',
        new_classes_purchased: 8,
        currency: 'INR',
        package_price: 8000,
        plan_type: 'Per Class',
        start_date: '2026-06-01',
        payment: { amount: 8000, currency: 'INR', record_payment: true },
        idempotency_key: key13
      };

      // 1. Original package A inserted at row 10 and persisted
      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key13, sid, 0, 8, payload13, adminActor, [], '', 0, 9);
      const pkgA = PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Scenario 13 Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 8000, per_class: 1000, classes_purchased: 8,
        start_date: '2026-06-01', end_date: '2026-07-01', next_due_date: '2026-07-01',
        class_duration: 60, class_schedule: 'Wed 16:00'
      });
      expect(pkgA._rowIndex).toBe(10);
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key13, 10);

      // 2. Package A moves to row 11 and is modified out of band (e.g. classes_purchased edited to 99)
      const modifiedARow = [
        sid, 'Scenario 13 Student', 'Per Class', 'INR', 8000, 1000, 99, // modified from 8 to 99
        '2026-06-01', '2026-07-01', '2026-07-01', 60, 'Wed 16:00'
      ];
      pkgSheet.rows.push(modifiedARow);

      // 3. A replacement package is placed at the persisted row index (row 10)
      const replacementRow10 = [
        sid, 'Scenario 13 Student', 'Per Class', 'INR', 8000, 1000, 8,
        '2026-06-10', '2026-07-10', '2026-07-10', 60, 'Wed 16:00' // start date differs
      ];
      pkgSheet.rows[9] = replacementRow10;

      const preCount = PackageRepository.Packages_getByStudentId(spreadsheet, sid).length;

      // 4. Retry must fail closed
      const retryRes = RenewalService.Packages_renew(spreadsheet, payload13, adminActor);
      expect(retryRes.success).toBe(false);
      expect(retryRes.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');

      // Assert zero side effects
      expect(PackageRepository.Packages_getByStudentId(spreadsheet, sid).length).toBe(preCount);
      const pays = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid);
      expect(pays.length).toBe(0);

      const ds = RenewalIdempotency._getDurableStore();
      const raw = ds.getProperty('renewal_idemp_' + key13);
      expect(JSON.parse(raw).outcome).toBe('STARTED');
    });

    // 14. Scenario 14 — Identical physical rows across all 12 columns
    it('Scenario 14: Two package rows match all 12 physical fields -> recovery rejects ambiguity and fails closed', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Scenario 14 Student', parent_name: 'P S14', parent_phone: '+91 98765 80014'
      }, adminActor);
      const sid = s.data.student_id;

      // Insert two physically identical packages in all 12 columns
      const identical12ColRow = {
        student_id: sid, student_name: 'Scenario 14 Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 12000, per_class: 1200, classes_purchased: 10,
        start_date: '2026-07-01', end_date: '2026-08-01', next_due_date: '2026-08-01',
        class_duration: 60, class_schedule: 'Mon, Wed 17:00'
      };
      const p1 = PackageRepository.Packages_insert(spreadsheet, { ...identical12ColRow });
      const p2 = PackageRepository.Packages_insert(spreadsheet, { ...identical12ColRow });
      expect(p1._rowIndex).toBe(2);
      expect(p2._rowIndex).toBe(3);

      const key14 = 'idemp_adv_scenario_14';
      const payload14 = {
        student_id: sid,
        student_name: 'Scenario 14 Student',
        new_classes_purchased: 10,
        currency: 'INR',
        package_price: 12000,
        per_class: 1200,
        plan_type: 'Per Class',
        start_date: '2026-07-01',
        end_date: '2026-08-01',
        next_due_date: '2026-08-01',
        class_duration: 60,
        class_schedule: 'Mon, Wed 17:00',
        payment: { amount: 12000, currency: 'INR', record_payment: true },
        idempotency_key: key14
      };

      // Record renewal intent pointing to row 2
      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key14, sid, 10, 20, payload14, adminActor, [], '', 1, 1);
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key14, 2);

      const preCount = PackageRepository.Packages_getByStudentId(spreadsheet, sid).length;
      expect(preCount).toBe(2);

      // Attempt recovery: must reject ambiguity and fail closed rather than choosing row 2 or 3 based on order
      const retryRes = RenewalService.Packages_renew(spreadsheet, payload14, adminActor);
      expect(retryRes.success).toBe(false);
      expect(retryRes.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');

      // Assert zero mutations
      expect(PackageRepository.Packages_getByStudentId(spreadsheet, sid).length).toBe(preCount);
      const pays = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid);
      expect(pays.length).toBe(0);

      const ds = RenewalIdempotency._getDurableStore();
      const raw = ds.getProperty('renewal_idemp_' + key14);
      expect(JSON.parse(raw).outcome).toBe('STARTED');
    });
  });

  // SECTION 7 — Final Snapshot Completeness & Explicit 12-Column Verification
  describe('SECTION 7 — Final Snapshot Completeness & Explicit 12-Column Verification', () => {
    const createBaseStudentAndPackage = (name: string, phone: string) => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: name, parent_name: 'P ' + name, parent_phone: phone
      }, adminActor);
      const sid = s.data.student_id;
      const insPkg = PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: name, plan_type: 'Per Class',
        currency: 'INR', package_price: 10000, per_class: 1000, classes_purchased: 10,
        start_date: '2026-07-01', end_date: '2026-08-01', next_due_date: '2026-08-01',
        class_duration: 60, class_schedule: 'Mon, Wed 17:00'
      });
      return { sid, insPkg };
    };

    const createCompleteSnapshot = (sid: string, name: string) => ({
      student_id: sid,
      student_name: name,
      plan_type: 'Per Class',
      currency: 'INR',
      package_price: 10000,
      per_class: 1000,
      classes_purchased: 10,
      start_date: '2026-07-01',
      end_date: '2026-08-01',
      next_due_date: '2026-08-01',
      class_duration: 60,
      class_schedule: 'Mon, Wed 17:00'
    });

    // 1. Missing student_name in intent snapshot
    it('fails closed when student_name is missing in intent snapshot', () => {
      const { sid, insPkg } = createBaseStudentAndPackage('Missing StuName', '+91 98765 90001');
      const key = 'idemp_missing_stuname';
      const snap = createCompleteSnapshot(sid, 'Missing StuName');
      // @ts-ignore
      delete snap.student_name;

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 10, 20, {
        new_classes_purchased: 10, currency: 'INR', package_price: 10000, start_date: '2026-07-01',
        payment: { amount: 10000, currency: 'INR', record_payment: true }, idempotency_key: key
      }, adminActor, [], '', 1, 1, snap);
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key, insPkg._rowIndex);

      const res = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 10, currency: 'INR', package_price: 10000,
        start_date: '2026-07-01', payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      expect(res.success).toBe(false);
      expect(res.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
      expect(RenewalService._isPackageSnapshotComplete(snap)).toBe(false);
    });

    // 2. Missing per_class in intent snapshot
    it('fails closed when per_class is missing in intent snapshot', () => {
      const { sid, insPkg } = createBaseStudentAndPackage('Missing PerClass', '+91 98765 90002');
      const key = 'idemp_missing_perclass';
      const snap = createCompleteSnapshot(sid, 'Missing PerClass');
      // @ts-ignore
      delete snap.per_class;

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 10, 20, {
        new_classes_purchased: 10, currency: 'INR', package_price: 10000, start_date: '2026-07-01',
        payment: { amount: 10000, currency: 'INR', record_payment: true }, idempotency_key: key
      }, adminActor, [], '', 1, 1, snap);
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key, insPkg._rowIndex);

      const res = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 10, currency: 'INR', package_price: 10000,
        start_date: '2026-07-01', payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      expect(res.success).toBe(false);
      expect(res.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
      expect(RenewalService._isPackageSnapshotComplete(snap)).toBe(false);
    });

    // 3. Missing end_date in intent snapshot
    it('fails closed when end_date is missing in intent snapshot', () => {
      const { sid, insPkg } = createBaseStudentAndPackage('Missing EndDate', '+91 98765 90003');
      const key = 'idemp_missing_enddate';
      const snap = createCompleteSnapshot(sid, 'Missing EndDate');
      // @ts-ignore
      delete snap.end_date;

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 10, 20, {
        new_classes_purchased: 10, currency: 'INR', package_price: 10000, start_date: '2026-07-01',
        payment: { amount: 10000, currency: 'INR', record_payment: true }, idempotency_key: key
      }, adminActor, [], '', 1, 1, snap);
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key, insPkg._rowIndex);

      const res = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 10, currency: 'INR', package_price: 10000,
        start_date: '2026-07-01', payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      expect(res.success).toBe(false);
      expect(res.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
      expect(RenewalService._isPackageSnapshotComplete(snap)).toBe(false);
    });

    // 4. Missing next_due_date in intent snapshot
    it('fails closed when next_due_date is missing in intent snapshot', () => {
      const { sid, insPkg } = createBaseStudentAndPackage('Missing NextDue', '+91 98765 90004');
      const key = 'idemp_missing_nextdue';
      const snap = createCompleteSnapshot(sid, 'Missing NextDue');
      // @ts-ignore
      delete snap.next_due_date;

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 10, 20, {
        new_classes_purchased: 10, currency: 'INR', package_price: 10000, start_date: '2026-07-01',
        payment: { amount: 10000, currency: 'INR', record_payment: true }, idempotency_key: key
      }, adminActor, [], '', 1, 1, snap);
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key, insPkg._rowIndex);

      const res = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 10, currency: 'INR', package_price: 10000,
        start_date: '2026-07-01', payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      expect(res.success).toBe(false);
      expect(res.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
      expect(RenewalService._isPackageSnapshotComplete(snap)).toBe(false);
    });

    // 5. Missing class_duration in intent snapshot
    it('fails closed when class_duration is missing in intent snapshot', () => {
      const { sid, insPkg } = createBaseStudentAndPackage('Missing Duration', '+91 98765 90005');
      const key = 'idemp_missing_duration';
      const snap = createCompleteSnapshot(sid, 'Missing Duration');
      // @ts-ignore
      delete snap.class_duration;

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 10, 20, {
        new_classes_purchased: 10, currency: 'INR', package_price: 10000, start_date: '2026-07-01',
        payment: { amount: 10000, currency: 'INR', record_payment: true }, idempotency_key: key
      }, adminActor, [], '', 1, 1, snap);
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key, insPkg._rowIndex);

      const res = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 10, currency: 'INR', package_price: 10000,
        start_date: '2026-07-01', payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      expect(res.success).toBe(false);
      expect(res.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
      expect(RenewalService._isPackageSnapshotComplete(snap)).toBe(false);
    });

    // 6. Missing class_schedule in intent snapshot
    it('fails closed when class_schedule is missing in intent snapshot', () => {
      const { sid, insPkg } = createBaseStudentAndPackage('Missing Sched', '+91 98765 90006');
      const key = 'idemp_missing_sched';
      const snap = createCompleteSnapshot(sid, 'Missing Sched');
      // @ts-ignore
      delete snap.class_schedule;

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 10, 20, {
        new_classes_purchased: 10, currency: 'INR', package_price: 10000, start_date: '2026-07-01',
        payment: { amount: 10000, currency: 'INR', record_payment: true }, idempotency_key: key
      }, adminActor, [], '', 1, 1, snap);
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key, insPkg._rowIndex);

      const res = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 10, currency: 'INR', package_price: 10000,
        start_date: '2026-07-01', payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      expect(res.success).toBe(false);
      expect(res.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
      expect(RenewalService._isPackageSnapshotComplete(snap)).toBe(false);
    });

    // 7. Known blank values compared correctly against physical blank values
    it('compares known blank values correctly against physical blanks and recovers successfully', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Known Blank Student', parent_name: 'P Blank', parent_phone: '+91 98765 90007'
      }, adminActor);
      const sid = s.data.student_id;

      // Physically insert row with explicit blanks for optional columns
      const insPkg = PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Known Blank Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 8000, per_class: '', classes_purchased: 8,
        start_date: '2026-09-01', end_date: '', next_due_date: '',
        class_duration: '', class_schedule: ''
      });

      const key = 'idemp_known_blanks_match';
      const snapWithKnownBlanks = {
        student_id: sid,
        student_name: 'Known Blank Student',
        plan_type: 'Per Class',
        currency: 'INR',
        package_price: 8000,
        per_class: '',
        classes_purchased: 8,
        start_date: '2026-09-01',
        end_date: '',
        next_due_date: '',
        class_duration: '',
        class_schedule: ''
      };
      expect(RenewalService._isPackageSnapshotComplete(snapWithKnownBlanks)).toBe(true);

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 8, 16, {
        new_classes_purchased: 8, currency: 'INR', package_price: 8000, start_date: '2026-09-01',
        payment: { amount: 8000, currency: 'INR', record_payment: true }, idempotency_key: key
      }, adminActor, [], '', 1, 1, snapWithKnownBlanks);
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key, insPkg._rowIndex);

      // Verify direct 12-column match returns true for known blanks
      expect(RenewalService._matchPackage12Columns(insPkg, snapWithKnownBlanks)).toBe(true);

      const res = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 8, currency: 'INR', package_price: 8000,
        start_date: '2026-09-01', payment: { amount: 8000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      expect(res.success).toBe(true);
      const pkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(pkgs.length).toBe(1); // No duplicate package inserted
      const pays = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid);
      expect(pays.length).toBe(1); // Payment recorded
    });

    // 8. Known blank versus nonblank values rejected
    it('rejects known blank versus nonblank values in both directions', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Blank Vs Nonblank Student', parent_name: 'P BvN', parent_phone: '+91 98765 90008'
      }, adminActor);
      const sid = s.data.student_id;

      // Actual row has end_date: '2026-10-01'
      const actualNonblank = {
        student_id: sid, student_name: 'Blank Vs Nonblank Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 8000, per_class: 1000, classes_purchased: 8,
        start_date: '2026-09-01', end_date: '2026-10-01', next_due_date: '2026-10-01',
        class_duration: 60, class_schedule: 'Mon 16:00'
      };
      // Expected snapshot has known blank end_date: ''
      const expectedBlank = {
        student_id: sid, student_name: 'Blank Vs Nonblank Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 8000, per_class: 1000, classes_purchased: 8,
        start_date: '2026-09-01', end_date: '', next_due_date: '2026-10-01',
        class_duration: 60, class_schedule: 'Mon 16:00'
      };

      // Both directions reject
      expect(RenewalService._matchPackage12Columns(actualNonblank, expectedBlank)).toBe(false);
      expect(RenewalService._matchPackage12Columns(expectedBlank, actualNonblank)).toBe(false);

      // Same check for schedule (blank vs nonblank)
      const expectedBlankSched = { ...actualNonblank, class_schedule: '' };
      expect(RenewalService._matchPackage12Columns(actualNonblank, expectedBlankSched)).toBe(false);
      expect(RenewalService._matchPackage12Columns(expectedBlankSched, actualNonblank)).toBe(false);
    });

    // 9. Twin detection with asymmetric missing fields
    it('ensures twin detection with asymmetric missing fields fails symmetrically without false matches', () => {
      const sid = 'STU_ASYM_TWIN';
      const rowA = {
        student_id: sid, student_name: 'Asym Twin', plan_type: 'Per Class',
        currency: 'INR', package_price: 5000, per_class: 1000, classes_purchased: 5,
        start_date: '2026-09-01', end_date: '2026-10-01', next_due_date: '2026-10-01',
        class_duration: 60, class_schedule: 'Tue 15:00'
      };
      // rowB missing per_class (undefined)
      const rowB = {
        student_id: sid, student_name: 'Asym Twin', plan_type: 'Per Class',
        currency: 'INR', package_price: 5000, classes_purchased: 5,
        start_date: '2026-09-01', end_date: '2026-10-01', next_due_date: '2026-10-01',
        class_duration: 60, class_schedule: 'Tue 15:00'
      };

      expect(RenewalService._isPackageSnapshotComplete(rowA)).toBe(true);
      expect(RenewalService._isPackageSnapshotComplete(rowB)).toBe(false);

      // Symmetric rejection: neither direction matches as twins
      expect(RenewalService._matchPackage12Columns(rowA, rowB)).toBe(false);
      expect(RenewalService._matchPackage12Columns(rowB, rowA)).toBe(false);
    });

    // 10. Incomplete snapshot causing no package, payment, or schedule writes
    it('verifies incomplete snapshot recovery causes zero package, payment, or schedule mutations', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Zero Mutation Student', parent_name: 'P ZM', parent_phone: '+91 98765 90010'
      }, adminActor);
      const sid = s.data.student_id;

      const pInit = PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Zero Mutation Student', plan_type: 'Per Class',
        currency: 'INR', package_price: 6000, per_class: 1000, classes_purchased: 6,
        start_date: '2026-08-01', end_date: '2026-09-01', next_due_date: '2026-09-01',
        class_duration: 60, class_schedule: 'Mon 11:00'
      });

      const key = 'idemp_zero_mutation_incomplete';
      const incompleteSnapshot = {
        student_id: sid,
        student_name: 'Zero Mutation Student',
        plan_type: 'Per Class',
        currency: 'INR',
        package_price: 6000,
        classes_purchased: 6,
        start_date: '2026-08-01'
        // Missing: per_class, end_date, next_due_date, class_duration, class_schedule
      };

      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 6, 12, {
        new_classes_purchased: 6, currency: 'INR', package_price: 6000, start_date: '2026-08-01',
        payment: { amount: 6000, currency: 'INR', record_payment: true },
        schedules: [{ day_of_week: 'MONDAY', start_time: '11:00' }],
        idempotency_key: key
      }, adminActor, [], '', 1, 1, incompleteSnapshot);
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key, pInit._rowIndex);

      const prePkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid).length;
      const prePays = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length;
      const preCls = ClassRepository.Classes_getAll(spreadsheet).filter((c: any) => c.student_id === sid).length;

      const res = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 6, currency: 'INR', package_price: 6000,
        start_date: '2026-08-01', payment: { amount: 6000, currency: 'INR', record_payment: true },
        schedules: [{ day_of_week: 'MONDAY', start_time: '11:00' }],
        idempotency_key: key
      }, adminActor);

      expect(res.success).toBe(false);
      expect(res.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');

      // Assert zero package writes
      const postPkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid).length;
      expect(postPkgs).toBe(prePkgs);

      // Assert zero payment writes
      const postPays = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length;
      expect(postPays).toBe(prePays);

      // Assert zero schedule writes
      const postCls = ClassRepository.Classes_getAll(spreadsheet).filter((c: any) => c.student_id === sid).length;
      expect(postCls).toBe(preCls);

      // Assert durable intent remains STARTED
      const ds = RenewalIdempotency._getDurableStore();
      const raw = ds.getProperty('renewal_idemp_' + key);
      expect(JSON.parse(raw).outcome).toBe('STARTED');
    });
  });

  // SECTION 8 — Adversarial Incomplete Candidate Row Handling & 12-Column Exhaustive Audit
  describe('SECTION 8 — Adversarial Incomplete Candidate Row Handling & 12-Column Exhaustive Audit', () => {
    const fullExpected = (sid: string, overrides: Record<string, any> = {}) => ({
      student_id: sid,
      student_name: 'Audit Candidate Student',
      plan_type: 'Per Class',
      currency: 'INR',
      package_price: 10000,
      per_class: 1000,
      classes_purchased: 10,
      start_date: '2026-11-01',
      end_date: '2026-12-01',
      next_due_date: '2026-12-01',
      class_duration: 60,
      class_schedule: 'Mon 18:00',
      ...overrides
    });

    it('Scenario 1: One complete matching candidate + one incomplete potential candidate -> fails closed with AMBIGUOUS_RENEWAL_RECOVERY and zero mutations', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Audit Candidate Student', parent_name: 'P Cand', parent_phone: '+91 98765 88001'
      }, adminActor);
      const sid = s.data.student_id;

      // Candidate 1: complete matching package inserted at row 10
      const p1 = PackageRepository.Packages_insert(spreadsheet, fullExpected(sid));
      // Candidate 2: incomplete potential candidate (missing per_class, end_date, etc.)
      const p2 = {
        student_id: sid,
        student_name: 'Audit Candidate Student',
        classes_purchased: 10,
        start_date: '2026-11-01',
        package_price: 10000
        // Missing per_class, end_date, next_due_date, class_duration, class_schedule
      };
      // Insert incomplete candidate manually via sheet to simulate corrupted/incomplete row
      const pkgSheet = spreadsheet.getSheetByName('Packages');
      pkgSheet.appendRow([sid, 'Audit Candidate Student', 'Per Class', 'INR', 10000]); // 5 columns only!

      const key = 'idemp_incomplete_cand_01';
      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 10, 20, {
        new_classes_purchased: 10, currency: 'INR', package_price: 10000, start_date: '2026-11-01',
        payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor, [], '', 1, 1, fullExpected(sid));
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key, p1._rowIndex);

      const prePkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid).length;
      const prePays = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length;
      const preCls = ClassRepository.Classes_getAll(spreadsheet).filter((c: any) => c.student_id === sid).length;

      const res = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 10, currency: 'INR', package_price: 10000,
        start_date: '2026-11-01', payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      expect(res.success).toBe(false);
      expect(res.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
      expect(res.message).toContain('incomplete or missing physical columns');

      // Zero mutations
      expect(PackageRepository.Packages_getByStudentId(spreadsheet, sid).length).toBe(prePkgs);
      expect(PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length).toBe(prePays);
      expect(ClassRepository.Classes_getAll(spreadsheet).filter((c: any) => c.student_id === sid).length).toBe(preCls);
    });

    it('Scenario 2: Two incomplete potential candidates -> fails closed with AMBIGUOUS_RENEWAL_RECOVERY and zero mutations', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Audit Cand 2', parent_name: 'P Cand2', parent_phone: '+91 98765 88002'
      }, adminActor);
      const sid = s.data.student_id;

      const pkgSheet = spreadsheet.getSheetByName('Packages');
      pkgSheet.appendRow([sid, 'Audit Cand 2', 'Per Class', 'INR', 10000, '', 10, '2026-11-01']); // missing end_date, etc.
      const row1 = pkgSheet.getLastRow();
      pkgSheet.appendRow([sid, 'Audit Cand 2', 'Per Class', 'INR', 10000, '', 10, '2026-11-01']); // missing end_date, etc.

      const key = 'idemp_incomplete_cand_02';
      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 10, 20, {
        new_classes_purchased: 10, currency: 'INR', package_price: 10000, start_date: '2026-11-01',
        payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor, [], '', 0, 1, fullExpected(sid, { student_name: 'Audit Cand 2' }));
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key, row1);

      const prePkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid).length;
      const prePays = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length;
      const preCls = ClassRepository.Classes_getAll(spreadsheet).filter((c: any) => c.student_id === sid).length;

      const res = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 10, currency: 'INR', package_price: 10000,
        start_date: '2026-11-01', payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      expect(res.success).toBe(false);
      expect(res.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');

      // Zero mutations
      expect(PackageRepository.Packages_getByStudentId(spreadsheet, sid).length).toBe(prePkgs);
      expect(PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length).toBe(prePays);
      expect(ClassRepository.Classes_getAll(spreadsheet).filter((c: any) => c.student_id === sid).length).toBe(preCls);
    });

    it('Scenario 3: Complete candidate + incomplete candidate with identical known fields -> fails closed with AMBIGUOUS_RENEWAL_RECOVERY', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Audit Cand 3', parent_name: 'P Cand3', parent_phone: '+91 98765 88003'
      }, adminActor);
      const sid = s.data.student_id;

      const pComplete = PackageRepository.Packages_insert(spreadsheet, fullExpected(sid, { student_name: 'Audit Cand 3' }));
      const pkgSheet = spreadsheet.getSheetByName('Packages');
      // Incomplete candidate shares known fields: student_id, student_name, plan_type, currency, package_price, per_class, classes_purchased, start_date
      pkgSheet.appendRow([sid, 'Audit Cand 3', 'Per Class', 'INR', 10000, 1000, 10, '2026-11-01']); // missing end_date, next_due_date, class_duration, class_schedule

      const key = 'idemp_incomplete_cand_03';
      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 10, 20, {
        new_classes_purchased: 10, currency: 'INR', package_price: 10000, start_date: '2026-11-01',
        payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor, [], '', 0, 1, fullExpected(sid, { student_name: 'Audit Cand 3' }));
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key, pComplete._rowIndex);

      const prePkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid).length;
      const prePays = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length;
      const preCls = ClassRepository.Classes_getAll(spreadsheet).filter((c: any) => c.student_id === sid).length;

      const res = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid, new_classes_purchased: 10, currency: 'INR', package_price: 10000,
        start_date: '2026-11-01', payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor);

      expect(res.success).toBe(false);
      expect(res.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
      expect(res.message).toContain('incomplete or missing physical columns');

      // Zero mutations
      expect(PackageRepository.Packages_getByStudentId(spreadsheet, sid).length).toBe(prePkgs);
      expect(PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length).toBe(prePays);
      expect(ClassRepository.Classes_getAll(spreadsheet).filter((c: any) => c.student_id === sid).length).toBe(preCls);
    });

    it('Scenario 4: Missing physical header/field in repository mapping -> fails closed with AMBIGUOUS_RENEWAL_RECOVERY and zero mutations', () => {
      const s = StudentService.Students_create(spreadsheet, {
        student_name: 'Audit Cand 4', parent_name: 'P Cand4', parent_phone: '+91 98765 88004'
      }, adminActor);
      const sid = s.data.student_id;

      const pComplete = PackageRepository.Packages_insert(spreadsheet, fullExpected(sid, { student_name: 'Audit Cand 4' }));

      // Mock PackageRepository to simulate missing physical column in mapping (e.g. class_duration is omitted/undefined)
      const origGetByStudentId = PackageRepository.Packages_getByStudentId;
      PackageRepository.Packages_getByStudentId = (ss: any, id: string) => {
        const pkgs = origGetByStudentId(ss, id);
        return pkgs.map((p: any) => {
          const clone = { ...p };
          delete clone.class_duration; // simulate omitted physical column from repository mapping
          return clone;
        });
      };

      const key = 'idemp_incomplete_cand_04';
      RenewalIdempotency._recordRenewalInitiated(spreadsheet, key, sid, 10, 20, {
        new_classes_purchased: 10, currency: 'INR', package_price: 10000, start_date: '2026-11-01',
        payment: { amount: 10000, currency: 'INR', record_payment: true },
        idempotency_key: key
      }, adminActor, [], '', 0, 1, fullExpected(sid, { student_name: 'Audit Cand 4' }));
      RenewalIdempotency._recordRenewalPackageRow(spreadsheet, key, pComplete._rowIndex);

      const prePays = PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length;
      const preCls = ClassRepository.Classes_getAll(spreadsheet).filter((c: any) => c.student_id === sid).length;

      try {
        const res = RenewalService.Packages_renew(spreadsheet, {
          student_id: sid, new_classes_purchased: 10, currency: 'INR', package_price: 10000,
          start_date: '2026-11-01', payment: { amount: 10000, currency: 'INR', record_payment: true },
          idempotency_key: key
        }, adminActor);

        expect(res.success).toBe(false);
        expect(res.code).toBe('AMBIGUOUS_RENEWAL_RECOVERY');
      } finally {
        PackageRepository.Packages_getByStudentId = origGetByStudentId;
      }

      // Zero mutations
      expect(PaymentRepository.Payments_getAll(spreadsheet).filter((p: any) => p.student_id === sid).length).toBe(prePays);
      expect(ClassRepository.Classes_getAll(spreadsheet).filter((c: any) => c.student_id === sid).length).toBe(preCls);
    });

    it('Exhaustive 12-column mismatch verification: each column differs individually and is rejected', () => {
      const sid = 'S-AUDIT-12COL';
      const baseSnapshot = fullExpected(sid);

      // Verify that changing ANY single column causes _matchPackage12Columns to return false
      const testCases: Array<{ col: string; altered: any }> = [
        { col: 'student_id', altered: 'S-DIFFERENT' },
        { col: 'student_name', altered: 'Different Student Name' },
        { col: 'plan_type', altered: 'Monthly' },
        { col: 'currency', altered: 'USD' },
        { col: 'package_price', altered: 9999 },
        { col: 'per_class', altered: 999 },
        { col: 'classes_purchased', altered: 12 },
        { col: 'start_date', altered: '2026-11-05' },
        { col: 'end_date', altered: '2026-12-05' },
        { col: 'next_due_date', altered: '2026-12-05' },
        { col: 'class_duration', altered: 45 },
        { col: 'class_schedule', altered: 'Tue 19:00' }
      ];

      for (const tc of testCases) {
        const alteredSnapshot = { ...baseSnapshot, [tc.col]: tc.altered };
        const isMatch = RenewalService._matchPackage12Columns(alteredSnapshot, baseSnapshot);
        expect(isMatch, `Column ${tc.col} differed but _matchPackage12Columns returned true!`).toBe(false);
      }
    });

    it('Explicit blank matching verification: matching known physical blanks succeeds across all optional columns', () => {
      const sid = 'S-AUDIT-BLANKS';
      const snapshotWithBlanks = {
        student_id: sid,
        student_name: 'Blank Testing Student',
        plan_type: 'Per Class',
        currency: 'INR',
        package_price: 10000,
        per_class: '',          // explicitly blank
        classes_purchased: 10,
        start_date: '2026-11-01',
        end_date: '',            // explicitly blank
        next_due_date: '',       // explicitly blank
        class_duration: '',      // explicitly blank
        class_schedule: ''       // explicitly blank
      };

      expect(RenewalService._isPackageSnapshotComplete(snapshotWithBlanks)).toBe(true);

      const actualWithBlanks = { ...snapshotWithBlanks };
      expect(RenewalService._matchPackage12Columns(actualWithBlanks, snapshotWithBlanks)).toBe(true);

      // But if actual has a non-blank value where expected has blank, it must reject
      expect(RenewalService._matchPackage12Columns({ ...actualWithBlanks, per_class: 1000 }, snapshotWithBlanks)).toBe(false);
      expect(RenewalService._matchPackage12Columns({ ...actualWithBlanks, end_date: '2026-12-01' }, snapshotWithBlanks)).toBe(false);
      expect(RenewalService._matchPackage12Columns({ ...actualWithBlanks, next_due_date: '2026-12-01' }, snapshotWithBlanks)).toBe(false);
      expect(RenewalService._matchPackage12Columns({ ...actualWithBlanks, class_duration: 60 }, snapshotWithBlanks)).toBe(false);
      expect(RenewalService._matchPackage12Columns({ ...actualWithBlanks, class_schedule: 'Mon 18:00' }, snapshotWithBlanks)).toBe(false);
    });
  });

  describe('Standalone Schedule and Package Locking Concurrency Safety', () => {
    // @ts-ignore
    const LockManager = require('../../02-backend/apps-script/sheets/LockManager.gs');
    // @ts-ignore
    const OperationRouter = require('../../02-backend/apps-script/api/OperationRouter.gs');
    // @ts-ignore
    const { registerClassScheduleOperations } = require('../../02-backend/apps-script/classes/ClassScheduleHandlers.gs');

    beforeEach(() => {
      LockManager._resetLockState();
      ClassScheduleService._setLockManager(LockManager);
      PackageService._setLockManager(LockManager);
      RenewalService._setLockManager(LockManager);
    });

    afterEach(() => {
      LockManager._resetLockState();
      ClassScheduleService._setLockManager(LockManager);
      PackageService._setLockManager(LockManager);
      RenewalService._setLockManager(LockManager);
    });

    it('1. Direct schedules.save API call acquires the shared lock', () => {
      const sid = 'STU-LOCK-TEST-1';
      StudentRepository.Students_insert(spreadsheet, {
        student_id: sid, student_name: 'Lock Test Student 1', status: 'ACTIVE'
      });
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Lock Test Student 1', plan_type: 'Per Class',
        currency: 'INR', package_price: 10000, per_class: 1000, classes_purchased: 10,
        start_date: '2026-11-01', class_duration: 60, class_schedule: 'Sun - 10:00 AM'
      });

      let lockAcquired = false;
      let lockTimeout = 0;
      const originalWithLock = LockManager.withLock;
      const testLockManager = {
        withLock: (timeout: number, fn: () => any) => {
          lockAcquired = true;
          lockTimeout = timeout;
          return originalWithLock(timeout, fn);
        }
      };

      ClassScheduleService._setLockManager(testLockManager);

      const router = {
        registered: {} as Record<string, Function>,
        registerOperation: (opName: string, handler: Function) => {
          router.registered[opName] = handler;
        }
      };
      registerClassScheduleOperations(router);

      const ctx = {
        spreadsheet,
        actorId: adminActor.actorId,
        verifiedEmail: adminActor.email,
        requestId: 'req_lock_1',
        payload: {
          student_id: sid,
          schedules: [
            { day_of_week: 'MONDAY', start_time: '16:00', end_time: '17:00' },
            { day_of_week: 'WEDNESDAY', start_time: '17:00', end_time: '18:00' }
          ]
        }
      };

      const res = router.registered['schedules.save'](ctx);
      expect(res.success).toBe(true);
      expect(lockAcquired).toBe(true);
      expect(lockTimeout).toBe(10000);

      // Verify Packages sheet was updated with formatted schedule
      const pkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(pkgs[0].class_schedule).toContain('Mon');
      expect(pkgs[0].class_schedule).toContain('Wed');
    });

    it('2. Direct save returns a lock failure without mutating Packages when lock acquisition fails', () => {
      const sid = 'STU-LOCK-TEST-2';
      StudentRepository.Students_insert(spreadsheet, {
        student_id: sid, student_name: 'Lock Test Student 2', status: 'ACTIVE'
      });
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Lock Test Student 2', plan_type: 'Per Class',
        currency: 'INR', package_price: 10000, per_class: 1000, classes_purchased: 10,
        start_date: '2026-11-01', class_duration: 60, class_schedule: 'Original Locked Schedule'
      });

      // Mock lock manager that fails lock acquisition
      const failingLockManager = {
        withLock: () => {
          return { success: false, code: 'CONFLICT', message: 'Could not acquire script lock within timeout; try again' };
        }
      };
      ClassScheduleService._setLockManager(failingLockManager);

      const saveRes = ClassScheduleService.Schedules_save(spreadsheet, sid, [
        { day_of_week: 'FRIDAY', start_time: '14:00', end_time: '15:00' }
      ], adminActor);

      expect(saveRes.success).toBe(false);
      expect(saveRes.code).toBe('CONFLICT');
      expect(saveRes.message).toContain('Could not acquire script lock');

      // Verify Packages sheet was NOT mutated
      const pkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(pkgs[0].class_schedule).toBe('Original Locked Schedule');
    });

    it('3. Renewal calling Schedules_save under an existing lock does not deadlock', () => {
      const sid = 'STU-LOCK-TEST-3';
      StudentRepository.Students_insert(spreadsheet, {
        student_id: sid, student_name: 'Lock Test Student 3', status: 'ACTIVE'
      });
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Lock Test Student 3', plan_type: 'Per Class',
        currency: 'INR', package_price: 10000, per_class: 1000, classes_purchased: 10,
        start_date: '2026-11-01', class_duration: 60, class_schedule: 'Mon - 10:00 AM'
      });

      // Call Packages_renew which holds the renewal lock and invokes Schedules_save
      const renewRes = RenewalService.Packages_renew(spreadsheet, {
        student_id: sid,
        new_classes_purchased: 10,
        currency: 'INR',
        package_price: 10000,
        start_date: '2026-11-15',
        schedules: [
          { day_of_week: 'TUESDAY', start_time: '15:00', end_time: '16:00' }
        ],
        idempotency_key: 'idemp_nested_lock_test_3'
      }, adminActor);

      expect(renewRes.success).toBe(true);
      expect(renewRes.data.new_classes_purchased).toBe(10);
      expect(LockManager._getLockDepth()).toBe(0);

      // Verify schedule was saved on the latest renewed package (pkgs is sorted descending by start_date)
      const pkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(pkgs.length).toBe(2);
      expect(pkgs[0].class_schedule).toContain('Tue');
    });

    it('4. Nested lock depth is restored correctly after success', () => {
      const sid = 'STU-LOCK-TEST-4';
      StudentRepository.Students_insert(spreadsheet, {
        student_id: sid, student_name: 'Lock Test Student 4', status: 'ACTIVE'
      });
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Lock Test Student 4', plan_type: 'Per Class',
        currency: 'INR', package_price: 10000, per_class: 1000, classes_purchased: 10,
        start_date: '2026-11-01', class_duration: 60, class_schedule: ''
      });

      expect(LockManager._getLockDepth()).toBe(0);

      let innerDepthDuringSave = 0;
      const outerRes = LockManager.withLock(5000, () => {
        expect(LockManager._getLockDepth()).toBe(1);

        const saveRes = ClassScheduleService.Schedules_save(spreadsheet, sid, [
          { day_of_week: 'SATURDAY', start_time: '11:00', end_time: '12:00' }
        ], adminActor);

        innerDepthDuringSave = LockManager._getLockDepth();
        expect(saveRes.success).toBe(true);
        return saveRes;
      });

      expect(outerRes.success).toBe(true);
      // While inside outer lock and after inner save finished, depth must be 1
      expect(innerDepthDuringSave).toBe(1);
      // After outer lock exits, depth must be 0
      expect(LockManager._getLockDepth()).toBe(0);
    });

    it('5. Nested lock depth is restored correctly after an exception', () => {
      const sid = 'STU-LOCK-TEST-5';
      StudentRepository.Students_insert(spreadsheet, {
        student_id: sid, student_name: 'Lock Test Student 5', status: 'ACTIVE'
      });
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Lock Test Student 5', plan_type: 'Per Class',
        currency: 'INR', package_price: 10000, per_class: 1000, classes_purchased: 10,
        start_date: '2026-11-01', class_duration: 60, class_schedule: 'Initial Unchanged'
      });

      expect(LockManager._getLockDepth()).toBe(0);

      const outerRes = LockManager.withLock(5000, () => {
        expect(LockManager._getLockDepth()).toBe(1);
        ClassScheduleService.Schedules_save(spreadsheet, sid, [
          { day_of_week: 'THURSDAY', start_time: '09:00', end_time: '10:00' }
        ], adminActor);

        throw new Error('Simulated crash inside outer lock boundary');
      });

      expect(outerRes.success).toBe(false);
      expect(outerRes.code).toBe('EXECUTION_ERROR');
      expect(outerRes.message).toContain('Simulated crash inside outer lock boundary');
      // Depth must be safely restored to 0
      expect(LockManager._getLockDepth()).toBe(0);
    });

    it('6. Contention simulation: Unsuccessful lock acquisition blocks schedule save without mutating Packages while renewal holds lock', () => {
      const sid = 'STU-LOCK-TEST-6';
      StudentRepository.Students_insert(spreadsheet, {
        student_id: sid, student_name: 'Lock Test Student 6', status: 'ACTIVE'
      });
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Lock Test Student 6', plan_type: 'Per Class',
        currency: 'INR', package_price: 10000, per_class: 1000, classes_purchased: 10,
        start_date: '2026-11-01', class_duration: 60, class_schedule: 'Mon - 10:00 AM'
      });

      // Stateful LockService modeling shared Google ScriptLock contention across executions:
      // While Execution 1 holds the script lock, tryLock() returns false for Execution 2.
      let isScriptLocked = false;
      const origLS = (globalThis as any).LockService;
      (globalThis as any).LockService = {
        getScriptLock: () => ({
          tryLock: () => {
            if (isScriptLocked) return false;
            isScriptLocked = true;
            return true;
          },
          releaseLock: () => {
            isScriptLocked = false;
          }
        })
      };

      try {
        LockManager._resetLockState();
        ClassScheduleService._setLockManager(LockManager);
        RenewalService._setLockManager(LockManager);

        let worker2Result: any = null;

        // Worker 1 enters critical section (e.g. holding script lock during renewal)
        const outerRes = LockManager.withLock(10000, () => {
          expect(isScriptLocked).toBe(true);

          // Worker 2 runs in a separate execution context (where its own execution-local lockDepth is 0)
          // It attempts to acquire the shared ScriptLock via Schedules_save
          const worker2LockManager = {
            withLock: (timeout: number, fn: Function) => {
              // Independent execution context: lockDepth is 0, so it calls LockService.getScriptLock().tryLock()
              const ls = (globalThis as any).LockService.getScriptLock();
              const acquired = ls.tryLock(timeout);
              if (!acquired) {
                return { success: false, code: 'CONFLICT', message: 'Could not acquire script lock within timeout; try again' };
              }
              try {
                return { success: true, result: fn() };
              } finally {
                ls.releaseLock();
              }
            }
          };

          ClassScheduleService._setLockManager(worker2LockManager);
          worker2Result = ClassScheduleService.Schedules_save(spreadsheet, sid, [
            { day_of_week: 'SUNDAY', start_time: '08:00', end_time: '09:00' }
          ], adminActor);

          // Worker 2 must fail with CONFLICT because Execution 1 holds the shared ScriptLock
          expect(worker2Result.success).toBe(false);
          expect(worker2Result.code).toBe('CONFLICT');

          // Worker 1 continues its renewal (nested reentrancy in Worker 1's execution context succeeds)
          ClassScheduleService._setLockManager(LockManager);
          return RenewalService.Packages_renew(spreadsheet, {
            student_id: sid,
            new_classes_purchased: 12,
            currency: 'INR',
            package_price: 12000,
            start_date: '2026-12-01',
            schedules: [
              { day_of_week: 'WEDNESDAY', start_time: '18:00', end_time: '19:00' }
            ],
            idempotency_key: 'idemp_interleaving_test_6'
          }, adminActor);
        });

        expect(outerRes.success).toBe(true);
        expect(worker2Result.success).toBe(false);
        expect(worker2Result.code).toBe('CONFLICT');
        expect(isScriptLocked).toBe(false);
        expect(LockManager._getLockDepth()).toBe(0);

        // Verify Packages sheet contains Worker 1's renewal and NOT Worker 2's rejected Sunday schedule
        const pkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
        expect(pkgs.length).toBe(2);
        expect(pkgs[0].classes_purchased).toBe(12);
        expect(pkgs[0].class_schedule).toContain('Wed');
        expect(pkgs[0].class_schedule).not.toContain('Sun');
      } finally {
        (globalThis as any).LockService = origLS;
        LockManager._resetLockState();
      }
    });

    it('7. Lock failure semantics: Disentangling write failure from lock-release failure without false rollback claims', () => {
      const sid = 'STU-LOCK-TEST-7';
      StudentRepository.Students_insert(spreadsheet, {
        student_id: sid, student_name: 'Lock Test Student 7', status: 'ACTIVE'
      });
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Lock Test Student 7', plan_type: 'Per Class',
        currency: 'INR', package_price: 10000, per_class: 1000, classes_purchased: 10,
        start_date: '2026-11-01', class_duration: 60, class_schedule: 'Wed - 14:00'
      });

      // Part A: Lock Acquisition Failure -> Zero mutation occurs.
      const acqFailLock = {
        withLock: () => ({ success: false, code: 'CONFLICT', message: 'Lock acquisition timed out' })
      };
      ClassScheduleService._setLockManager(acqFailLock);
      const acqRes = ClassScheduleService.Schedules_save(spreadsheet, sid, [
        { day_of_week: 'FRIDAY', start_time: '10:00', end_time: '11:00' }
      ], adminActor);

      expect(acqRes.success).toBe(false);
      expect(acqRes.code).toBe('CONFLICT');
      // Sheet must be completely unchanged
      const pkgsAfterAcqFail = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(pkgsAfterAcqFail[0].class_schedule).toBe('Wed - 14:00');

      // Part B: Lock Release Failure after successful sheet mutation.
      // Execution order:
      // 1. Schedules_save executes callback actionFn().
      // 2. actionFn() mutates Packages.class_schedule in the sheet.
      // 3. withLock enters finally block and invokes lockToRelease.releaseLock().
      // 4. releaseLock() throws an exception.
      // 5. withLock catches release error, cleans up _heldScriptLock = null, decrements depth to 0,
      //    and returns { success: false, code: 'LOCK_RELEASE_ERROR' }.
      // Contract: Schedules_save accurately reports LOCK_RELEASE_ERROR (no false success),
      // BUT the physical sheet row WAS written prior to release and was NOT rolled back.
      const origLS = (globalThis as any).LockService;
      let mockReleaseCalled = false;
      (globalThis as any).LockService = {
        getScriptLock: () => ({
          tryLock: () => true,
          releaseLock: () => {
            mockReleaseCalled = true;
            throw new Error('Google Apps Script LockService.releaseLock timeout exception');
          }
        })
      };

      try {
        LockManager._resetLockState();
        ClassScheduleService._setLockManager(LockManager);

        const relRes = ClassScheduleService.Schedules_save(spreadsheet, sid, [
          { day_of_week: 'FRIDAY', start_time: '10:00', end_time: '11:00' }
        ], adminActor);

        expect(mockReleaseCalled).toBe(true);
        // Schedules_save must report LOCK_RELEASE_ERROR rather than false success
        expect(relRes.success).toBe(false);
        expect(relRes.code).toBe('LOCK_RELEASE_ERROR');
        expect(relRes.message).toContain('LockService.releaseLock timeout exception');

        // Verify the real contract: Write DID commit to the sheet before release failed (no phantom rollback)
        const pkgsAfterRelFail = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
        expect(pkgsAfterRelFail[0].class_schedule).toContain('Fri');

        // Verify LockManager cleaned up internal depth and did not leave stale held lock
        expect(LockManager._getLockDepth()).toBe(0);
      } finally {
        (globalThis as any).LockService = origLS;
        LockManager._resetLockState();
      }
    });

    it('8. All other Packages.class_schedule write paths are protected', () => {
      const sid = 'STU-LOCK-TEST-8';
      StudentRepository.Students_insert(spreadsheet, {
        student_id: sid, student_name: 'Lock Test Student 8', status: 'ACTIVE'
      });
      PackageRepository.Packages_insert(spreadsheet, {
        student_id: sid, student_name: 'Lock Test Student 8', plan_type: 'Per Class',
        currency: 'INR', package_price: 10000, per_class: 1000, classes_purchased: 10,
        start_date: '2026-11-01', class_duration: 60, class_schedule: 'Original Sched 8'
      });

      // Verify PackageService.Packages_update acquires lock and fails closed if lock unavailable
      const failingLock = {
        withLock: () => {
          return { success: false, code: 'CONFLICT', message: 'Could not acquire script lock' };
        }
      };
      PackageService._setLockManager(failingLock);

      const updRes = PackageService.Packages_update(spreadsheet, sid, {
        class_schedule: 'Updated Sched 8'
      }, adminActor);

      expect(updRes.success).toBe(false);
      expect(updRes.code).toBe('CONFLICT');

      // Verify Packages sheet was not updated
      const pkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid);
      expect(pkgs[0].class_schedule).toBe('Original Sched 8');
    });
  });
});
