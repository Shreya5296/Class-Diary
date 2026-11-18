# 01 — Test Strategy and Acceptance Criteria

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** Operations-01
- **Status:** Authoritative Quality Assurance Specification
- **Version:** 5.0.0 (Canonical Four-Table Datastore & Unified Workflows)
- **Last Verified Date:** 2026-11-17
- **Audience:** QA engineers, developers, AI coding agents

---

## 2. Test Principles

- Test observable behavior and important business invariants, not implementation details alone.
- Treat backend validation and authorization as mandatory even when the frontend already validates input.
- Use synthetic test data by default. Do not use real student or parent information in development or automated tests.
- Never run destructive tests against the live production Google Spreadsheet.
- Make financial calculations deterministic and independently verifiable.
- Test failure paths as well as successful paths.
- All source files in `src/` and `public/` must strictly contain $\le 149$ lines (`npm run check:lines`).

---

## 3. Test Environments and Data

### 3.1 Environments
- **Local/Development:** Frontend runs in Vite dev server; backend operations run against in-memory `MockSpreadsheet.ts` or development Apps Script deployment.
- **Preview/Staging:** Vercel preview deployments connected to development test spreadsheets.
- **Production:** Production master Google Spreadsheet (`Private Class Dashboard`). Routine automated tests are prohibited from mutating production data.

### 3.2 Minimum Synthetic Dataset (Canonical Four Tables)
The synthetic test fixtures (`tests/fixtures/syntheticData.ts`) model:
1. `Students` (10 cols): Active, inactive, and archived students with phone numbers, emails, subjects, and primary meeting links.
2. `Packages` (12 cols): Active, exhausted, and renewed packages with plan types, currencies, rates, purchased class counts, durations, and serialized recurring schedules.
3. `Payments` (6 cols): Domestic INR and foreign currency payments with manual `in_inr`.
4. `ClassSessions` (9 cols): Attended, completed, unexcused absent, excused absent, advance cancelled, late cancelled, and rescheduled sessions with attendance statuses, deduct_class flags, cancellation reasons, and pedagogical session notes.

---

## 4. Test Layers and Tooling

- **Static Policy Check:** `scripts/check-line-limits.js` enforcing maximum 149 lines per file and zero catch-all files across `src/` and `public/`.
- **TypeScript Typecheck:** Strict compilation with zero errors via `tsc --noEmit`.
- **Unit and Domain Suites:** Vitest running against domain modules and `MockSpreadsheet.ts`.
- **Regression Suites:** Multi-batch regression suites verifying edge cases, adversarial renewal recovery, schedule locking reentrancy, and currency insulation.
- **Playwright E2E:** Browser-driven verification of login, student directory, class scheduling, and payment workflows.

---

## 5. Core Functional Acceptance Criteria

### AT-01 — Authentication & Authorization
- Given an unauthenticated visitor or forged token, protected API operations return `{ ok: false, error: { code: 'UNAUTHORIZED' } }` and disclose zero student records.
- Given an authorized token for `ashreya0502@gmail.com`, protected operations succeed.
- Requests from unauthorized emails return `{ ok: false, error: { code: 'ACCESS_DENIED' } }`.

### AT-02 — Student Directory & Identity
- Backend generates permanent sequential IDs in the format `STU_001` through `STU_026`.
- Sorting or rearranging rows in Google Sheets does not alter student identity.
- Single primary virtual meeting link is stored directly in `Students.primary_meeting_link`.

### AT-03 — Package Renewal & Class Balance Derivation
- When a student renews, the historical package row in `Packages` remains intact and is never overwritten.
- A new package row is appended storing only the newly purchased classes (`classes_purchased = newClasses`).
- Aggregate student available balance is derived across all packages:
  $$\text{Balance} = \sum(\text{classes\_purchased across all packages}) - \sum(\text{ClassSessions where deduct\_class = true})$$
- Carried-forward classes do not increase the renewal package price. Remaining classes are not monetary credit.
- Renewal recovery fails closed with `AMBIGUOUS_RENEWAL_RECOVERY` if durable state in ScriptProperties cannot unambiguously prove prior execution outcome.

### AT-04 — Schedule Persistence & Concurrency Locking
- Recurring weekly schedules are stored in `Packages.class_schedule`.
- All writes to `Packages.class_schedule` (including `Schedules_save` and `RenewalService`) acquire the shared script lock via `LockManager.withLock`.
- `LockManager.withLock` supports execution-local reentrancy, allowing nested calls within the same execution context without self-deadlock.
- Rejection on timeout: If lock acquisition fails within timeout, the operation aborts with code `LOCK_TIMEOUT` and zero sheet mutations occur.

### AT-05 — Financial Accounting & Multi-Currency Insulation
- Financial summaries are grouped strictly by currency (INR, USD, GBP, EUR).
- Outstanding amount is:
  $$\text{Outstanding}_{\text{cur}} = \max(0, \text{Total Package Payable}_{\text{cur}} - \text{Total Recorded Payments}_{\text{cur}})$$
- Outstanding balance never becomes negative.
- Excess payments are displayed separately as Available Credit ($\max(0, \text{Total Paid} - \text{Total Payable})$).
- Overpayment by one student never offsets another student's debt.
- Foreign payments retain original currency; unconverted foreign amounts contribute 0 to INR totals.
- Missing or invalid numeric values must be treated as unreliable/unavailable (`isReliable: false`), not silently coerced to zero.

### AT-06 — Payment Recording & Physical Void Deletion
- Physical Payments table has exactly 6 columns: `student_id, student_name, payment_date, amount, currency, in_inr`. No physical status column.
- Recording appends a payment record with client-supplied idempotency key.
- Voiding physically deletes the matching row via `sheet.deleteRow()` and records a durable tombstone `payment_void_<id>` in `ScriptProperties`.
- If multiple identical matching rows exist without unique discrimination, voiding rejects with `AMBIGUOUS_RECORD` to prevent deleting the wrong record.

### AT-07 — Class Attendance, Cancellation, and Credit Restoration
- `PRESENT` / `ATTENDED`: Sets `session_status = 'COMPLETED'`, `attendance_status = 'PRESENT'`, `deduct_class = true`.
- `NO_SHOW` / `ABSENT`: Prompts administrator whether to deduct credit.
- `CANCELLED`:
  - Administrator must supply an explicit cancellation reason, stored in `ClassSessions.cancellation_reason`.
  - `session_notes` (column 9) is preserved independently.
  - If cancelled $\ge 4$h in advance or waived: `deduct_class = false`, `attendance_status = 'CANCELLED'`, and an automatic replacement session is scheduled at the next available recurring slot, extending package `end_date`.
  - If cancelled $< 4$h in advance without waiver: `deduct_class = true`, `attendance_status = 'CANCELLED_LATE'`.
- `Classes_restoreCredit`: Restores credit on an erroneously deducted session in place setting `deduct_class = false`.
