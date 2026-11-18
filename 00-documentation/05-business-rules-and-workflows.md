# 05 — Business Rules and Workflows

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** 05
- **Status:** Authoritative Business Rules Specification
- **Version:** 5.0.0 (Canonical Four-Table Datastore & Unified Workflows)
- **Last Verified Date:** 2026-11-17
- **Audience:** Developers, business logic reviewers, AI coding agents

---

## 2. Student Lifecycle & Status Rules

### 2.1 Student Creation
- Generated via 4-section modal in `StudentsPage`:
  1. **Personal Details:** Student name (required), phone (optional), email (optional), enrolled subject(s) (multi-select: English, Math, Science, Social Science, Hindi, Geeta).
  2. **Parent Details:** Parent name (required), parent phone (required), parent email (optional).
  3. **Package Details:** Plan type, package price, classes purchased, class duration, per-class rate, start date.
  4. **Schedule Details:** Weekly recurring schedule slots (day of week, start time) and first class date.
- **Permanent Student ID:** Backend generates permanent sequential IDs in the format `STU_001`, `STU_002`, ..., `STU_026`. IDs are immutable and never reassigned.
- **Idempotent Retry:** If registration encounters an intermittent network failure, retrying with the same student name reuses the existing student record rather than creating a duplicate.

### 2.2 Student Status Classification (`studentStatusClassifier.ts`)
Students are categorized into **Active** and **Inactive** tabs:
- **Inactive Criteria (any of the following makes a student Inactive):**
  1. `status` column is explicitly set to `INACTIVE` or `ARCHIVED`.
  2. The student has a package where aggregate `classes_purchased > 0` and aggregate `remaining_classes <= 0` (package balance exhausted).
  3. The student's last completed class date occurred **$\ge 1$ calendar month ago** relative to the reference date (calculated using month-end clamping via `calculateOneCalendarMonthBefore`).
- **Active Criteria:**
  - `status === 'ACTIVE'`, has remaining classes ($> 0$), and has a completed class within the past month.
  - **Exception for New Students:** A student with **0 completed classes** remains **Active** even if their registration or package start date is in the past.

---

## 3. Package Lifecycle, Renewal & Class Balance Derivation

### 3.1 Package Terms
- **Plan Types:** `PACKAGE`, `MONTHLY`, `YEARLY`, `PER_CLASS`.
- **Per-Class Rate Recalculation:** Automatically calculated as $\text{Package Price} / \text{Classes Purchased}$. The rate is editable by the user; changing the package price or class count recalculates the per-class rate.
- **Class Duration:** Duration of each class session in minutes (default `60`). Stored in `Packages.class_duration`.

### 3.2 Recurring Schedule Storage (`Packages.class_schedule`)
- Recurring weekly schedules are stored directly inside `Packages.class_schedule` as a human-readable comma-separated string, e.g.:
  `Mon - 6:00 PM, Wed - 6:00 PM, Sat - 10:00 AM`
- Serialized by `_formatScheduleString` and parsed by `_parseScheduleString`.
- Day abbreviations: `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`, `Sun`.

### 3.3 Package Renewal Rules
When a student renews their package (`packages.renew` / `students.renew`):
1. **Historical Package Preservation:**
   - The historical package row is never overwritten or mutated.
   - A new package row is appended to the `Packages` sheet representing solely the new package purchase (`classes_purchased = newClasses`, `package_price = newPrice`, `start_date`, `end_date`, `class_schedule`).
2. **Class Balance Example:**
   - Student originally purchases 12 classes (`classes_purchased = 12`).
   - Student completes 9 classes (`consumed = 9`, `deduct_class = true`).
   - Remaining balance is 3.
   - Student renews with another 12 classes (`classes_purchased = 12`).
   - New package row stores `12` purchased classes. Previous package row remains `12`.
   - Aggregate purchased classes becomes $12 + 12 = 24$.
   - Consumed classes remain 9.
   - Aggregate available class balance becomes $24 - 9 = 15$.
3. **Price and Credit Invariants:**
   - Remaining classes carried forward from a previous package **do not increase the renewal package price**.
   - Remaining classes are **not monetary credit**.
   - Carried-forward classes extend tutoring availability, not cash refunds.
