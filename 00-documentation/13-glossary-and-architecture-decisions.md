# 13 — Glossary and Architecture Decisions

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** 13
- **Status:** Authoritative Glossary & ADR Specification
- **Version:** 5.0.0 (Canonical Four-Table Datastore & Unified Workflows)
- **Last Verified Date:** 2026-11-17
- **Audience:** Developers, architects, AI coding agents

---

## 2. Terminology & Business Glossary

- **Active Student:** A student whose status is not `INACTIVE` or `ARCHIVED`, who has remaining package balance ($> 0$), and whose last completed class occurred $< 1$ calendar month ago (or who has 0 completed classes).
- **Available Credit:** Monetary surplus when total recorded payments exceed total package payable for a student in a specific currency ($\max(0, \text{Total Paid} - \text{Total Payable})$).
- **Canonical Datastore:** The single private Google Spreadsheet containing strictly four active tables (`Students`, `Packages`, `Payments`, `ClassSessions`).
- **Class Duration:** Duration of each individual class session in minutes (default `60`), stored in `Packages.class_duration`. Used to derive session end time.
- **Class Schedule String:** Human-readable recurring weekly schedule string (e.g. `Mon - 6:00 PM, Wed - 6:00 PM, Sat - 10:00 AM`) stored directly inside `Packages.class_schedule`.
- **Composite Session Key:** Synthetic in-memory identifier for class sessions formatted as `student_id__schedule_date__schedule_time` (e.g. `STU_001__2026-01-19__18:00`).
- **Consumed Classes:** Count of all `ClassSessions` rows for a student where `deduct_class === true` (or `'TRUE'`).
- **Deduct Class (`deduct_class`):** Boolean column in `ClassSessions` indicating whether the class consumes 1 credit from the student's package balance.
- **Manual `in_inr`:** The numeric column in `Payments` representing the manually verified INR-equivalent amount for foreign currency transactions.
- **N-4 Rule:** The automated business rule calculating a package's `next_due_date` as the date of the 4th session before package completion ($\text{index} = \max(0, N - 5)$).
- **Outstanding Amount:** Net unpaid balance for a student in a specific currency: $\max(0, \text{Total Payable} - \text{Total Paid})$. Never negative.
- **Permanent Student ID:** Immutable sequential student identifier generated as `STU_001`, `STU_002`, ..., `STU_026`.
- **Primary Meeting Link:** Single virtual meeting URL stored directly in `Students.primary_meeting_link`.
- **Renewal Package Preservation:** Invariant that historical package rows are preserved intact upon renewal; the renewal appends a new package row.
- **Replacement Session:** A new class session automatically generated at the next available recurring schedule slot when a session is cancelled with advance notice or credit waiver.
- **Session Notes:** Pedagogical coverage, topics covered, and teacher remarks stored directly in `ClassSessions.session_notes`.
- **Unified 3-Color Event Logic:** Calendar visualization standard:
  - Soft Muted Green (`PAST_COMPLETED`): Attended/completed past sessions.
  - Soft Muted Red (`CANCELLED`): Explicitly cancelled sessions or uncompleted past sessions.
  - Amber / Warm Accent (`UPCOMING`): Scheduled future sessions and recurring placeholders.

---

## 3. Architecture Decision Records (ADRs)

### ADR-01: Four Canonical Google Sheets Tables Only
- **Context:** Earlier versions maintained separate `MeetingLinks` and `StudentNotes` tables alongside `Students`, `Packages`, `Payments`, and `ClassSessions`.
- **Decision:** Consolidate the physical datastore into strictly four tables: `Students` (10 cols), `Packages` (12 cols), `Payments` (6 cols), and `ClassSessions` (9 cols). Meeting links are embedded into `Students.primary_meeting_link` and notes into `ClassSessions.session_notes`. Standalone MeetingLinks and StudentNotes tables and frontend page are eliminated.
- **Rationale:** Greatly reduces relational complexity, avoids fragmented updates across disparate sheets, and allows teachers to manage links directly from Students and lesson coverage directly on scheduled classes.

### ADR-02: Zero-GCP Server-Side HMAC-SHA256 Authentication
- **Context:** Setting up Google Cloud Console OAuth consent screens and client credentials creates external operational dependencies.
- **Decision:** Use server-side HMAC-SHA256 signed session tokens verified against an allowlist and `ADMIN_AUTH_KEY` stored in Apps Script `ScriptProperties`.
- **Rationale:** Eliminates GCP dependencies, allows zero-configuration backend deployments, and securely restricts access to `ashreya0502@gmail.com`.

