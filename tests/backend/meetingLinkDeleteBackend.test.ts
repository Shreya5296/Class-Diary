import { describe, it, expect, beforeEach } from 'vitest';
import { MockSpreadsheet } from '../mocks/MockSpreadsheet';

// @ts-ignore
import SheetRegistry from '../../02-backend/apps-script/sheets/SheetRegistry.gs';
// @ts-ignore
import SpreadsheetBootstrap from '../../02-backend/apps-script/sheets/SpreadsheetBootstrap.gs';

// Load backend modules via CommonJS
// @ts-ignore
const { Students_update, Students_getById, Students_create } = require('../../02-backend/apps-script/students/StudentService.gs');
// @ts-ignore
const { registerStudentOperations } = require('../../02-backend/apps-script/students/StudentHandlers.gs');

describe('Backend Meeting Link Operations on Canonical Students Table', () => {
  let spreadsheet: MockSpreadsheet;
  const registry: Record<string, Function> = {};
  const mockRouter = {
    registerOperation: (name: string, fn: Function) => {
      registry[name] = fn;
    },
  };
  const adminActor = { actorId: 'usr_admin', email: 'admin@example.com', isAdmin: true };

  beforeEach(() => {
    spreadsheet = new MockSpreadsheet();
    SpreadsheetBootstrap.bootstrapSpreadsheet(spreadsheet, SheetRegistry, '1.0.0');
    registerStudentOperations(mockRouter);

    // Pre-populate with two student records with primary_meeting_link
    Students_create(spreadsheet, {
      student_id: 'STU_001',
      student_name: 'Aarav Patel',
      parent_name: 'Vikram Patel',
      parent_phone: '+91 98765 43210',
      parent_email: 'vikram@example.com',
      student_phone: '',
      student_email: '',
      subject: 'Coding',
      status: 'ACTIVE',
      primary_meeting_link: 'https://meet.google.com/link1',
    }, adminActor);

    Students_create(spreadsheet, {
      student_id: 'STU_002',
      student_name: 'Diya Sharma',
      parent_name: 'Anita Sharma',
      parent_phone: '+91 98765 43211',
      parent_email: 'anita@example.com',
      student_phone: '',
      student_email: '',
      subject: 'Math',
      status: 'ACTIVE',
      primary_meeting_link: 'https://meet.google.com/only_link',
    }, adminActor);
  });

  it('clears primary_meeting_link for a student while preserving student identity and other fields', () => {
    const res = Students_update(spreadsheet, 'STU_001', {
      primary_meeting_link: '',
    }, adminActor);

    expect(res.success).toBe(true);
    expect(res.data.primary_meeting_link).toBe('');
    expect(res.data.student_id).toBe('STU_001');
    expect(res.data.student_name).toBe('Aarav Patel');
    expect(res.data.parent_email).toBe('vikram@example.com');

    // Fetch directly from DB
    const student = Students_getById(spreadsheet, 'STU_001');
    expect(student.primary_meeting_link).toBe('');
    expect(student.student_name).toBe('Aarav Patel');

    // Other student untouched
    const stu2 = Students_getById(spreadsheet, 'STU_002');
    expect(stu2.primary_meeting_link).toBe('https://meet.google.com/only_link');
  });

  it('updates primary_meeting_link to a new URL safely', () => {
    const res = Students_update(spreadsheet, 'STU_001', {
      primary_meeting_link: 'https://zoom.us/j/999999999',
    }, adminActor);

    expect(res.success).toBe(true);
    expect(res.data.primary_meeting_link).toBe('https://zoom.us/j/999999999');

    const student = Students_getById(spreadsheet, 'STU_001');
    expect(student.primary_meeting_link).toBe('https://zoom.us/j/999999999');
  });

  it('rejects invalid meeting link format with VALIDATION_ERROR', () => {
    const res = Students_update(spreadsheet, 'STU_001', {
      primary_meeting_link: 'invalid-url-string',
    }, adminActor);

    expect(res.success).toBe(false);
    expect(res.code).toBe('VALIDATION_ERROR');
  });

  it('rejects update for nonexistent student safely', () => {
    const res = Students_update(spreadsheet, 'STU_NONEXISTENT', {
      primary_meeting_link: 'https://meet.google.com/test',
    }, adminActor);

    expect(res.success).toBe(false);
    expect(res.code).toBe('RECORD_NOT_FOUND');
  });

  it('executes through registered router operation students.update', () => {
    const res = registry['students.update']({
      spreadsheet,
      payload: { student_id: 'STU_001', primary_meeting_link: '' },
      actorId: 'usr_admin',
    });

    expect(res.success).toBe(true);
    expect(res.data.primary_meeting_link).toBe('');

    const student = Students_getById(spreadsheet, 'STU_001');
    expect(student.primary_meeting_link).toBe('');
  });
});
