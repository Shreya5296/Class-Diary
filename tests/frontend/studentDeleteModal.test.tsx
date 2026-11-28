import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DeleteStudentModal } from '../../src/domains/students/DeleteStudentModal';
import { Student } from '../../src/domains/students/studentTypes';
import { handleMockStudentDelete } from '../../src/api/mockStudentOperations';

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
});
