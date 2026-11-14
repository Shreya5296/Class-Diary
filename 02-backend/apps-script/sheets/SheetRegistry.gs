/**
 * Canonical Sheet Registry
 * Defines the canonical business and operational spreadsheet tabs and their exact column headers.
 * Exactly FOUR canonical tables: Students (10 cols), Packages (12 cols), Payments (6 cols), ClassSessions (9 cols).
 * MeetingLinks and StudentNotes are permanently removed.
 */

var SHEET_NAMES = {
  STUDENTS: 'Students',
  PACKAGES: 'Packages',
  PAYMENTS: 'Payments',
  CLASS_SESSIONS: 'ClassSessions',
  // Preserved for legacy reference only
  ENROLLMENTS: 'Enrollments',
  FEE_OBLIGATIONS: 'FeeObligations',
  CLASS_SCHEDULES: 'ClassSchedules'
};

var SHEET_SCHEMAS = {};

// Table 1: Students (10 columns)
SHEET_SCHEMAS[SHEET_NAMES.STUDENTS] = [
  'student_id', 'student_name', 'parent_name', 'parent_phone', 'parent_email',
  'student_phone', 'student_email', 'subject', 'status', 'primary_meeting_link'
];

// Preserved for legacy transition fallback; superseded by Packages
SHEET_SCHEMAS[SHEET_NAMES.ENROLLMENTS] = [
  'enrollment_id', 'student_id', 'enrollment_name', 'start_date', 'end_date',
  'enrollment_status', 'fee_plan_name', 'agreed_total_amount', 'currency',
  'billing_notes', 'created_at', 'updated_at', 'closed_at'
];

// Table 2: Packages (12 columns)
SHEET_SCHEMAS[SHEET_NAMES.PACKAGES] = [
  'student_id', 'student_name', 'plan_type', 'currency', 'package_price',
  'per_class', 'classes_purchased', 'start_date', 'end_date', 'next_due_date',
  'class_duration', 'class_schedule'
];

// Preserved for legacy transition fallback; superseded by Payment Details
SHEET_SCHEMAS[SHEET_NAMES.FEE_OBLIGATIONS] = [
  'fee_obligation_id', 'student_id', 'student_name', 'package_id',
  'obligation_description', 'amount_due', 'credit_applied', 'currency',
  'issue_date', 'due_date', 'obligation_status', 'notes',
  'created_at', 'updated_at', 'voided_at', 'void_reason'
];

// Table 3: Payment Details (6 columns)
SHEET_SCHEMAS[SHEET_NAMES.PAYMENTS] = [
  'student_id', 'student_name', 'payment_date', 'amount', 'currency', 'in_inr'
];

// Table 4: Class Sessions (9 columns)
SHEET_SCHEMAS[SHEET_NAMES.CLASS_SESSIONS] = [
  'student_id', 'student_name', 'schedule_date', 'schedule_time',
  'attendance_status', 'session_status', 'deduct_class', 'cancellation_reason', 'session_notes'
];

// Preserved for legacy transition fallback
SHEET_SCHEMAS[SHEET_NAMES.CLASS_SCHEDULES] = [
  'schedule_id', 'student_id', 'day_of_week', 'start_time', 'end_time',
  'is_active', 'created_at', 'updated_at'
];

function getCanonicalSheetNames() {
  return [
    SHEET_NAMES.STUDENTS,
    SHEET_NAMES.PACKAGES,
    SHEET_NAMES.PAYMENTS,
    SHEET_NAMES.CLASS_SESSIONS
  ];
}

function getExpectedHeaders(sheetName) {
  return SHEET_SCHEMAS[sheetName] || null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SHEET_NAMES: SHEET_NAMES,
    SHEET_SCHEMAS: SHEET_SCHEMAS,
    getCanonicalSheetNames: getCanonicalSheetNames,
    getExpectedHeaders: getExpectedHeaders
  };
}
