import { describe, it, expect, beforeEach } from 'vitest';
import { MockSpreadsheet, MockSheet } from '../mocks/MockSpreadsheet';

// @ts-ignore
import SheetRegistry from '../../02-backend/apps-script/sheets/SheetRegistry.gs';
// @ts-ignore
import SpreadsheetBootstrap from '../../02-backend/apps-script/sheets/SpreadsheetBootstrap.gs';
// @ts-ignore
import ClassRepository from '../../02-backend/apps-script/classes/ClassRepository.gs';
// @ts-ignore
import { SheetCache_getRows, SheetCache_clear } from '../../02-backend/apps-script/sheets/SheetCache.gs';

describe('SheetCache Date Preservation across Cache Round-trips', () => {
  let spreadsheet: any;
  let mockCacheStore: Record<string, string>;

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
    const provider = require('../../02-backend/apps-script/sheets/SpreadsheetProvider.gs');
    provider.setMockSpreadsheet(spreadsheet);
  });

  it('1. Date and Time cells survive CacheService round-trip as real Date instances with identical getTime()', () => {
    const dateCell = new Date(2026, 10, 30, 0, 0, 0);
    const timeCell = new Date(1899, 11, 30, 18, 30);
    const sheet = new MockSheet('TestDatePreservation', [
      ['id', 'schedule_date', 'schedule_time'],
      ['row_1', dateCell, timeCell],
    ]);

    // Cold cache: initial read
    const rows1 = SheetCache_getRows(sheet);
    expect(rows1[1][1] instanceof Date).toBe(true);
    expect(rows1[1][2] instanceof Date).toBe(true);
    expect(rows1[1][1].getTime()).toBe(dateCell.getTime());
    expect(rows1[1][2].getTime()).toBe(timeCell.getTime());
    expect(mockCacheStore['sheet_data_TestDatePreservation']).toBeDefined();

    // Warm cache: delete execution-local cache so it hits CacheService
    delete (sheet as any)._cachedRows;
    const rows2 = SheetCache_getRows(sheet);
    expect(rows2[1][1] instanceof Date).toBe(true);
    expect(rows2[1][2] instanceof Date).toBe(true);
    expect(rows2[1][1].getTime()).toBe(dateCell.getTime());
    expect(rows2[1][2].getTime()).toBe(timeCell.getTime());
  });

  it('2. End-to-end through rowToRecord + Classes_getAll produces identical clean date & time on cold and warm cache', () => {
    const dateCell = new Date(2026, 10, 30, 0, 0, 0);
    const timeCell = new Date(1899, 11, 30, 18, 30);
    const csSheet = spreadsheet.getSheetByName('ClassSessions');
    SheetCache_clear(csSheet);

    csSheet.rows.push([
      'STU_TEST_CACHE_E2E',
      'Cache Test Student',
      dateCell,
      timeCell,
      'NOT_MARKED',
      'SCHEDULED',
      '',
      false,
    ]);

    // Cold cache read
    const coldSessions = ClassRepository.Classes_getAll(spreadsheet);
    const coldMatch = coldSessions.find((s: any) => s.student_id === 'STU_TEST_CACHE_E2E');
    expect(coldMatch).toBeDefined();
    expect(coldMatch.schedule_date).toBe('2026-11-30');
    expect(coldMatch.schedule_time).toBe('18:30');
    expect(coldMatch.session_id).toBe('STU_TEST_CACHE_E2E__2026-11-30__18:30');

    // Warm cache read: clear execution-local memory so read is served from CacheService
    delete (csSheet as any)._cachedRows;
    const warmSessions = ClassRepository.Classes_getAll(spreadsheet);
    const warmMatch = warmSessions.find((s: any) => s.student_id === 'STU_TEST_CACHE_E2E');
    expect(warmMatch).toBeDefined();
    expect(warmMatch.schedule_date).toBe('2026-11-30');
    expect(warmMatch.schedule_time).toBe('18:30');
    expect(warmMatch.session_id).toBe('STU_TEST_CACHE_E2E__2026-11-30__18:30');
  });

  it('3. Text cells containing ISO datetimes remain strings and are not revived into Dates', () => {
    const isoString = '2026-11-30T18:30:00+05:30';
    const sheet = new MockSheet('TestTextPreservation', [
      ['id', 'scheduled_start'],
      ['row_iso', isoString],
    ]);

    // Cold cache
    SheetCache_getRows(sheet);
    expect(mockCacheStore['sheet_data_TestTextPreservation']).toBeDefined();

    // Warm cache
    delete (sheet as any)._cachedRows;
    const warmRows = SheetCache_getRows(sheet);
    expect(typeof warmRows[1][1]).toBe('string');
    expect(warmRows[1][1]).toBe(isoString);
    expect(warmRows[1][1] instanceof Date).toBe(false);
  });

  it('4. Duplicate guard regression: inserting identical session after warm cache re-read keeps exactly one', () => {
    const session = {
      student_id: 'STU_DUP_CACHE',
      student_name: 'Dup Cache Student',
      schedule_date: '2026-11-30',
      schedule_time: '18:30',
      attendance_status: 'NOT_MARKED',
      session_status: 'SCHEDULED',
      cancellation_reason: '',
      deduct_class: false,
    };

    // First insert
    const res1 = ClassRepository.Classes_insert(spreadsheet, session);
    expect(res1).toBeDefined();

    // Warm cache condition: clear execution-local cache so lookup must read from CacheService
    const csSheet = spreadsheet.getSheetByName('ClassSessions');
    delete (csSheet as any)._cachedRows;

    // Second insert of the exact same student + date + time
    const res2 = ClassRepository.Classes_insert(spreadsheet, session);
    expect(res2).toBeDefined();

    const all = ClassRepository.Classes_getAll(spreadsheet);
    const matching = all.filter(
      (s: any) => s.student_id === 'STU_DUP_CACHE' && s.schedule_date === '2026-11-30' && s.schedule_time === '18:30'
    );
    expect(matching.length).toBe(1);
  });
});
