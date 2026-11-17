# 00 — Project State and Recovery Record

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** Handoff-00
- **Status:** Authoritative Agent Handoff & Project Run State
- **Version:** 5.0.0 (Post-Audit Canonical Four-Table Architecture)
- **Last Verified Date:** 2026-11-17
- **Primary Audience:** AI coding agents, autonomous agents, developers

---

## 2. Current Run Snapshot

| Field | Current Verified Value |
|---|---|
| Project Name | Personal Dashboard (Student Management Dashboard) |
| Active Git Branch | `docs/reconcile-project-documentation` |
| Base Branch & Status | `main` (Synchronized with `origin/main` at commit `620aaf7`) |
| Current HEAD Commit on `main` | `620aaf75bffc5bb7221260d6db57dad1b544642a` (`merge: complete student, schedule, renewal, and payment workflows`) |
| Canonical Spreadsheet | `Private Class Dashboard` (ID: `1cVQknq_Ix-T6igp7c-DwwuYHvgn60fVGbwTGZfGSii8`, Owner: `ashreya0502@gmail.com`) |
| Active Canonical Tables | Exactly 4 physical tables: `Students` (10 cols), `Packages` (12 cols), `Payments` (6 cols), `ClassSessions` (9 cols) |
| Apps Script Project ID | `1CC_ZjGrLBD8BnrAm6CP9oDUJmUPqFy4MCc-MkBiBvCNkMA616uF_pCPL` |
| Web App Deployment ID | `AKfycbx4d_VG4CsZIEAomX_OjNMuej06ktTYmKLME5ennLsI7mx3Fn5b-YBu9CRqe7NwrUVH3w` |
| Active Production Deployment Version | **STRICTLY FROZEN** at version **`@52`** (clasp push/deploy prohibited without authorization) |
| Line Limit Policy Check | **PASSED** (`npm run check:lines`: 198 files across `src` and `public` $\le 149$ lines, 0 catch-alls) |
| TypeScript Compiler Check | **PASSED** (`npm run typecheck`: `tsc --noEmit` exits with 0 errors) |
| Vitest Automated Test Suite | **PASSED** (`npx vitest run`: 75 test files passed, 651 tests passed, 0 failed, 0 skipped) |
| Production Build Verification | **PASSED** (`npm run build`: `tsc && vite build`, dist output generated in 4.81s) |
| Git Whitespace Diff Check | **PASSED** (`git diff --check`: 0 errors) |

---

## 3. Strict Project Guardrails & Architectural Invariants

- **Four Physical Google Sheets Tables Only:** The active datastore consists strictly of `Students`, `Packages`, `Payments`, and `ClassSessions`. `MeetingLinks` and `StudentNotes` are permanently removed from the sheet.
- **No `package_id` in Packages:** Packages link directly to `Students.student_id`.
- **No `session_id` or Stored End-Time in ClassSessions:** Identified by composite key `student_id__schedule_date__schedule_time` (or 1-based row index `_rowIndex`); end time is dynamically derived as `schedule_time + Packages.class_duration`.
- **No Payment Status Column in Payments:** Physical table has exactly 6 columns. Payment voiding physically removes the row via `sheet.deleteRow()` and records a durable tombstone in `ScriptProperties` (`payment_void_<id>`).
- **One Primary Meeting Link:** Stored directly in `Students.primary_meeting_link`. Managed on the Students page.
- **Package Renewal Invariant:** Historical package row is preserved untouched; renewal appends a new package row storing solely the new purchase.
- **Aggregate Balance Derivation:** Aggregate available class balance is dynamically computed across all student packages minus all sessions where `deduct_class === true`.
- **Financial Accounting Model:** Grouped strictly by currency across lifetime packages and recorded payments. Outstanding balance is $\max(0, \text{Total Package Payable} - \text{Total Recorded Payments})$, never negative. Excess payment is displayed separately as Available Credit. Foreign payments retain original currency with manual `in_inr`.
- **Schedule Concurrency Protection:** All writes to `Packages.class_schedule` (including `Schedules_save` and `RenewalService`) acquire the shared script lock via `LockManager.withLock`, which supports execution-local reentrancy.
- **Micro-File Rule:** Every source file under `src/` and `public/` must remain strictly $\le 149$ lines. Catch-all files are forbidden.

---

## 4. Canonical Google Sheets Physical Schema (Four Tables)

1. **`Students`** (10 columns):
   `student_id, student_name, parent_name, parent_phone, parent_email, student_phone, student_email, subject, status, primary_meeting_link`
2. **`Packages`** (12 columns):
   `student_id, student_name, plan_type, currency, package_price, per_class, classes_purchased, start_date, end_date, next_due_date, class_duration, class_schedule`
3. **`Payments`** (6 columns):
   `student_id, student_name, payment_date, amount, currency, in_inr`
