# 04 — Business Services and Validation

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** Backend-04
- **Status:** Authoritative Backend Services & Validation Specification
- **Version:** 5.0.0 (Canonical Four-Table Datastore & Unified Workflows)
- **Last Verified Date:** 2026-11-17
- **Audience:** Backend engineers, developers, AI coding agents

---

## 2. Core Architectural Rules

1. All business decisions, calculations, and deductions are made on the backend.
2. Validate authentication and administrator allowlist before reading protected records or mutating sheets.
3. Validate request payload shape, types, and constraints before performing writes.
4. Validate entity relationships against persisted canonical sheets (`Students`, `Packages`, `Payments`, `ClassSessions`).
5. Concurrency protection: All conflicting writes (including `schedules.save` and `packages.renew`) must acquire the shared script lock via `LockManager.withLock`.
6. Return structured results using the API envelope (`ResponseFactory.gs`).
7. Preserve historical package and payment records. Renewals append new rows; voided payments physically remove the row and record durable tombstones.
8. Single responsibility: Keep services modular and aligned with domain boundaries.

---

## 3. Active Backend Service Inventory

The active backend services are organized into domain folders under `02-backend/apps-script/`:

- **`StudentService.gs` (`students/`):** Manages student identity (`STU_001` format), directory retrieval, status transitions (`ACTIVE`, `INACTIVE`, `ARCHIVED`), and `primary_meeting_link` persistence.
- **`PackageService.gs` (`packages/`):** Manages package CRUD, per-class rate calculations, N-4 fee due date derivations, and schedule string formatting.
- **`RenewalService.gs` (`packages/`):** Orchestrates package renewal workflows under shared ScriptLock. Appends new package rows while preserving historical packages, records optional payments, updates recurring schedules, and aligns future sessions.
- **`RenewalIdempotency.gs` (`packages/`):** Manages durable checkpoint persistence in `ScriptProperties` and enforces fail-closed recovery (`AMBIGUOUS_RENEWAL_RECOVERY`).
- **`ClassScheduleService.gs` (`classes/`):** Parses, validates, and persists recurring weekly schedules to `Packages.class_schedule` holding `LockManager.withLock`.
- **`PaymentService.gs` (`payments/`):** Manages payment recording (6-column physical schema), idempotency verification, physical row deletion on void, and durable tombstone persistence.
- **`ClassService.gs` (`classes/`):** Handles session scheduling, overlap conflict detection, attendance completion, deduction rules, cancellation with mandatory reason, automatic replacement scheduling, and in-place credit restoration.
- **`ReportService.gs` (`reports/`):** Computes financial summaries grouped strictly by currency, enforces debtor balance insulation, and handles manual `in_inr` aggregations.
- **`ConfigService.gs` (`config/`):** Exposes runtime parameters from Apps Script `ScriptProperties` with fallback defaults.
- **`LockManager.gs` (`sheets/`):** Provides concurrency control using `LockService.getScriptLock()` with execution-local reentrancy support.

*Retired Services (Preserved as Historical Fallback Only):* Legacy `enrollments/`, `fees/`, `notes/`, and `meeting-links/` handlers are superseded by the canonical 4-table architecture.

---

## 4. Standard Operation Lifecycle

Every protected backend operation follows this sequence:

1. Parse HTTP POST body via `RequestParser.gs`.
2. Authenticate caller and authorize against allowlist (`IdentityVerifier.gs`).
3. Validate payload parameters against domain validation schemas.
4. Load existing records via repository layer (`HeaderMapper.gs`, `RowReader.gs`).
5. For mutations requiring concurrency protection, acquire script lock via `LockManager.withLock(fn, timeoutMs)`.
6. Apply business rules and calculate derived values.
7. Persist row mutations via repository layer (`RowWriter.gs`).
8. If idempotency key is present, persist completion checkpoint in `ScriptProperties`.
9. Return standard success envelope or structured error envelope.

---

## 5. Domain Service Specifications

### 5.1 `StudentService`
- **Validation:** Requires non-blank student name, parent name, and parent phone (`StudentValidation.gs`). Escapes leading `+` on phone numbers.
- **Primary Meeting Link:** Validates URL scheme (strictly `https://`). Stored in `Students.primary_meeting_link`.
- **Status Classification:** Updates status column to `ACTIVE`, `INACTIVE`, or `ARCHIVED`.

### 5.2 `PackageService` & `RenewalService`
- **Canonical Schema:** 12 columns in `Packages`. No `package_id` column in sheet.
- **Dynamic Balance Derivation:** Aggregate student balance is derived by summing `classes_purchased` across all package rows for that student and subtracting all sessions where `deduct_class === true`.
- **Renewal Safety:**
  - Preserves historical package row intact.
  - Appends new package row storing solely the newly purchased classes.
  - Checkpoints: `intent`, `package_inserted`, `payment_inserted`, `completed`.
  - Fail-Closed: If ScriptProperties checkpoint is lost or row moved externally, fails closed with `AMBIGUOUS_RENEWAL_RECOVERY` to prevent duplicate writes.

### 5.3 `ClassScheduleService`
- **Storage:** Persists weekly recurring schedule patterns directly into `Packages.class_schedule`.
- **Concurrency Protection:** All write operations acquire the shared script lock via `LockManager.withLock`.
- **Reentrancy Support:** Tracks execution-local lock depth to allow nested calls (e.g. `RenewalService` calling `Schedules_save`) without self-deadlock.

### 5.4 `PaymentService`
- **Canonical Schema:** Exactly 6 columns in `Payments`: `student_id, student_name, payment_date, amount, currency, in_inr`.
- **No Physical Status Column:** There is no status column in the physical sheet.
- **Void Operation:** Locates matching row by student, amount, and date. Physically deletes the row via `sheet.deleteRow()`. Records durable tombstone `payment_void_<id>` in `ScriptProperties`. If multiple identical rows exist without unique discrimination, rejects with `AMBIGUOUS_RECORD`.

### 5.5 `ClassService`
- **Canonical Schema:** 9 columns in `ClassSessions`: `student_id, student_name, schedule_date, schedule_time, attendance_status, session_status, deduct_class, cancellation_reason, session_notes`.
- **Composite Session Key:** Identifies sessions by `student_id__schedule_date__schedule_time` (or 1-based row index `_rowIndex`).
- **Attendance Deduction:** `PRESENT` / `ATTENDED` sets `deduct_class = true`.
- **Cancellation:** Requires user-provided `cancellation_reason`, saved in column 8. `session_notes` (column 9) is preserved independently. If advance notice ($\ge 4$h) or waived, auto-schedules a replacement session at the next available recurring slot and extends package `end_date`.
- **Credit Restoration:** `Classes_restoreCredit` updates the existing session row in place setting `deduct_class = false`.

### 5.6 `ReportService`
- Groups all financial figures strictly by currency.
- Total Outstanding is $\max(0, \text{Total Package Payable} - \text{Total Recorded Payments})$. Never becomes negative.
- Excess payments are displayed separately as Available Credit.
- Foreign payments retain original currency; unconverted foreign amounts contribute 0 to INR totals.