4. **Renewal Idempotency & Checkpoint Safety:**
   - Client sends an `idempotency_key` stored in `sessionStorage`.
   - Backend records durable checkpoints in `ScriptProperties` at each mutation phase:
     1. Initial request intent recorded.
     2. New package row inserted and `inserted_row_index` durably persisted.
     3. Optional payment appended to `Payments`.
     4. Recurring schedule updated and future sessions scheduled.
     5. Completion checkpoint marked.
   - **Fail-Closed Recovery:** If ScriptProperties persistence fails after package insertion, or if the inserted row is externally moved/deleted, retry validation fails closed with `AMBIGUOUS_RENEWAL_RECOVERY` to prevent duplicate package or payment insertion.
   - In ambiguous recovery states, the administrator must inspect the sheet and reconcile manually.

---

## 4. Class Scheduling & Session Workflow

### 4.1 Session Identity & Mutation Architecture
- In `ClassSessions` (9 columns), each row represents one scheduled or past session.
- **No `session_id` Column:** The sheet contains no session ID column. Sessions are identified by composite key:
  $$\text{Composite Key} = \text{student\_id} + \text{"\_\_"} + \text{schedule\_date} + \text{"\_\_"} + \text{schedule\_time}$$
  (e.g. `STU_001__2026-01-19__18:00`), or by 1-based row index `_rowIndex`.
- **Row Index Priority & Fallback Strategy:**
  - When mutating sessions (`Classes_update`), if `_rowIndex` is provided, the backend accesses the row directly with safety guard `updates.student_id === rec.student_id`.
  - If omitted or guard fails, it falls back to scanning all rows for the composite key.
- **Direct Spreadsheet Operational Rule:**
  - **Never manually sort, insert, delete, or rearrange `ClassSessions` rows while client operations are in progress.** Stale row indices can misdirect updates among sessions of the same student.
- **Derived End Time:** There is no stored end-time column in the sheet. End time is derived dynamically as $\text{schedule\_time} + \text{Packages.class\_duration}$.

### 4.2 Attendance Marking & Deduction Rules
Class balance is consumed only when `ClassSessions.deduct_class` is `TRUE`:
1. **`PRESENT` / `ATTENDED`:**
   - Marks `session_status = COMPLETED`, `attendance_status = PRESENT`.
   - Automatically sets `deduct_class = true`.
2. **`ABSENT` / `NO_SHOW`:**
   - Prompts the administrator. If unexcused, `deduct_class = true`. If excused, `deduct_class = false`.
3. **`NOT_MARKED`:**
   - Default state for scheduled future classes. `deduct_class = false`.

### 4.3 Cancellation Policy & Replacement Sessions
When a class session is cancelled (`Classes_cancel`):
1. **Required Cancellation Reason:**
   - Administrator must provide an explicit cancellation reason in the modal.
   - Stored in `ClassSessions.cancellation_reason`.
   - `ClassSessions.session_notes` is preserved independently and never overwritten by cancellation.
2. **Late Cancellation Threshold:**
   - If cancelled **$< 4$ hours** before scheduled class time and credit is not waived:
     - `session_status = CANCELLED`, `attendance_status = CANCELLED_LATE`, `deduct_class = true`.
     - Consumes 1 class credit.
3. **Advance Cancellation or Credit Waived:**
   - If cancelled $\ge 4$ hours in advance or explicitly waived (`credit_waiver: true` or "waiv"/"excused" in reason):
     - `session_status = CANCELLED`, `attendance_status = CANCELLED`, `deduct_class = false`.
     - Credit is preserved.
4. **Automatic Replacement Scheduling:**
   - When a session is cancelled with `deduct_class = false`, the system scans the student's recurring schedule, finds the next available open slot following their latest scheduled session, and inserts a new replacement `ClassSessions` record.
   - The package `end_date` is extended accordingly.
5. **Credit Restoration:**
   - `Classes_restoreCredit` locates the cancelled session, verifies `deduct_class === true`, and updates it in place to `false`.

---

## 5. Financial Accounting & Multi-Currency Rules