4. **`ClassSessions`** (9 columns):
   `student_id, student_name, schedule_date, schedule_time, attendance_status, session_status, deduct_class, cancellation_reason, session_notes`

*Archived / Retired Sheets in Spreadsheet:*
- `_Archived_Historical_Notes`, `_Archived_ClassSchedules`, `_Backup_PreFourTable_*`, `StudentId_Migration_Backup`, `_Backup_PreCanonical_Packages`, `_Backup_PreCanonical_ClassSchedules`.
- Permanently retired from application logic: `MeetingLinks`, `StudentNotes`, `AppConfig`, `Enrollments`, `FeeObligations`, `ImportBatches`, `ImportRowResults`.

---

## 5. Security Architecture

- **Zero-GCP:** No Google Cloud Console OAuth consent screens or client IDs.
- **Server-Side Authorization:** Session tokens signed with HMAC-SHA256 using `ADMIN_AUTH_KEY` stored in Apps Script `ScriptProperties`.
- **Admin Allowlist:** Single authorized administrator `ashreya0502@gmail.com` configured in `ADMIN_EMAILS`.
- **Formula Injection Guard:** Leading `+`, `=`, `@`, or `-` characters on user strings and phone numbers are escaped with a leading `'` on sheet write.
- **Transport:** HTTP POST with `Content-Type: text/plain;charset=utf-8` to eliminate CORS preflight.

---

## 6. Known Limitations & Recovery Runbooks

1. **Absence of Session ID in `ClassSessions`:**
   - Identified by composite key `student_id__schedule_date__schedule_time` or row index `_rowIndex`.
   - **Operational Rule:** **Never manually sort, insert, delete, or rearrange `ClassSessions` rows while client operations are in progress.** Stale row indices can misdirect updates among sessions of the same student.
2. **Fail-Closed Renewal Recovery:**
   - If execution fails after package insertion before completion checkpoint, or if ScriptProperties state is lost, the renewal recovery flow fails closed with `AMBIGUOUS_RENEWAL_RECOVERY` to prevent duplicate package or payment insertion.
   - Administrator must inspect the Packages sheet and reconcile manually.
3. **No External Exchange Rate Conversion:**
   - Foreign currencies are never automatically converted using third-party APIs. If a foreign currency payment lacks manual `in_inr`, it contributes 0 to INR totals.
4. **Apps Script Deployment Freeze:**
   - Backend code in `02-backend/apps-script/` matches `main`, but active deployment `@52` is frozen.

---

## 7. Phase & Milestone Historical Register

| Phase / Milestone | Scope / Description | Status | Evidence / Notes |
|---|---|---|---|
| Phase 0–12 | Architecture foundation, tooling, backend services, frontend screens, test suite | PASSED | Initial development cycle; micro-file architecture established. |
| Phase 13–16 | Operational tabs retirement, ConfigService decoupling, import feature retirement | PASSED | `AppConfig`, `ImportBatches`, `ImportRowResults` retired; ConfigService introduced. |
| Phase 17–22 | Unified Finances consolidation, ledger single-source, meeting links redesign | PASSED | Consolidated fees & payments into unified Finances page; meeting links table. |
| Phase 23–27 | Student ID consistency (`STU_001`–`STU_026`), migration, preflight & live execution | PASSED | Migrated 23 legacy student IDs to standard sequential `STU_xxx`. |
| Phase 28–32 | Meeting links refinement, student editing, status normalization, schedule persistence | PASSED | 4-section student registration, recurring schedules, uppercase status normalization. |
| Phase 33–36 | UX polish, calendar time grid, auto-expiry calculation, N-4 fee due date, 12h clock | PASSED | Live header clock, calendar 7-day grid, per-class calculation, N-4 fee rule. |
| Phase 37–39 | Registration recovery, network timeout hardening, async schedule worker | PASSED | Resilient student/package reuse; async schedule worker for large class batches. |
| Milestone: Four-Table Simplification | Retired `MeetingLinks` and `StudentNotes`; embedded primary link in `Students` (10 cols) and session notes in `ClassSessions` (9 cols) | PASSED | Verified four canonical tables in `fourTableMigrationHarness.test.ts`. |
| Milestone: Package Renewal & Concurrency | Multi-step renewal modal, historical row preservation, aggregate balance math, shared ScriptLock on schedule writes | PASSED | Verified in `approvedSourceCorrectionsRegression.test.ts` and merged to `main` at `620aaf7`. |
| Current Milestone: Documentation Reconciliation | Complete audit and realignment of all project documentation with verified state on `main` | IN_PROGRESS | Branch `docs/reconcile-project-documentation`; documentation-only modifications. |

---

## 8. Exact Next Recommended Action

1. Complete the documentation cross-reference audit for obsolete terms.
2. Run full verification commands (`npm run check:lines`, `npm run typecheck`, `npx vitest run`, `npm run build`, `git diff --check`).
3. Compile and deliver the final Documentation Reconciliation Report for owner review.
