# 03 Data — 01 Master Spreadsheet Schema

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** Data-01
- **Status:** Authoritative Master Spreadsheet Specification
- **Version:** 5.0.0 (Strict Four-Table Canonical Architecture)
- **Last Verified Date:** 2026-11-17
- **Canonical Spreadsheet:** `Private Class Dashboard` (`1cVQknq_Ix-T6igp7c-DwwuYHvgn60fVGbwTGZfGSii8`)
- **Default Timezone:** `Asia/Kolkata`
- **Default Currency:** `INR`

---

## 2. Canonical Tab Inventory (Four Tables Only)

The master spreadsheet consists of **strictly four canonical data tables**. `MeetingLinks` and `StudentNotes` are permanently eliminated.

```text
The Four Canonical Tables:
├── 1. Students          (10 columns: student directory, parent contacts, subject, status, primary_meeting_link)
├── 2. Packages          (12 columns: package pricing, class count, duration, recurring schedule)
├── 3. Payments          (6 columns: payment date, original amount, currency, manual in_inr)
└── 4. ClassSessions     (9 columns: schedule date & time, attendance status, deduct_class, cancellation, session_notes)

Archived & Retired Sheets:
├── _Archived_Historical_Notes (Archived unmapped historical notes)
├── _Backup_PreFourTable_* (Archived backups prior to 4-table simplification)
├── _Archived_ClassSchedules (Archived during canonical schema migration)
├── _Backup_PreCanonical_Packages (Archived backup)
├── _Backup_PreCanonical_ClassSchedules (Archived backup)
├── StudentId_Migration_Backup (Archived backup from STU_001 migration)
└── Permanently Retired: MeetingLinks, StudentNotes, Enrollments, FeeObligations, AppConfig, ImportBatches, ImportRowResults
```

---

## 3. Detailed Physical Column Order & Field Specifications

### 3.1 Tab 1: `Students` (10 Columns)
| # | Column Name | Type | Key | Description |
|---:|---|---|---|---|
| 1 | `student_id` | String ID | PK | Immutable unique student identifier (`STU_001` format). |
| 2 | `student_name` | Text | — | Student's full display name. |
| 3 | `parent_name` | Text | — | Primary parent or guardian contact name. |
| 4 | `parent_phone` | Text | — | Primary parent phone (WhatsApp/call). Stored with `'` prefix if starting with `+`. |
| 5 | `parent_email` | Text | — | Parent email address (optional). |
| 6 | `student_phone` | Text | — | Direct student phone number (optional). |
| 7 | `student_email` | Text | — | Direct student email for calendar invites (optional). |
| 8 | `subject` | Text | — | Enrolled subject or subjects (e.g. `AP Calculus BC`). |
| 9 | `status` | Enum | — | Student status: `ACTIVE`, `INACTIVE`, `ARCHIVED`. Default `ACTIVE`. |
| 10 | `primary_meeting_link` | Text/URL | — | Single primary virtual meeting room URL (Google Meet, Zoom, etc.). |

**Canonical Column Order:**
`student_id, student_name, parent_name, parent_phone, parent_email, student_phone, student_email, subject, status, primary_meeting_link`

---

### 3.2 Tab 2: `Packages` (12 Columns)
| # | Column Name | Type | Key | Description |
|---:|---|---|---|---|
| 1 | `student_id` | String ID | FK | Links to `Students.student_id`. Primary retrieval key. |
| 2 | `student_name` | Text | — | Student name snapshot for spreadsheet readability. |
| 3 | `plan_type` | Enum/Text | — | Plan type: `PACKAGE`, `MONTHLY`, `YEARLY`, `PER_CLASS`. |
| 4 | `currency` | Text | — | Agreed currency code (e.g. `INR`, `USD`, `GBP`, `EUR`). Default `INR`. |
| 5 | `package_price` | Numeric | — | Total agreed package price or periodic billing amount. |
| 6 | `per_class` | Numeric | — | Effective rate per individual class session. |
| 7 | `classes_purchased` | Integer | — | Total sessions purchased (positive integer). |
| 8 | `start_date` | Date/Text | — | Package start date (`YYYY-MM-DD` / `dd/mm/yyyy`). |
| 9 | `end_date` | Date/Text | — | Projected package end date (`YYYY-MM-DD` / `dd/mm/yyyy`). |
| 10 | `next_due_date` | Date/Text | — | Next billing or renewal due date (derived by N-4 rule). |
| 11 | `class_duration` | Integer | — | Class duration in minutes (default `60`). |
| 12 | `class_schedule` | Text | — | Recurring schedule string (e.g. `Mon - 6:00 PM, Wed - 6:00 PM`). |

