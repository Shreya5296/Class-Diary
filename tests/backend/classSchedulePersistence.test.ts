import { describe, it, expect, beforeEach } from 'vitest';
import { MockSpreadsheet } from '../mocks/MockSpreadsheet';

// @ts-ignore
const { Schedules_list, Schedules_save, validateScheduleEntry } = require('../../02-backend/apps-script/classes/ClassScheduleService.gs');

describe('ClassScheduleService Backend Operations', () => {
  let spreadsheet: MockSpreadsheet;

  beforeEach(() => {
    spreadsheet = new MockSpreadsheet();
    // Add canonical Packages sheet with 12 columns
    const pkgSheet = spreadsheet.insertSheet('Packages');
    pkgSheet.appendRow([
      'student_id', 'student_name', 'plan_type', 'currency',
      'package_price', 'per_class', 'classes_purchased',
      'start_date', 'end_date', 'next_due_date', 'class_duration', 'class_schedule'
    ]);
  });

  it('validates schedule entries strictly', () => {
    expect(validateScheduleEntry({ day_of_week: 'MONDAY', start_time: '16:00', end_time: '16:40' }).valid).toBe(true);
    expect(validateScheduleEntry({ day_of_week: 'INVALID', start_time: '16:00', end_time: '16:40' }).valid).toBe(false);
    expect(validateScheduleEntry({ day_of_week: 'MONDAY', start_time: '25:00', end_time: '16:40' }).valid).toBe(false);
    expect(validateScheduleEntry({ day_of_week: 'MONDAY', start_time: '17:00', end_time: '16:00' }).valid).toBe(false); // end <= start
  });

  it('formats and parses recurring schedule entries losslessly', () => {
    const pkgSheet = spreadsheet.getSheetByName('Packages')!;
    pkgSheet.appendRow([
      'STU_001', 'Test Student', 'Package', 'INR',
      12000, 1000, 12, '2026-02-01', '2026-04-01', '2026-03-01', 40, ''
    ]);

    const entries = [
      { day_of_week: 'MONDAY', start_time: '16:00', end_time: '16:40' },
      { day_of_week: 'WEDNESDAY', start_time: '17:00', end_time: '17:40' }
    ];
    const saveRes = Schedules_save(spreadsheet, 'STU_001', entries);
    expect(saveRes.success).toBe(true);

    const listRes = Schedules_list(spreadsheet, 'STU_001');
    expect(listRes.success).toBe(true);
    expect(listRes.data.length).toBe(2);
    expect(listRes.data[0].day_of_week).toBe('MONDAY');
    expect(listRes.data[1].day_of_week).toBe('WEDNESDAY');
  });

  it('persists recurring class schedules to ClassSchedules sheet and avoids duplicates on resave', () => {
    // 1. Save schedules for STU_001
    const entries1 = [
      { day_of_week: 'MONDAY', start_time: '16:00', end_time: '16:40' },
      { day_of_week: 'WEDNESDAY', start_time: '17:00', end_time: '17:40' },
    ];
    const saveRes1 = Schedules_save(spreadsheet, 'STU_001', entries1);
    expect(saveRes1.success).toBe(true);
    expect(saveRes1.meta.persistentSheet).toBe(true);

    // Read back
    const listRes1 = Schedules_list(spreadsheet, 'STU_001');
    expect(listRes1.success).toBe(true);
    expect(listRes1.data.length).toBe(2);
    expect(listRes1.data[0].day_of_week).toBe('MONDAY');
    expect(listRes1.data[1].day_of_week).toBe('WEDNESDAY');

    // 2. Resave with changed schedule: replaces existing entries for STU_001 without duplicating
    const entries2 = [
      { day_of_week: 'FRIDAY', start_time: '18:00', end_time: '18:40' },
    ];
    const saveRes2 = Schedules_save(spreadsheet, 'STU_001', entries2);
    expect(saveRes2.success).toBe(true);

    const listRes2 = Schedules_list(spreadsheet, 'STU_001');
    expect(listRes2.data.length).toBe(1);
    expect(listRes2.data[0].day_of_week).toBe('FRIDAY');
    expect(listRes2.data[0].start_time).toBe('18:00');
  });

  it('supports multiple students with distinct recurring schedules', () => {
    Schedules_save(spreadsheet, 'STU_001', [{ day_of_week: 'MONDAY', start_time: '16:00', end_time: '16:40' }]);
    Schedules_save(spreadsheet, 'STU_002', [{ day_of_week: 'TUESDAY', start_time: '15:00', end_time: '15:30' }]);

    const stu1 = Schedules_list(spreadsheet, 'STU_001');
    const stu2 = Schedules_list(spreadsheet, 'STU_002');
    expect(stu1.data.length).toBe(1);
    expect(stu1.data[0].day_of_week).toBe('MONDAY');
    expect(stu2.data.length).toBe(1);
    expect(stu2.data[0].day_of_week).toBe('TUESDAY');

    // List all
    const all = Schedules_list(spreadsheet, null);
    expect(all.data.length).toBe(2);
  });
});
