# 03 — Definition of Done

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** Handoff-03
- **Status:** Authoritative Verification Gate Specification
- **Version:** 5.0.0 (Canonical Four-Table Datastore & Unified Workflows)
- **Last Verified Date:** 2026-11-17
- **Audience:** Developers, QA engineers, AI coding agents

---

## 2. Product and Architecture Completion

- [x] Single authorized administrator sign-in and sign-out via HMAC-SHA256 session tokens.
- [x] Only allowlisted administrator (`ashreya0502@gmail.com`) can access protected data and endpoints.
- [x] Five primary operational modules plus settings implemented:
  - **Dashboard:** Operational metrics, today's classes with direct Join Class action, attention alerts, weekly schedule view.
  - **Calendar:** 7-day Google Calendar style time grid, day view, month view, 3-color status classification.
  - **Students:** Directory with Active/Inactive tabs, multi-subject select, 4-section registration, inline expandable details, edit student modal, primary meeting link management, and multi-step package renewal modal.
  - **Class Schedule:** Chronological sessions list, attendance control (Attended, No-Show, Cancel with required reason, Restore Credit), student filtering, session notes modal, and auto-schedule modal with conflict detection.
  - **Finances:** Unified billing and payments ledger, 3 summary cards (Total Invoiced, Collected Earnings, Outstanding Balance), Student Balances table with Add Payment modal, and Payment History table with search, date filters, and CSV export.
  - **Settings / Account:** Regional preferences, live header time in `Asia/Kolkata`, session logout.
- [x] All legacy routes (`fees`, `reports`) redirect cleanly to consolidated `Finances`.
- [x] Standalone `MeetingLinks`, `StudentNotes`, and `Imports` pages permanently retired. Meeting links are managed directly in the `Students` screen; notes are in `ClassSessions.session_notes`.

---

## 3. Data Integrity and Google Sheets Schema

- [x] The Google Spreadsheet contains **strictly the four canonical tables**:
  1. `Students` (10 cols, includes `primary_meeting_link`)
  2. `Packages` (12 cols, includes `class_schedule`)
  3. `Payments` (6 cols, no physical status column)
  4. `ClassSessions` (9 cols, includes `cancellation_reason` and `session_notes`)
- [x] No `package_id` in `Packages`; keyed by `student_id`. Historical package rows preserved on renewal.
- [x] No `session_id` or stored end-time in `ClassSessions`; keyed by `student_id__schedule_date__schedule_time` (or row index); duration loaded from `Packages.class_duration`.
- [x] No payment status column in `Payments`; voiding physically removes the row via `sheet.deleteRow()` and records a durable tombstone in `ScriptProperties`.
- [x] Dynamic header mapping via `HeaderMapper.gs` avoids reliance on hardcoded column letters.
- [x] Dates normalized between Sheets `dd/mm/yyyy` and ISO `yyyy-mm-dd`. Leading `+` or `=` escaped.
- [x] Class balances derived dynamically across all student packages minus consumed sessions (`deduct_class === true`).
- [x] Non-deducted cancellations trigger automatic replacement session scheduling at the next recurring slot and extend package `end_date`.
- [x] Financial figures grouped strictly by currency; excess payment is Available Credit; outstanding balance is never negative.
- [x] Recurring weekly schedules in `Packages.class_schedule` protected by shared ScriptLock with reentrancy support.

---

## 4. Code Quality and File Architecture

- [x] Every source file in `src/` and `public/` is strictly $\le 149$ lines (`npm run check:lines` passes, 198 files checked).
- [x] Zero catch-all files (`utils.ts`, `helpers.ts`, `app.js`, etc.).
- [x] Strict TypeScript check passes with zero errors (`npm run typecheck`).
- [x] Automated test suite passes with 100% green exit code 0 (`npx vitest run`: 75 test files passed, 651 tests passed).
- [x] Clean production build completes (`npm run build`).
- [x] Git whitespace diff check passes (`git diff --check`).

---

## 5. Security and Operations

- [x] Frontend never connects directly to Google Sheets API.
- [x] Zero credentials or private keys in client bundle or Git.
- [x] Backend scripts run under administrator execution context with server-side HMAC-SHA256 authorization.
- [x] ScriptProperties used for runtime configuration (`ADMIN_AUTH_KEY`, `ADMIN_EMAILS`, etc.).
- [x] Backend production deployment `@52` is strictly frozen. No unauthorized clasp push/deploy.
