# 04 — Requirements Traceability

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** Handoff-04
- **Status:** Authoritative Requirements-to-Test Traceability Matrix
- **Version:** 5.0.0 (Canonical Four-Table Datastore & Unified Workflows)
- **Last Verified Date:** 2026-11-17
- **Audience:** Developers, QA engineers, AI coding agents

---

## 2. Traceability Principles

1. Every required capability maps to an implementation area and an automated verification test.
2. The authoritative implementation on `main` is verified with 651 passing tests across 75 test files.
3. The datastore consists strictly of the four canonical tables: `Students`, `Packages`, `Payments`, and `ClassSessions`.
4. Operational tabs (`Enrollments`, `FeeObligations`, `ClassSchedules`, `MeetingLinks`, `StudentNotes`, `AppConfig`, `ImportBatches`, `ImportRowResults`) are permanently retired.

---

## 3. Product Requirement Traceability Matrix

| Req ID | Requirement Description | Authoritative Spec | Merged Implementation | Verification Test | Status |
|---|---|---|---|---|---|
| **PR-01** | Secure administrator sign-in & session token | `00-documentation/03-security-and-authentication.md` | `auth/IdentityVerifier.gs`, `src/auth/` | `tests/backend/securityHardening.test.ts`, `tests/frontend/auth.test.ts` | **VERIFIED** |
| **PR-02** | Student directory & sequential identity (`STU_xxx`) | `00-documentation/04-google-sheets-data-model.md` | `students/StudentService.gs`, `src/domains/students/` | `tests/domains/studentIdIntegrity.test.ts`, `tests/frontend/studentRegistrationAndDirectory.test.ts` | **VERIFIED** |
| **PR-03** | Primary meeting link embedded in student record | `00-documentation/04-google-sheets-data-model.md` | `students/StudentRepository.gs` (`col 10`), `EditStudentLinksSection.tsx` | `tests/schema/fourTableMigrationHarness.test.ts`, `tests/frontend/meetingLinksAndStudentDetailsFixes.test.ts` | **VERIFIED** |
| **PR-04** | Active & inactive student lifecycle classification | `00-documentation/05-business-rules-and-workflows.md` | `studentStatusClassifier.ts`, `studentApi.ts` | `tests/domains/inactivityAndAttention.test.ts`, `tests/frontend/studentStatusAndCalendarSync.test.ts` | **VERIFIED** |
| **PR-05** | Package creation & term management (12 cols) | `00-documentation/04-google-sheets-data-model.md` | `packages/PackageService.gs`, `PackageRepository.gs` | `tests/domains/packageCalculations.test.ts`, `tests/backend/operationAdapters.test.ts` | **VERIFIED** |
| **PR-06** | Package renewal historical preservation | `00-documentation/05-business-rules-and-workflows.md` | `packages/RenewalService.gs`, `StudentRenewalModal.tsx` | `tests/backend/approvedSourceCorrectionsRegression.test.ts`, `tests/frontend/studentRenewalSafetyAndLifecycle.test.tsx` | **VERIFIED** |
| **PR-07** | Renewal idempotency & fail-closed recovery | `00-documentation/05-business-rules-and-workflows.md` | `packages/RenewalIdempotency.gs` | `tests/backend/finalRenewalSafetyGates.test.ts`, `tests/backend/renewalRoutingAndBootstrap.test.ts` | **VERIFIED** |
| **PR-08** | Dynamic class balance derivation across packages | `00-documentation/05-business-rules-and-workflows.md` | `useStudentAggregates.ts`, `PackageService.gs` | `tests/domains/studentRenewalCreditRollover.test.ts`, `tests/domains/classesAndCredits.test.ts` | **VERIFIED** |
| **PR-09** | Recurring schedule persistence & shared ScriptLock | `00-documentation/05-business-rules-and-workflows.md` | `classes/ClassScheduleService.gs`, `LockManager.gs` | `tests/backend/classSchedulePersistence.test.ts`, `tests/backend/approvedSourceCorrectionsRegression.test.ts` | **VERIFIED** |
| **PR-10** | Currency-grouped financial accounting | `00-documentation/05-business-rules-and-workflows.md` | `studentFinancialAccounting.ts`, `ReportService.gs` | `tests/frontend/studentFinancialAccounting.test.tsx`, `tests/domains/earningsCalculations.test.ts` | **VERIFIED** |
| **PR-11** | Payment recording with idempotency (6 cols) | `00-documentation/06-apps-script-api-specification.md` | `payments/PaymentService.gs`, `AddPaymentModal.tsx` | `tests/frontend/paymentSafetyAdversarial.test.ts`, `tests/domains/paymentAndInvoiceSafety.test.ts` | **VERIFIED** |
| **PR-12** | Payment void physical deletion & tombstone | `00-documentation/05-business-rules-and-workflows.md` | `payments/PaymentService.gs` (`Payments_void`) | `tests/backend/approvedSourceCorrectionsRegression.test.ts`, `tests/frontend/financesRefinements.test.ts` | **VERIFIED** |
| **PR-13** | Class attendance marking & credit deduction | `00-documentation/05-business-rules-and-workflows.md` | `classes/ClassService.gs`, `AttendanceControl.tsx` | `tests/integration/batch3FixesRegression.test.ts`, `tests/domains/classesAndCredits.test.ts` | **VERIFIED** |
| **PR-14** | Cancellation reason & replacement scheduling | `00-documentation/05-business-rules-and-workflows.md` | `classes/ClassService.gs`, `CancelClassModal.tsx` | `tests/backend/approvedSourceCorrectionsRegression.test.ts`, `tests/integration/batch3FixesRegression.test.ts` | **VERIFIED** |
| **PR-15** | Pedagogical session notes independent logging | `00-documentation/04-google-sheets-data-model.md` | `classes/ClassRepository.gs` (`col 9`), `ClassesPage.tsx` | `tests/schema/fourTableMigrationHarness.test.ts`, `tests/frontend/schedulePersistenceAndFeedback.test.ts` | **VERIFIED** |
| **PR-16** | 7-day Google Calendar time grid & 3-color logic | `00-documentation/07-frontend-product-and-ui-specification.md` | `calendarClassification.ts`, `WeeklyTimeGrid.tsx` | `tests/frontend/calendarViews.test.ts`, `tests/integration/calendarFinalFixRegression.test.ts` | **VERIFIED** |
| **PR-17** | Four-table physical datastore integrity | `00-documentation/04-google-sheets-data-model.md` | `sheets/SheetRegistry.gs`, `SchemaValidator.gs` | `tests/schema/schemaValidation.test.ts`, `tests/schema/absentOperationalTabsRegression.test.ts` | **VERIFIED** |
| **PR-18** | Micro-file architecture ($\le 149$ lines) | `00-documentation/08-frontend-file-and-code-architecture.md` | `scripts/check-line-limits.js`, all files | `npm run check:lines` (198 files verified $\le 149$ lines) | **VERIFIED** |

---

## 4. Canonical Tables Traceability

| Canonical Table | Physical Columns | Responsibility | Data-Access Repository |
|---|---|---|---|
| **`Students`** | 10 | Primary directory, contacts, enrolled subjects, status, primary virtual meeting link | `students/StudentRepository.gs` |
| **`Packages`** | 12 | Plan type, currency, package price, rate, classes purchased, dates, duration, recurring schedule string | `packages/PackageRepository.gs` |
| **`Payments`** | 6 | Payment date, original amount, currency, manual INR equivalent. No physical status column. | `payments/PaymentRepository.gs` |
| **`ClassSessions`** | 9 | Schedule date, 24h start time, attendance status, session status, deduct_class, cancellation reason, session notes | `classes/ClassRepository.gs` |

---

## 5. Summary of Verification Status

All 18 core requirements and quality constraints are **100% VERIFIED** against the merged codebase on `main` at commit `620aaf7`.
- Automated test suite: 75/75 test files passed, 651/651 tests passed.
- TypeScript strict compiler: 0 errors.
- Line limit policy check: 0 violations across 198 files.
- Production build: Clean bundle generated in `dist/`.
- Deployment version: Strictly frozen at `@52`.
