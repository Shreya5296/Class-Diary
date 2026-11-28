import { ApiResponse } from './apiResponse';
import {
  MOCK_STUDENTS,
  MOCK_CLASSES,
  MOCK_PACKAGES,
  MOCK_PAYMENTS,
  MOCK_SCHEDULES,
  MOCK_FEES,
} from './mockDataInitial';

export function handleMockStudentDelete<T>(
  payload: Record<string, unknown>,
  meta: { requestId: string; timestamp: string }
): ApiResponse<T> {
  const sid = String(payload.student_id || payload.studentId || '').trim();
  if (!sid) {
    return {
      ok: false,
      error: 'Student ID is required',
      meta,
    } as unknown as ApiResponse<T>;
  }

  const stuIdx = MOCK_STUDENTS.findIndex((s) => s.student_id === sid);
  const deletedStudents = stuIdx !== -1 ? 1 : 0;
  if (stuIdx !== -1) {
    MOCK_STUDENTS.splice(stuIdx, 1);
  }

  let deletedClasses = 0;
  for (let i = MOCK_CLASSES.length - 1; i >= 0; i--) {
    if (MOCK_CLASSES[i].student_id === sid) {
      MOCK_CLASSES.splice(i, 1);
      deletedClasses++;
    }
  }

  let deletedPackages = 0;
  for (let i = MOCK_PACKAGES.length - 1; i >= 0; i--) {
    if (MOCK_PACKAGES[i].student_id === sid) {
      MOCK_PACKAGES.splice(i, 1);
      deletedPackages++;
    }
  }

  let deletedPayments = 0;
  for (let i = MOCK_PAYMENTS.length - 1; i >= 0; i--) {
    if (MOCK_PAYMENTS[i].student_id === sid) {
      MOCK_PAYMENTS.splice(i, 1);
      deletedPayments++;
    }
  }

  let deletedFees = 0;
  for (let i = MOCK_FEES.length - 1; i >= 0; i--) {
    if (MOCK_FEES[i].student_id === sid) {
      MOCK_FEES.splice(i, 1);
      deletedFees++;
    }
  }

  delete MOCK_SCHEDULES[sid];

  return {
    ok: true,
    data: {
      student_id: sid,
      deletedStudents,
      deletedClasses,
      deletedPackages,
      deletedPayments,
      deletedFees,
    } as unknown as T,
    meta,
  };
}