### ADR-03: Composite Session Key and Session Notes for ClassSessions
- **Context:** The `ClassSessions` sheet contains no `session_id` column and no stored end-time column.
- **Decision:** Identify sessions by composite key `student_id__schedule_date__schedule_time` or row index; derive end time dynamically from `Packages.class_duration`; store lesson coverage and pedagogical remarks in `ClassSessions.session_notes`.
- **Rationale:** Preserves the canonical 9-column spreadsheet layout while enabling robust single-session attendance and notes updates.

### ADR-04: Embedding Recurring Schedules into `Packages.class_schedule`
- **Context:** Maintaining a separate `ClassSchedules` sheet caused synchronization drift during student updates.
- **Decision:** Embed recurring schedule strings directly into column 12 of `Packages`. Archive `ClassSchedules` as `_Archived_ClassSchedules`.
- **Rationale:** Ensures package terms and schedule patterns are updated atomically in one row.

### ADR-05: Consolidation of Fees and Reports into Finances
- **Context:** Older navigation split billing into separate "Fees" and "Reports" screens.
- **Decision:** Consolidate all financial operations into one unified `FinancesPage` with summary cards, Student Balances table with Add Payment modal, and Payment History table.
- **Rationale:** Dramatically improves operational clarity and provides a single ledger for all billing and collection workflows.

### ADR-06: Retirement of Bulk Import Pipeline
- **Context:** A complex bulk import pipeline (`ImportBatches`, `ImportRowResults`) existed for initial data ingestion.
- **Decision:** In Phase 15, permanently retire the bulk import UI and handlers.
- **Rationale:** After initial pre-launch migration was complete, routine student management is performed via the 4-section Add Student modal.

### ADR-07: Mandatory Micro-File Architecture (Strictly $\le 149$ Lines)
- **Context:** Large monolithic components become unmaintainable and prone to merge conflicts.
- **Decision:** Enforce a strict file length limit of 149 lines across all source files in `src/` and `public/` via automated CI check (`npm run check:lines`).
- **Rationale:** Forces clear separation of concerns, modularity, and high maintainability.

### ADR-08: Timezone Canonicalization to `Asia/Kolkata`
- **Context:** Past sessions suffered from naive UTC string concatenation causing 11:30 PM midnight shifts.
- **Decision:** Establish `Asia/Kolkata` (IST, UTC+05:30) as the authoritative timezone across all scheduling, calendar rendering, date parsing, and live headers.
- **Rationale:** Guarantees that local class times (e.g. 6:00 PM IST) are preserved consistently across all client environments.

### ADR-09: Multi-Currency Preservation without External Exchange Rates
- **Context:** Tutoring clients pay in multiple currencies (INR, USD, GBP, EUR).
- **Decision:** Retain original transaction currency in `Payments.currency` and require manual entry for `in_inr`. Never call third-party exchange rate APIs.
- **Rationale:** Prevents arbitrary financial balance fluctuations and ensures accounting totals match bank deposits exactly.

### ADR-10: Package Renewal Historical Preservation & Dynamic Aggregate Balance Derivation
- **Context:** Early designs considered mutating the existing package row or resetting balances upon renewal.
- **Decision:** When a package is renewed, the historical package row is preserved untouched in `Packages`. A new package row is appended storing only the new purchase. Aggregate available class balance is dynamically derived across all student packages minus all consumed sessions. Carried-forward classes do not increase the renewal package price.
- **Rationale:** Completely preserves historical billing and class records, avoids destructive updates, and provides a clear audit trail.

### ADR-11: Shared ScriptLock on Recurring Schedule Writes & Reentrant Locking
- **Context:** Standalone schedule updates via `schedules.save` could potentially race with package renewals or other package writers.
- **Decision:** All writers to `Packages.class_schedule` (including `Schedules_save` and `RenewalService`) acquire the shared script lock via `LockManager.withLock`. `LockManager.withLock` supports execution-local reentrancy so nested locking within the same execution context does not deadlock.
- **Rationale:** Guarantees atomicity and eliminates concurrency races on the Packages sheet.