**Canonical Column Order:**
`student_id, student_name, plan_type, currency, package_price, per_class, classes_purchased, start_date, end_date, next_due_date, class_duration, class_schedule`

*Important Schema Rules:*
- **There is no `package_id` column** in the sheet. Packages are uniquely identified by `student_id`.
- `class_schedule` is the single source of truth for recurring weekly schedule patterns.

---

### 3.3 Tab 3: `Payments` (6 Columns)
| # | Column Name | Type | Key | Description |
|---:|---|---|---|---|
| 1 | `student_id` | String ID | FK | Links to `Students.student_id`. |
| 2 | `student_name` | Text | — | Student name snapshot. |
| 3 | `payment_date` | Date/Text | — | Date payment was received (`YYYY-MM-DD` / `dd/mm/yyyy`). |
| 4 | `amount` | Numeric | — | Amount received in original payment currency. Greater than zero. |
| 5 | `currency` | Text | — | Original payment currency (e.g. `INR`, `USD`, `GBP`). |
| 6 | `in_inr` | Numeric | — | Manually entered INR-equivalent amount. Never overwritten by automated rates. |

**Canonical Column Order:**
`student_id, student_name, payment_date, amount, currency, in_inr`

*Important Schema Rules:*
- **Original payment currency is preserved in `currency`.**
- **No Physical Payment Status Column:** There is no status or void_reason column in the physical sheet. Voiding physically removes the matching row via `sheet.deleteRow()` and records a durable tombstone `payment_void_<id>` in `ScriptProperties`.
- **INR conversion is never done via third-party rate lookups.** Unconverted foreign payments contribute 0 to INR financial summaries.

---

### 3.4 Tab 4: `ClassSessions` (9 Columns)
| # | Column Name | Type | Key | Description |
|---:|---|---|---|---|
| 1 | `student_id` | String ID | FK | Links to `Students.student_id`. |
| 2 | `student_name` | Text | — | Student name snapshot. |
| 3 | `schedule_date` | Date/Text | — | Scheduled class date (`YYYY-MM-DD` / `dd/mm/yyyy`). Formatted as plain text `@`. |
| 4 | `schedule_time` | Text | — | Scheduled start time in `Asia/Kolkata` (24-hour `HH:mm`, e.g. `18:00`). |
| 5 | `attendance_status` | Enum | — | `NOT_MARKED`, `PRESENT`, `ATTENDED`, `ABSENT`, `CANCELLED`, `CANCELLED_LATE`. |
| 6 | `session_status` | Enum | — | `SCHEDULED`, `COMPLETED`, `CANCELLED`. |
| 7 | `deduct_class` | Boolean | — | `TRUE` if class consumes package balance; `FALSE` otherwise. |
| 8 | `cancellation_reason` | Text | — | Reason for cancellation provided by administrator. |
| 9 | `session_notes` | Text | — | Lesson coverage, stories/topics taught, concepts discussed, remarks. |

**Canonical Column Order:**
`student_id, student_name, schedule_date, schedule_time, attendance_status, session_status, deduct_class, cancellation_reason, session_notes`

*Important Schema Rules:*
- **There is no session ID column and no stored end-time column** in Google Sheets.
- **Session Identity:** Sessions are identified by composite key `student_id__schedule_date__schedule_time` (or 1-based row index).
- **Derived End Time:** End time is dynamically derived as `schedule_time + Packages.class_duration`.
- **Consumed Balance Derivation:** The application counts sessions for that student where `deduct_class === true`. Total available student balance is:
  $$\text{Balance} = \sum_{p \in \text{Packages}} p.\text{classes\_purchased} - \sum_{s \in \text{ClassSessions}, s.\text{deduct\_class} = \text{true}} 1$$
- **Lesson Notes Integration:** `session_notes` stores pedagogical notes and lesson coverage directly against the scheduled class session, preserved independently from `cancellation_reason`.
