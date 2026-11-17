# 02 — Coding Agent Rules

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** Handoff-02
- **Status:** Authoritative AI Coding Agent Invariants
- **Version:** 5.0.0 (Canonical Four-Table Datastore & Unified Workflows)
- **Last Verified Date:** 2026-11-17
- **Audience:** AI coding agents, autonomous agents, developers

---

## 2. Non-Negotiable Source-of-Truth Hierarchy

Before making changes, inspect the actual source code and documentation. Follow this strict hierarchy:

1. **Actual Implementation Source of Truth:**
   The verified, running source code (`src/`, `02-backend/apps-script/`, configuration, and passing tests) on `main` is the primary source of truth for existing behavior.
2. **Approved Specifications (`00-documentation/`):**
   Governing system architecture, data model, business rules, API reference, and security boundaries.
3. **Domain Deep-Dives (`01-frontend/`, `02-backend/`, `03-data/`, `04-quality-and-operations/`):**
   Detailed contracts, schemas, test strategies, and operations.
4. **Handoff Documentation (`05-agent-handoff/`):**
   Project state, implementation sequence, and agent execution protocols.

*Rule:* If an older document contradicts current code or the four-table canonical schema, the current code and canonical schema take precedence. Document the discrepancy rather than implementing obsolete behavior.

---

## 3. The Strict Four-Table Datastore Restriction

The project has **strictly four physical Google Sheets tables**: `Students` (10 cols), `Packages` (12 cols), `Payments` (6 cols), and `ClassSessions` (9 cols).

An agent is **strictly prohibited** from:
- Creating or referencing new Google Sheets tables (e.g. `MeetingLinks`, `StudentNotes`, `ClassSchedules`, `FeeObligations`, `Enrollments`, `PackageHistory`, `StudentPayments`, `Attendance`, `Invoices`, `AppConfig`, etc.).
- Adding a `package_id` column to the `Packages` sheet. Packages are uniquely keyed by `student_id`.
- Adding a `session_id` or stored end-time column to the `ClassSessions` sheet. Sessions use composite key `student_id__schedule_date__schedule_time` (or 1-based row index) and end time is derived from `Packages.class_duration`.
- Adding a payment status column to `Payments`. Voiding physically removes the row via `sheet.deleteRow()` and records a durable tombstone in `ScriptProperties`.
- Storing recurring schedules in a separate sheet. Recurring schedules are stored directly inside `Packages.class_schedule`.

### 3.1 ClassSessions Row-Index Safety & Operational Rule
- The backend identifies sessions via composite key `student_id__schedule_date__schedule_time` and executes performant updates using 1-based row index (`_rowIndex`).
- **Limitation:** While `updates.student_id === rec.student_id` prevents cross-student corruption, it cannot detect shifted rows among sessions belonging to the same student if rows are altered directly in Google Sheets.
- **Operational Rule:** **Never manually sort, insert, delete, or rearrange `ClassSessions` rows while operations relying on cached row indices may be in progress.** Direct spreadsheet maintenance must occur only during scheduled offline windows.

---

## 4. Mandatory Micro-File Architecture

Every domain in `src/` and `public/` must consist of single-purpose micro-files. Each source file must remain strictly under 150 lines: **maximum 149 lines**.

This rule is mandatory and enforced by automated CI checks (`npm run check:lines`).

### 4.1 Required Practices
- Organize files by domain and single responsibility.
- Give each file one clear reason to change.
- Split components into presentation, hooks, types, validation, and API clients.
- Keep business rules out of presentation components.
- Keep CSS modules co-located with their owning component.
- Check line limits before and after editing files: `npm run check:lines`.

### 4.2 Prohibited Patterns
Do not create catch-all files:
- `utils.ts`, `helpers.ts`, `common.ts`
- `app.js`, `actions.js`, `api.ts` (catch-all for all endpoints)
- Monolithic CSS files
- Monolithic page components combining multiple domain workflows

Do not evade the limit by minifying code, concatenating statements onto single lines, or stripping comments.

---

## 5. Security and Data Protection Rules

- **Frontend Isolation:** The frontend must never access Google Sheets directly. All operations pass through the Apps Script backend.
- **Zero Secrets in Frontend:** Never place privileged credentials, service-account secrets, private tokens, or spreadsheet write credentials in frontend code or Git.
- **Server-Side Authorization:** Every protected backend operation must authenticate and authorize the caller using server-side HMAC-SHA256 session token verification.
- **Never Trust Client Flags:** Never trust frontend flags (`isAdmin`), client-supplied emails, or unvalidated parameters as proof of authorization.
- **Allowlist Enforcement:** Authorize only allowlisted administrators configured in backend Script Properties (`ashreya0502@gmail.com`).
- **Input Sanitization:** Validate and sanitize all inputs server-side. Escape leading `+`, `=`, `@`, or `-` characters on phone numbers and text to prevent formula injection in Google Sheets.
- **Production Deployment Freeze:** Production deployment `@52` is strictly frozen. No clasp deploy/push or live Google Sheets edits without authorization.

---

## 6. Business Logic and Technical Invariants

- **Timezone:** Use `Asia/Kolkata` (IST, UTC+05:30) consistently across all scheduling, calendar rendering, date parsing, and live headers.
- **Date Format:** User-facing and Google Sheets date format requirement is `dd/mm/yyyy`. Backend `HeaderMapper.gs` normalizes between `dd/mm/yyyy` and ISO `yyyy-mm-dd`.
- **Time Format:** Stored as 24-hour `HH:mm`; displayed in 12-hour AM/PM format.
- **Package Renewal:**
  - Preserves historical package row intact in `Packages`.
  - Appends a new package row storing solely the new purchase count.
  - Carried-forward classes do not increase renewal package price. Remaining classes are not monetary credit.
  - Aggregate available balance is dynamically derived across all student packages minus all consumed sessions.
- **Schedule Persistence & Concurrency:**
  - Stored in `Packages.class_schedule`.
  - All writes acquire shared ScriptLock via `LockManager.withLock`, supporting execution-local reentrancy.
- **Financial Accounting:**
  - Grouped strictly by currency across lifetime packages and recorded payments.
  - Outstanding is $\max(0, \text{Total Package Payable} - \text{Total Recorded Payments})$, never negative.
  - Excess payment is displayed separately as Available Credit.
  - Foreign payments retain original currency; unconverted foreign amounts contribute 0 to INR totals. Never call external exchange-rate APIs.
- **Attendance Deduction & Cancellation:**
  - `PRESENT` / `ATTENDED`: `deduct_class = true`.
  - `ABSENT` / `NO_SHOW`: user/owner specifies deduction (default false unless unexcused).
  - `NOT_MARKED`: `deduct_class = false`.
  - `CANCELLED`: Requires non-blank cancellation reason, saved to `ClassSessions.cancellation_reason`. `session_notes` preserved independently. Advance notice ($\ge 4$h) or credit waiver sets `deduct_class = false` and auto-schedules a replacement session.
  - `Classes_restoreCredit`: Updates session row in place setting `deduct_class = false`.

---

## 7. Verification and Testing Mandate

Before declaring any coding or documentation task complete, run the verification suite:
```bash
npm run check:lines    # Must pass (all files <= 149 lines, 0 catch-alls)
npm run typecheck      # Must pass (0 errors)
npm run build          # Clean production build (tsc && vite build)
npx vitest run         # Full test suite (75 files passed, 651 tests passed)
git diff --check       # Whitespace sanity check
```
Never alter application code during a documentation-only task.
