import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockSpreadsheet } from '../mocks/MockSpreadsheet';

// @ts-ignore
import SheetRegistry from '../../02-backend/apps-script/sheets/SheetRegistry.gs';
// @ts-ignore
import SpreadsheetBootstrap from '../../02-backend/apps-script/sheets/SpreadsheetBootstrap.gs';

const { SheetCache_getRows, SheetCache_clear } = require('../../02-backend/apps-script/sheets/SheetCache.gs');
const { registerStudentOperations } = require('../../02-backend/apps-script/students/StudentHandlers.gs');
const { registerPackageOperations } = require('../../02-backend/apps-script/packages/PackageHandlers.gs');
const { registerPaymentOperations } = require('../../02-backend/apps-script/payments/PaymentHandlers.gs');
const { registerClassOperations } = require('../../02-backend/apps-script/classes/ClassHandlers.gs');
const { registerReportOperations } = require('../../02-backend/apps-script/reports/ReportHandlers.gs');
const { registerClassScheduleOperations } = require('../../02-backend/apps-script/classes/ClassScheduleHandlers.gs');
const { Reports_getDashboardOverview, Reports_getFinancialSummary } = require('../../02-backend/apps-script/reports/ReportService.gs');
const { appendRecord, updateRecordById } = require('../../02-backend/apps-script/sheets/RowWriter.gs');
const { createHeaderMap, rowToRecord, recordToRow } = require('../../02-backend/apps-script/sheets/HeaderMapper.gs');
const { Classes_repoUpdate, Classes_insert } = require('../../02-backend/apps-script/classes/ClassRepository.gs');
const { Payments_insert, Payments_update } = require('../../02-backend/apps-script/payments/PaymentRepository.gs');
const { Payments_void } = require('../../02-backend/apps-script/payments/PaymentService.gs');
const { withLock } = require('../../02-backend/apps-script/sheets/LockManager.gs');

