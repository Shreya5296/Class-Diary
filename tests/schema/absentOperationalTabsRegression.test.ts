import { describe, it, expect, beforeEach } from 'vitest';
import { MockSpreadsheet } from '../mocks/MockSpreadsheet';

// @ts-ignore
import SheetRegistry from '../../02-backend/apps-script/sheets/SheetRegistry.gs';
// @ts-ignore
import SpreadsheetBootstrap from '../../02-backend/apps-script/sheets/SpreadsheetBootstrap.gs';
// @ts-ignore
import SchemaValidator from '../../02-backend/apps-script/sheets/SchemaValidator.gs';
// @ts-ignore
import ConfigService from '../../02-backend/apps-script/config/ConfigService.gs';
// @ts-ignore
import StudentService from '../../02-backend/apps-script/students/StudentService.gs';
// @ts-ignore
import PackageService from '../../02-backend/apps-script/packages/PackageService.gs';
// @ts-ignore
import PaymentService from '../../02-backend/apps-script/payments/PaymentService.gs';
// @ts-ignore
import ClassService from '../../02-backend/apps-script/classes/ClassService.gs';
// @ts-ignore
import ReportService from '../../02-backend/apps-script/reports/ReportService.gs';

describe('Absent Operational Tabs Regression (AppConfig, ImportBatches, ImportRowResults removed)', () => {
  let spreadsheet: MockSpreadsheet;
  const actor = { actorId: 'usr_admin', email: 'admin@example.com', requestId: 'req_absent_tabs' };

  function setupTarget4TabSpreadsheet(): MockSpreadsheet {
    const ss = new MockSpreadsheet();
    // 4 canonical business tables
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
    return ss;
  }

  beforeEach(() => {
    spreadsheet = setupTarget4TabSpreadsheet();
  });

  it('confirms AppConfig, ImportBatches, ImportRowResults, AuditLog, MeetingLinks, and StudentNotes tabs are absent and not recreated by bootstrap', () => {
    expect(spreadsheet.getSheetByName('AppConfig')).toBeNull();
    expect(spreadsheet.getSheetByName('ImportBatches')).toBeNull();
    expect(spreadsheet.getSheetByName('ImportRowResults')).toBeNull();
    expect(spreadsheet.getSheetByName('AuditLog')).toBeNull();
    expect(spreadsheet.getSheetByName('MeetingLinks')).toBeNull();
    expect(spreadsheet.getSheetByName('StudentNotes')).toBeNull();

    // Run bootstrap on existing spreadsheet
    const bootstrapRes = SpreadsheetBootstrap.bootstrapSpreadsheet(spreadsheet, SheetRegistry, '2.0.0');
    expect(bootstrapRes.success).toBe(true);

    // Verify obsolete tabs were not silently recreated
    expect(spreadsheet.getSheetByName('AppConfig')).toBeNull();
    expect(spreadsheet.getSheetByName('ImportBatches')).toBeNull();
    expect(spreadsheet.getSheetByName('ImportRowResults')).toBeNull();
    expect(spreadsheet.getSheetByName('MeetingLinks')).toBeNull();
    expect(spreadsheet.getSheetByName('StudentNotes')).toBeNull();
  });

  it('provides safe in-code defaults via ConfigService without AppConfig sheet', () => {
    expect(ConfigService.Config_get('SCHEMA_VERSION')).toBe('2.0.0');
    expect(ConfigService.Config_get('APP_NAME')).toBe('Student Manager');
    expect(ConfigService.Config_get('DEFAULT_CURRENCY')).toBe('INR');
    expect(ConfigService.Config_get('DEFAULT_TIMEZONE')).toBe('Asia/Kolkata');
    expect(ConfigService.Config_get('DEFAULT_CLASS_DURATION_MINUTES')).toBe('60');

    const allConfig = ConfigService.Config_getAll();
    expect(allConfig.SCHEMA_VERSION).toBe('2.0.0');
    expect(allConfig.DEFAULT_CURRENCY).toBe('INR');
  });

  it('executes full student lifecycle, package management, and payments when obsolete tabs are absent', () => {
    // 1. Create student
    const stuRes = StudentService.Students_create(spreadsheet, {
      first_name: 'Ananya',
      parent_guardian_name: 'Dev',
      primary_phone: '+919876599999'
    }, actor);
    expect(stuRes.success).toBe(true);
    const stuId = stuRes.data.student_id;

    // 2. Create package
    const pkgRes = PackageService.Packages_create(spreadsheet, {
      student_id: stuId,
      package_name: 'Math Prep Pack',
      package_price: 25000,
      classes_purchased: 10
    }, actor);
    expect(pkgRes.success).toBe(true);

    // 3. Record payment with idempotency (checked against durable store)
    const payRes = PaymentService.Payments_record(spreadsheet, {
      student_id: stuId,
      amount: 25000,
      currency: 'INR',
      idempotency_key: 'idem_absent_tab_1'
    }, actor);
    expect(payRes.success).toBe(true);

    // 4. Financial report calculation succeeds
    const summary = ReportService.Reports_getFinancialSummary(spreadsheet);
    expect(summary.success).toBe(true);
    expect(summary.data.totalInvoiced).toBe(25000);
    expect(summary.data.totalCollected).toBe(25000);
    expect(summary.data.totalOutstanding).toBe(0);

    // 5. Dashboard overview succeeds
    const overview = ReportService.Reports_getDashboardOverview(spreadsheet);
    expect(overview.success).toBe(true);
    expect(overview.data.activeStudentsCount).toBe(1);
    expect(overview.data.outstandingFeesTotal).toBe(0);
  });

  it('runs classes and student meeting link updates without errors in 4-table datastore', () => {
    const stu = StudentService.Students_create(spreadsheet, {
      student_name: 'Rohan Sharma',
      parent_name: 'Sunita Sharma',
      parent_phone: '+919876588888',
      primary_meeting_link: 'https://meet.google.com/test-abc-xyz'
    }, actor).data;

    // Schedule class with session_notes
    const clsRes = ClassService.Classes_schedule(spreadsheet, {
      student_id: stu.student_id,
      scheduled_start: '2026-11-01T10:00:00Z',
      scheduled_end: '2026-11-01T11:00:00Z',
      session_notes: 'Student demonstrates solid algebraic foundations'
    }, actor);
    expect(clsRes.success).toBe(true);
    expect(clsRes.data.session_notes).toBe('Student demonstrates solid algebraic foundations');

    // Update primary meeting link
    const updateRes = StudentService.Students_update(spreadsheet, stu.student_id, {
      primary_meeting_link: 'https://zoom.us/j/123456789'
    }, actor);
    expect(updateRes.success).toBe(true);
    expect(updateRes.data.primary_meeting_link).toBe('https://zoom.us/j/123456789');

    // Obsolete sheets remain absent
    expect(spreadsheet.getSheetByName('MeetingLinks')).toBeNull();
    expect(spreadsheet.getSheetByName('StudentNotes')).toBeNull();
  });

  it('initializes canonical datastore cleanly without requiring AppConfig, ImportBatches, or ImportRowResults', () => {
    const res = SpreadsheetBootstrap.bootstrapSpreadsheet(spreadsheet, SheetRegistry);
    expect(res.success).toBe(true);

    // AuditLog is absent
    expect(spreadsheet.getSheetByName('AuditLog')).toBeNull();
    // Absent tabs still absent
    expect(spreadsheet.getSheetByName('AppConfig')).toBeNull();
    expect(spreadsheet.getSheetByName('ImportBatches')).toBeNull();
    expect(spreadsheet.getSheetByName('ImportRowResults')).toBeNull();
  });
});
