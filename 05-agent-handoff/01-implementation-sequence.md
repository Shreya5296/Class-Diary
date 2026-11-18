# 01 — Implementation Sequence

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** Handoff-01
- **Status:** Authoritative Milestone Implementation Sequence
- **Version:** 5.0.0 (Post-Audit Canonical Four-Table Architecture)
- **Last Verified Date:** 2026-11-17
- **Audience:** Developers, AI coding agents, technical reviewers

---

## 2. Governing Architecture & Decisions

- **Frontend:** React 18, TypeScript, Vite SPA hosted on Vercel.
- **Backend:** Google Apps Script Web App (V8 runtime) via HTTP POST text/plain transport.
- **Canonical Datastore:** Strictly four physical Google Sheets tables (`Students`, `Packages`, `Payments`, `ClassSessions`).
- **Authentication:** Server-side HMAC-SHA256 session tokens verified against `ADMIN_AUTH_KEY` and allowlist (`ashreya0502@gmail.com`).
- **Micro-File Policy:** Every file under `src/` and `public/` must remain $\le 149$ lines (`npm run check:lines`).

---

## 3. Milestone Execution Register

The implementation sequence has transitioned through the following distinct milestones:

### 3.1 Completed Milestones (Merged into `main`)

| Phase / Milestone | Status | Key Deliverables & Evidence |
|---|---|---|
| **Phase 0–12: Core MVP Foundation** | **COMPLETED** | Tooling, TypeScript strict mode, Apps Script API foundation, student & package services, Vitest test suite. |
| **Phase 13–16: Tab Retirement & Config Decoupling** | **COMPLETED** | Retired `AppConfig`, `ImportBatches`, `ImportRowResults`. Replaced with `ConfigService.gs` reading from `ScriptProperties`. |
| **Phase 17–22: Unified Finances & Ledger Consolidation** | **COMPLETED** | Merged separate fees and reports screens into unified `FinancesPage.tsx` with summary cards, Student Balances table, and Payment History table. |
| **Phase 23–27: Student ID Standardization** | **COMPLETED** | Migrated 23 legacy student IDs to sequential `STU_001` through `STU_026` across all tables. Backup preserved in `StudentId_Migration_Backup`. |
| **Phase 28–39: Scheduling, Calendar & Registration Recovery** | **COMPLETED** | 4-section student registration, recurring schedules in `Packages.class_schedule`, 7-day Google Calendar time grid, 3-color status logic, async schedule worker. |
| **Four-Table Datastore Simplification** | **COMPLETED** | Permanently retired `MeetingLinks` and `StudentNotes` tables. Embedded primary link in `Students.primary_meeting_link` (10 cols) and session notes in `ClassSessions.session_notes` (9 cols). |
| **Package Renewal & Concurrency Hardening** | **COMPLETED** | Multi-step `StudentRenewalModal`, historical package row preservation, aggregate balance derivation across packages, shared ScriptLock on schedule writes and renewals. Merged at commit `620aaf7`. |

### 3.2 Retired & Superseded Architectures

The following features were permanently retired from active implementation:
- **Bulk Data Import & Reconciliation:** UI, preview tables, and batch handlers retired in Phase 15. Student onboarding is handled directly via `AddStudentModal.tsx`.
- **Fee Obligations & Invoices:** Intermediate fee obligation records retired in favor of direct package pricing and recorded payments.
- **Standalone Meeting Links Sheet & Page:** Retired and consolidated into `Students.primary_meeting_link` and `EditStudentLinksSection.tsx`.
- **Standalone Student Notes Sheet:** Retired and consolidated into `ClassSessions.session_notes` for per-session coverage.
- **Separate ClassSchedules Sheet:** Archived; recurring weekly schedules stored directly in `Packages.class_schedule`.

### 3.3 Active Milestone: Documentation Reconciliation

- **Branch:** `docs/reconcile-project-documentation`
- **Scope:** Complete documentation audit and reconciliation aligning all project documents with the verified merged code on `main`.
- **Restrictions:** Documentation only (`*.md` and `running.txt`). Zero code, test, configuration, or production deployment modifications.

---

## 4. Verification Gates for Completed Work

Before any future work is accepted:
1. `npm run check:lines` passes (all source files $\le 149$ lines).
2. `npm run typecheck` passes (`tsc --noEmit`, 0 errors).
3. `npx vitest run` passes (all 75 test files and 651 tests pass).
4. `npm run build` passes (`tsc && vite build`).
5. `git diff --check` passes (clean whitespace).
