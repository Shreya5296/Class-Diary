import { describe, it, expect, beforeEach } from 'vitest';
const StudentService = require('../../02-backend/apps-script/students/StudentService.gs');

describe('Fix L8: Students_delete Backend Service', () => {
  let mockSheets: Record<string, any>;
  let mockSpreadsheet: any;

  beforeEach(() => {
    const createMockSheet = (name: string, headers: string[], initialRows: any[][]) => {
      let rows = [headers, ...initialRows];
      return {
        getName: () => name,
        getDataRange: () => ({
          getValues: () => rows.map((r) => [...r]),
        }),
        deleteRow: (rIdx1Based: number) => {
          rows.splice(rIdx1Based - 1, 1);
        },
        _getRows: () => rows,
      };
    };

    mockSheets = {
      Students: createMockSheet('Students', ['student_id', 'student_name', 'status'], [
        ['STU_001', 'Alice', 'ACTIVE'],
        ['STU_002', 'Bob', 'ACTIVE'],
      ]),
      Packages: createMockSheet('Packages', ['student_id', 'package_price', 'status'], [
        ['STU_001', '1000', 'ACTIVE'],
        ['STU_002', '2000', 'ACTIVE'],
        ['STU_001', '1500', 'COMPLETED'],
      ]),
      Payments: createMockSheet('Payments', ['student_id', 'amount', 'currency'], [
        ['STU_001', '1000', 'INR'],
        ['STU_002', '2000', 'INR'],
      ]),
      ClassSessions: createMockSheet('ClassSessions', ['student_id', 'schedule_date', 'session_status'], [
        ['STU_001', '2026-11-20', 'COMPLETED'],
        ['STU_001', '2026-12-01', 'SCHEDULED'],
        ['STU_002', '2026-12-02', 'SCHEDULED'],
      ]),
    };

    mockSpreadsheet = {
      getSheetByName: (name: string) => mockSheets[name] || null,
    };
  });

  it('rejects deletion when student_id is missing', () => {
    const res = StudentService.Students_delete(mockSpreadsheet, '');
    expect(res.success).toBe(false);
    expect(res.code).toBe('VALIDATION_ERROR');
  });

  it('deletes only the target student records across all sheets and preserves other students', () => {
    const res = StudentService.Students_delete(mockSpreadsheet, 'STU_001');
    expect(res.success).toBe(true);
    expect(res.data.deletedStudents).toBe(1);
    expect(res.data.deletedPackages).toBe(2);
    expect(res.data.deletedPayments).toBe(1);
    expect(res.data.deletedClasses).toBe(2);

    // Verify Students sheet: only STU_002 remains
    const studentRows = mockSheets.Students._getRows();
    expect(studentRows).toHaveLength(2); // header + 1 student
    expect(studentRows[1][0]).toBe('STU_002');

    // Verify Packages sheet: only STU_002 remains
    const pkgRows = mockSheets.Packages._getRows();
    expect(pkgRows).toHaveLength(2);
    expect(pkgRows[1][0]).toBe('STU_002');

    // Verify Payments sheet: only STU_002 remains
    const payRows = mockSheets.Payments._getRows();
    expect(payRows).toHaveLength(2);
    expect(payRows[1][0]).toBe('STU_002');

    // Verify ClassSessions sheet: only STU_002 remains
    const clsRows = mockSheets.ClassSessions._getRows();
    expect(clsRows).toHaveLength(2);
    expect(clsRows[1][0]).toBe('STU_002');
  });
});