### 5.1 Financial Summary & Balance Calculations
The financial model is based on **lifetime package value and recorded payments, grouped strictly by currency**:
1. **Total Invoiced / Payable:**
   $$\text{Total Payable}_{\text{currency}} = \sum_{p \in \text{Packages}, p.\text{currency} = \text{cur}} p.\text{package\_price}$$
   Includes all historical and current packages. Cancelled packages remain included unless explicitly adjusted.
2. **Total Paid:**
   $$\text{Total Paid}_{\text{currency}} = \sum_{m \in \text{Payments}, m.\text{currency} = \text{cur}} m.\text{amount}$$
3. **Outstanding Amount:**
   $$\text{Outstanding}_{\text{currency}} = \max(0, \text{Total Payable}_{\text{currency}} - \text{Total Paid}_{\text{currency}})$$
   - Outstanding balance **never becomes negative**.
4. **Excess Payment as Available Credit:**
   - If a student pays more than their agreed package payable in that currency, the surplus is displayed separately as **Available Credit**:
     $$\text{Available Credit}_{\text{currency}} = \max(0, \text{Total Paid}_{\text{currency}} - \text{Total Payable}_{\text{currency}})$$
   - Available credit does not offset other students' balances.
5. **Data Reliability Guard:**
   - Missing or non-numeric values in `package_price` or `amount` mark the balance as **unreliable** (`isReliable: false`).
   - The application does not silently coerce missing or invalid values to zero.

### 5.2 Multi-Currency Handling
- Payments and packages retain their original currency code (`INR`, `USD`, `GBP`, `EUR`).
- **Domestic Transactions (`INR`):** Amount is used directly.
- **Foreign Transactions (non-`INR`):**
  - Requires manual `in_inr` entry on the payment record.
  - If a foreign payment lacks manual `in_inr`, it contributes **0** to INR totals.
  - Foreign currencies are **never** added directly to INR.
  - The application **never calls external automated exchange-rate APIs**.
- **Debtor Balance Insulation:** Overpayment by one student never offsets another student's debt.

### 5.3 Payments Schema & Void Mechanics
- **Physical Schema (6 columns):** `student_id, student_name, payment_date, amount, currency, in_inr`.
- **No Physical Status Column:** There is no `status` or `void_reason` column in the physical Payments sheet.
- **Physical Row Deletion on Void:** Voiding physically deletes the matching row via `sheet.deleteRow()`.
- **Durable Tombstone in ScriptProperties:** Records `payment_void_<id>` with void reason and timestamp.
- **Ambiguity Guard:** If multiple identical rows exist matching student, date, and amount without unique discrimination, `Payments_void` rejects with `AMBIGUOUS_RECORD` to prevent deleting the wrong row.

---

## 6. Schedule Persistence & Concurrency Safeguards

### 6.1 Canonical Storage
- Recurring schedule patterns are stored in `Packages.class_schedule`.
- `ClassSchedules` is not an active operational table.

### 6.2 Shared ScriptLock Protection
- All writes to `Packages.class_schedule` (including `schedules.save` via `ClassScheduleService.gs` and `RenewalService.gs`) acquire the shared script lock:
  ```javascript
  LockManager.withLock(function() {
    // Schedule read, validation, and write to Packages.class_schedule
  }, 30000);
  ```
- **Reentrant Lock Support:** `LockManager.withLock` tracks execution-local depth. Nested calls by the same execution context execute safely without self-deadlock.
- **Lock Timeout / Failure:** If lock cannot be acquired within 30 seconds, the operation aborts with `LOCK_TIMEOUT` and zero sheet mutations occur.

---

## 7. Primary Meeting Links & Class Session Notes

### 7.1 Primary Meeting Link
- Stored directly in `Students.primary_meeting_link` (column 10).
- Managed through the Students page (registration, expansion, and edit modal).
- Standalone `MeetingLinks` sheet and page are permanently retired.

### 7.2 Class Session Notes
- Stored directly in `ClassSessions.session_notes` (column 9).
- Records pedagogical coverage, stories/topics taught, and remarks for each session.
- Contextual cancellation remarks are kept separate in `cancellation_reason`.
- Standalone `StudentNotes` sheet is permanently retired.