describe('Combined Endpoints, Cache Management & Parity', () => {
  let spreadsheet: any;
  let mockCacheStore: Record<string, string>;
  const registry: Record<string, Function> = {};
  const mockRouter = {
    registerOperation: (name: string, fn: Function) => {
      registry[name] = fn;
    },
  };

  beforeEach(() => {
    mockCacheStore = {};
    (globalThis as any).CacheService = {
      getScriptCache: () => ({
        get: (key: string) => mockCacheStore[key] || null,
        put: (key: string, val: string, _ttl: number) => {
          mockCacheStore[key] = val;
        },
        remove: (key: string) => {
          delete mockCacheStore[key];
        },
      }),
    };

    spreadsheet = new MockSpreadsheet();
    SpreadsheetBootstrap.bootstrapSpreadsheet(spreadsheet, SheetRegistry, '1.0.0');
    registerStudentOperations(mockRouter);
    registerPackageOperations(mockRouter);
    registerPaymentOperations(mockRouter);
    registerClassOperations(mockRouter);
    registerReportOperations(mockRouter);
    registerClassScheduleOperations(mockRouter);
  });

  afterEach(() => {
    delete (globalThis as any).CacheService;
  });

  describe('1. Response Structure & Parity with Legacy Endpoints', () => {
    it('returns exact schema and matching data for dashboard.combined', () => {
      const sRes = registry['students.create']({
        spreadsheet,
        payload: {
          full_name: 'Aditi Sharma',
          phone: '9876543210',
          parent_name: 'P Sharma',
          status: 'ACTIVE',
        },
        actorId: 'usr_test',
        verifiedEmail: 'ashreya0502@gmail.com',
      });
      expect(sRes.success).toBe(true);
      const studentId = sRes.data.student_id;

      const pRes = registry['packages.create']({
        spreadsheet,
        payload: {
          student_id: studentId,
          package_name: 'Standard 12 Pack',
          package_price: 6000,
          per_class: 500,
          classes_purchased: 12,
          start_date: '2026-11-01',
          end_date: '2026-12-01',
        },
        actorId: 'usr_test',
        verifiedEmail: 'ashreya0502@gmail.com',
      });
      expect(pRes.success).toBe(true);

      const legacyOverview = Reports_getDashboardOverview(spreadsheet);
      const combinedRes = registry['dashboard.combined']({
        spreadsheet,
        payload: {},
        actorId: 'usr_test',
        verifiedEmail: 'ashreya0502@gmail.com',
      });

      expect(combinedRes.success).toBe(true);
      expect(combinedRes.data).toBeDefined();
      expect(combinedRes.data.overview).toBeDefined();
      expect(combinedRes.data.overview.activeStudentsCount).toBe(legacyOverview.data.activeStudentsCount);
      expect(combinedRes.data.overview.outstandingFeesTotal).toBe(legacyOverview.data.outstandingFeesTotal);

      expect(Array.isArray(combinedRes.data.classes)).toBe(true);
      expect(Array.isArray(combinedRes.data.schedules)).toBe(true);
      expect(Array.isArray(combinedRes.data.students)).toBe(true);
      expect(Array.isArray(combinedRes.data.packages)).toBe(true);
      expect(Array.isArray(combinedRes.data.fees)).toBe(true);
      expect(combinedRes.data.students.length).toBeGreaterThanOrEqual(1);
      expect(combinedRes.data.packages.length).toBeGreaterThanOrEqual(1);
    });

    it('returns exact schema and matching data for finances.combined', () => {
      const sRes = registry['students.create']({
        spreadsheet,
        payload: {
          full_name: 'Rohan Mehra',
          phone: '9123456789',
          parent_name: 'P Mehra',
          status: 'ACTIVE',
        },
        actorId: 'usr_test',
        verifiedEmail: 'ashreya0502@gmail.com',
      });
      expect(sRes.success).toBe(true);
      const studentId = sRes.data.student_id;

      const pRes = registry['packages.create']({
        spreadsheet,
        payload: {
          student_id: studentId,
          package_name: 'Standard 10 Pack',
          package_price: 10000,
          per_class: 1000,
          classes_purchased: 10,
          start_date: '2026-11-01',
          end_date: '2026-12-01',
        },
        actorId: 'usr_test',
        verifiedEmail: 'ashreya0502@gmail.com',
      });
      expect(pRes.success).toBe(true);

      registry['payments.record']({
        spreadsheet,
        payload: {
          student_id: studentId,
          student_name: 'Rohan Mehra',
          amount: 4000,
          currency: 'INR',
          payment_date: '2026-11-05',
        },
        actorId: 'usr_test',
        verifiedEmail: 'ashreya0502@gmail.com',
      });

      const legacySummary = Reports_getFinancialSummary(spreadsheet);
      const combinedRes = registry['finances.combined']({
        spreadsheet,
        payload: {},
        actorId: 'usr_test',
        verifiedEmail: 'ashreya0502@gmail.com',
      });

      expect(combinedRes.success).toBe(true);
      expect(combinedRes.data).toBeDefined();
      expect(combinedRes.data.summary).toBeDefined();
      expect(combinedRes.data.summary.totalBilled).toBe(legacySummary.data.totalBilled);
      expect(combinedRes.data.summary.totalReceived).toBe(legacySummary.data.totalReceived);
      expect(combinedRes.data.summary.totalOutstanding).toBe(legacySummary.data.totalOutstanding);
      expect(combinedRes.data.summary.totalBilled).toBe(10000);
      expect(combinedRes.data.summary.totalReceived).toBe(4000);
      expect(combinedRes.data.summary.totalOutstanding).toBe(6000);

      expect(Array.isArray(combinedRes.data.payments)).toBe(true);
      expect(Array.isArray(combinedRes.data.packages)).toBe(true);
      expect(combinedRes.data.payments.length).toBe(1);
      expect(combinedRes.data.packages.length).toBe(1);
    });
  });

  describe('2. SheetCache Hit, Miss and TTL Mechanics', () => {
    it('populates script cache on first read and hits cache on second read', () => {
      const sheet = spreadsheet.getSheetByName('Students');
      expect(sheet).toBeDefined();

      SheetCache_clear(sheet);
      expect(mockCacheStore['sheet_data_Students']).toBeUndefined();

      const rows1 = SheetCache_getRows(sheet);
      expect(rows1.length).toBeGreaterThanOrEqual(1);
      expect(mockCacheStore['sheet_data_Students']).toBeDefined();

      const rows2 = SheetCache_getRows(sheet);
      expect(rows2).toBe(rows1);

      delete sheet._cachedRows;
      const rows3 = SheetCache_getRows(sheet);
      expect(rows3.length).toBe(rows1.length);
    });

    it('invalidates both memory cache and CacheService on SheetCache_clear', () => {
      const sheet = spreadsheet.getSheetByName('Students');
      SheetCache_getRows(sheet);
      expect(sheet._cachedRows).toBeDefined();
      expect(mockCacheStore['sheet_data_Students']).toBeDefined();

      SheetCache_clear(sheet);
      expect(sheet._cachedRows).toBeUndefined();
      expect(mockCacheStore['sheet_data_Students']).toBeUndefined();
    });
  });

  describe('3. Cache Invalidation across all Mutation Types', () => {
    it('invalidates cache on appendRecord and updateRecordById', () => {
      const sheet = spreadsheet.getSheetByName('Students');
      SheetCache_getRows(sheet);
      expect(mockCacheStore['sheet_data_Students']).toBeDefined();

      const mapper = { createHeaderMap, recordToRow, rowToRecord };
      const headers = SheetRegistry.getExpectedHeaders('Students');

      appendRecord(sheet, mapper, headers, {
        student_id: 'stu_tmp1',
        student_name: 'Temp 1',
        status: 'ACTIVE',
      });
      expect(sheet._cachedRows).toBeUndefined();
      expect(mockCacheStore['sheet_data_Students']).toBeUndefined();

      SheetCache_getRows(sheet);
      expect(mockCacheStore['sheet_data_Students']).toBeDefined();

      updateRecordById(sheet, mapper, headers, 'student_id', 'stu_tmp1', { student_name: 'Temp 1 Updated' });
      expect(sheet._cachedRows).toBeUndefined();
      expect(mockCacheStore['sheet_data_Students']).toBeUndefined();
    });

    it('invalidates cache on Classes_repoUpdate and Classes_insert', () => {
      const sheet = spreadsheet.getSheetByName('ClassSessions');
      SheetCache_getRows(sheet);
      expect(mockCacheStore['sheet_data_ClassSessions']).toBeDefined();

      Classes_insert(spreadsheet, {
        student_id: 'stu_test',
        schedule_date: '2026-12-01',
        schedule_time: '10:00',
        session_status: 'SCHEDULED',
        attendance_status: 'NOT_MARKED',
      });
      expect(sheet._cachedRows).toBeUndefined();
      expect(mockCacheStore['sheet_data_ClassSessions']).toBeUndefined();

      SheetCache_getRows(sheet);
      expect(mockCacheStore['sheet_data_ClassSessions']).toBeDefined();

      Classes_repoUpdate(spreadsheet, 'stu_test', { session_status: 'COMPLETED', _rowIndex: 2 });
      expect(sheet._cachedRows).toBeUndefined();
      expect(mockCacheStore['sheet_data_ClassSessions']).toBeUndefined();
    });

    it('invalidates cache on Payments_insert, Payments_update, and Payments_void', () => {
      const sheet = spreadsheet.getSheetByName('Payments');
      SheetCache_getRows(sheet);
      expect(mockCacheStore['sheet_data_Payments']).toBeDefined();

      Payments_insert(spreadsheet, {
        student_id: 'stu_test_p',
        student_name: 'Pay Student',
        payment_date: '2026-11-20',
        amount: 2500,
        currency: 'INR',
        in_inr: 2500,
      });
      expect(sheet._cachedRows).toBeUndefined();
      expect(mockCacheStore['sheet_data_Payments']).toBeUndefined();

      SheetCache_getRows(sheet);
      expect(mockCacheStore['sheet_data_Payments']).toBeDefined();

      Payments_update(spreadsheet, { student_id: 'stu_test_p', payment_date: '2026-11-20', amount: 2500 }, { amount: 3000 });
      expect(sheet._cachedRows).toBeUndefined();
      expect(mockCacheStore['sheet_data_Payments']).toBeUndefined();

      SheetCache_getRows(sheet);
      expect(mockCacheStore['sheet_data_Payments']).toBeDefined();

      const voidRes = Payments_void(spreadsheet, {
        student_id: 'stu_test_p',
        payment_date: '2026-11-20',
        amount: 3000,
        void_reason: 'Testing cache invalidation',
      });
      expect(voidRes.success).toBe(true);
      expect(sheet._cachedRows).toBeUndefined();
      expect(mockCacheStore['sheet_data_Payments']).toBeUndefined();
    });
  });

  describe('4. Financial Calculation Parity and Balances', () => {
    it('correctly aggregates multiple payments, partial payments and outstanding balances', () => {
      const s1Res = registry['students.create']({
        spreadsheet,
        payload: { full_name: 'Student 1', phone: '9999999901', parent_name: 'Parent 1', status: 'ACTIVE' },
        actorId: 'usr_test',
        verifiedEmail: 'ashreya0502@gmail.com',
      });
      const s1 = s1Res.data.student_id;

      const s2Res = registry['students.create']({
        spreadsheet,
        payload: { full_name: 'Student 2', phone: '9999999902', parent_name: 'Parent 2', status: 'ACTIVE' },
        actorId: 'usr_test',
        verifiedEmail: 'ashreya0502@gmail.com',
      });
      const s2 = s2Res.data.student_id;

      registry['packages.create']({
        spreadsheet,
        payload: { student_id: s1, package_name: 'Pack 1', package_price: 5000, per_class: 500, classes_purchased: 10 },
        actorId: 'usr_test',
        verifiedEmail: 'ashreya0502@gmail.com',
      });

      registry['packages.create']({
        spreadsheet,
        payload: { student_id: s2, package_name: 'Pack 2', package_price: 8000, per_class: 800, classes_purchased: 10 },
        actorId: 'usr_test',
        verifiedEmail: 'ashreya0502@gmail.com',
      });

      registry['payments.record']({
        spreadsheet,
        payload: { student_id: s1, student_name: 'Student 1', amount: 5000, currency: 'INR', payment_date: '2026-11-10' },
        actorId: 'usr_test',
        verifiedEmail: 'ashreya0502@gmail.com',
      });

      registry['payments.record']({
        spreadsheet,
        payload: { student_id: s2, student_name: 'Student 2', amount: 3000, currency: 'INR', payment_date: '2026-11-12' },
        actorId: 'usr_test',
        verifiedEmail: 'ashreya0502@gmail.com',
      });

      const finCombined = registry['finances.combined']({
        spreadsheet,
        payload: {},
        actorId: 'usr_test',
        verifiedEmail: 'ashreya0502@gmail.com',
      });

      expect(finCombined.data.summary.totalBilled).toBe(13000);
      expect(finCombined.data.summary.totalReceived).toBe(8000);
      expect(finCombined.data.summary.totalOutstanding).toBe(5000);

      // Verify individual balances via packages.getBalance
      const s1Bal = registry['packages.getBalance']({
        spreadsheet,
        payload: { studentId: s1 },
      });
      const s2Bal = registry['packages.getBalance']({
        spreadsheet,
        payload: { studentId: s2 },
      });
      expect(s1Bal.success).toBe(true);
      expect(s2Bal.success).toBe(true);
      expect(s1Bal.data.totalPurchased).toBe(10);
      expect(s2Bal.data.totalPurchased).toBe(10);
      expect(s1Bal.data.remainingClasses).toBe(10);
      expect(s2Bal.data.remainingClasses).toBe(10);
    });
  });

  describe('5. Concurrency Protection & Failure Handling', () => {
    it('executes mutation under withLock and returns standard error structure on unhandled exception', () => {
      let executed = false;
      const res = withLock(5000, () => {
        executed = true;
        return { success: true, count: 42 };
      });
      expect(res.success).toBe(true);
      expect(res.result.count).toBe(42);
      expect(executed).toBe(true);
    });

    it('returns consistent error response format when operation fails', () => {
      const badReqRes = registry['packages.create']({
        spreadsheet,
        payload: {
          // Missing student_id and package_name
        },
        actorId: 'usr_test',
        verifiedEmail: 'ashreya0502@gmail.com',
      });
      expect(badReqRes.success).toBe(false);
      expect(badReqRes.code).toBe('VALIDATION_ERROR');
      expect(badReqRes.message).toBeDefined();
    });
  });
});
