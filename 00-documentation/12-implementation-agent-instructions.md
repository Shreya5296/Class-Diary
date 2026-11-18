# 12 — Implementation Agent Instructions

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** 12
- **Status:** Authoritative AI Coding Agent Instructions
- **Version:** 5.0.0 (Canonical Four-Table Architecture)
- **Last Verified Date:** 2026-11-17
- **Audience:** AI coding agents, autonomous agents, developers

---

## 2. Core Execution Guardrails

Any AI coding agent working in this repository must strictly adhere to the following rules:

### Rule 1: The Four Google Sheets Tables Restriction
The project datastore contains **strictly four physical tables**:
1. `Students` (10 cols): `student_id, student_name, parent_name, parent_phone, parent_email, student_phone, student_email, subject, status, primary_meeting_link`
2. `Packages` (12 cols): `student_id, student_name, plan_type, currency, package_price, per_class, classes_purchased, start_date, end_date, next_due_date, class_duration, class_schedule`
3. `Payments` (6 cols): `student_id, student_name, payment_date, amount, currency, in_inr`
4. `ClassSessions` (9 cols): `student_id, student_name, schedule_date, schedule_time, attendance_status, session_status, deduct_class, cancellation_reason, session_notes`

**Strictly Prohibited:**
- Never create or reference additional Google Sheets tables (`MeetingLinks`, `StudentNotes`, `ClassSchedules`, `FeeObligations`, `Enrollments`, `PackageHistory`, `StudentPayments`, `Attendance`, `Invoices`, `AppConfig`, etc.).
- Never add a `package_id` column to `Packages`. Packages are uniquely keyed by `student_id`.
- Never add a `session_id` or stored end-time column to `ClassSessions`. Sessions are identified by composite key `student_id__schedule_date__schedule_time` (or row index) and end time is derived from `Packages.class_duration`.
- Never add a payment status column to `Payments`. Voiding physically removes the row via `sheet.deleteRow()` and stores a durable tombstone in `ScriptProperties`.

### Rule 2: Package Renewal & Dynamic Class Balance
- On package renewal, append a new package row storing solely the newly purchased classes. Never overwrite or delete the historical package row.
- Aggregate available class balance is dynamically derived:
  $$\text{Balance} = \sum(\text{classes\_purchased across all packages}) - \sum(\text{ClassSessions where deduct\_class = true})$$
- Carried-forward classes do not increase the renewal package price. Remaining classes are not monetary credit.
- Renewal recovery fails closed with `AMBIGUOUS_RENEWAL_RECOVERY` if durable state cannot prove prior execution outcome.

### Rule 3: Schedule Persistence & Concurrency Locking
- Recurring weekly schedules are stored in `Packages.class_schedule`.
- All writes to `Packages.class_schedule` (including `Schedules_save` and `RenewalService`) must hold the shared script lock via `LockManager.withLock(fn, timeoutMs)`.
- `LockManager.withLock` supports execution-local reentrancy, allowing nested calls within the same execution context without self-deadlock.

### Rule 4: Financial Accounting Rules
- Financial accounting is based on lifetime package value and recorded payments, grouped strictly by currency.
- Outstanding amount is $\max(0, \text{Total Package Payable} - \text{Total Recorded Payments})$. Never becomes negative.
- Excess payment is displayed separately as available credit ($\max(0, \text{Paid} - \text{Payable})$).
- Foreign currencies (USD, GBP, EUR) are never added directly to INR without manual `in_inr`. No external exchange rate APIs.
- Missing or invalid numeric values must be treated as unreliable/unavailable (`isReliable: false`), not silently coerced to zero.

### Rule 5: Micro-File Architecture (Strictly $\le 149$ Lines)
- Every source file in `src/` and `public/` must remain strictly under 150 lines (**maximum 149 lines**).
- Catch-all monoliths (`utils.ts`, `helpers.ts`, `common.ts`, `actions.js`, `app.js`, `api.ts`) are forbidden.
- Always run `npm run check:lines` before completing any file modification.

### Rule 6: Production Freeze & Clasp Restriction
- Backend production deployment `@52` is strictly frozen.
- Coding agents are prohibited from executing `clasp push`, `clasp deploy`, or direct production Google Sheets edits without explicit user authorization.

### Rule 7: Do Not Modify Application Code During Documentation Tasks
- When tasked with documentation audits or updates, touch **only** markdown documentation files (`*.md`) and `running.txt`.
- Do not refactor frontend code, backend code, configuration, or test suites unless explicitly directed by the user.

---

## 3. Verification Commands for Coding Agents

Before reporting any task complete:
```bash
npm run check:lines    # Must pass (all files <= 149 lines, 0 catch-alls)
npm run typecheck      # Must pass (zero TypeScript errors)
npm run build          # Production build check (tsc && vite build)
npx vitest run         # Full test suite (75 files passed, 651 tests passed)
git diff --check       # Whitespace and diff sanity check
```
