import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DeleteStudentModal } from '../../src/domains/students/DeleteStudentModal';
import { Student } from '../../src/domains/students/studentTypes';
import { handleMockStudentDelete } from '../../src/api/mockStudentOperations';
import { formatDeleteResultMessage } from '../../src/domains/students/deleteStudentMessage';

describe('Fix L8: DeleteStudentModal Frontend Component & Mock Store', () => {
  const sampleStudent: Student = {
    student_id: 'STU_MOCK_DEL',
    student_name: 'Test Delete Target',
    status: 'ACTIVE',
  } as Student;

  it('renders DeleteStudentModal with confirmation prompt', () => {
    const html = renderToString(
      React.createElement(DeleteStudentModal, {
        isOpen: true,
        student: sampleStudent,
        onClose: () => {},
        onSuccess: () => {},
      })
    );

    expect(html).toContain('Delete Student Record');
    expect(html).toContain('Test Delete Target');
    expect(html).toContain('Delete Student Forever');
  });

  it('does not render when isOpen is false', () => {
    const html = renderToString(
      React.createElement(DeleteStudentModal, {
        isOpen: false,
        student: sampleStudent,
        onClose: () => {},
        onSuccess: () => {},
      })
    );

    expect(html).toBe('');
  });

  it('handleMockStudentDelete handles missing ID with error', () => {
    const meta = { requestId: 'req_1', timestamp: new Date().toISOString() };
    const res = handleMockStudentDelete<any>({}, meta);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('Student ID is required');
  });

  it('formats delete success message with per-sheet counts', () => {
    const preview = { classesCount: 0, packagesCount: 1, paymentsCount: 2 };
    const counts = { deletedStudents: 1, deletedClasses: 0, deletedPackages: 1, deletedPayments: 2 };
    const result = formatDeleteResultMessage(preview, counts);

    expect(result.isWarning).toBe(false);
    expect(result.message).toBe('Deleted student + 0 classes + 1 package + 2 payments');
  });

  it('shows clear warning when preview-vs-delete counts mismatch (expected rows left behind)', () => {
    // Preview found 1 package and 2 payments, but backend only deleted student profile and 0 packages/payments
    const preview = { classesCount: 4, packagesCount: 1, paymentsCount: 2 };
    const counts = { deletedStudents: 1, deletedClasses: 0, deletedPackages: 0, deletedPayments: 0 };
    const result = formatDeleteResultMessage(preview, counts);

    expect(result.isWarning).toBe(true);
    expect(result.message).toContain('Warning:');
    expect(result.message).toContain('Deleted student + 0 classes + 0 packages + 0 payments');
    expect(result.message).toContain('expected 4 classes, 1 packages, 2 payments');
  });

  it('handles pluralization correctly across counts', () => {
    const single = formatDeleteResultMessage(
      { classesCount: 1, packagesCount: 1, paymentsCount: 1 },
      { deletedClasses: 1, deletedPackages: 1, deletedPayments: 1 }
    );
    expect(single.isWarning).toBe(false);
    expect(single.message).toBe('Deleted student + 1 class + 1 package + 1 payment');

    const multi = formatDeleteResultMessage(
      { classesCount: 5, packagesCount: 3, paymentsCount: 4 },
      { deletedClasses: 5, deletedPackages: 3, deletedPayments: 4 }
    );
    expect(multi.isWarning).toBe(false);
    expect(multi.message).toBe('Deleted student + 5 classes + 3 packages + 4 payments');
  });
});
