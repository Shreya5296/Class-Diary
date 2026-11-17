# 10 — Testing and Acceptance Criteria

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** 10
- **Status:** Authoritative Quality Assurance Specification
- **Version:** 5.0.0 (Canonical Four-Table Datastore & Unified Workflows)
- **Last Verified Date:** 2026-11-17
- **Audience:** QA engineers, developers, AI coding agents

---

## 2. Test Strategy & Architecture

Testing enforces data integrity, security boundaries, business invariants, and the single-purpose micro-file rule.
All automated tests execute against synthetic mock environments and **never run destructive operations against the live production Google Sheet**.

```text
Test Layers:
1. Static Policy Checks: scripts/check-line-limits.js (Strictly <= 149 lines, 0 catch-alls)
2. Static Type Checks: TypeScript compiler (tsc --noEmit, strict mode)
3. Unit & Domain Tests: Vitest (MockSpreadsheet in-memory datastore)
4. Integration & Regression Suites: Vitest (Multi-domain lifecycles, renewal recovery, schedule locking)
5. End-to-End Tests: Playwright (Browser-driven UI and API verification)
```

---

## 3. Automated Test Organization

```text
tests/
├── mocks/
│   └── MockSpreadsheet.ts             # In-memory mock implementing Apps Script SpreadsheetApp
├── fixtures/
│   ├── syntheticData.ts               # Synthetic students, packages, sessions, payments
│   └── testDateHelpers.ts             # Deterministic future date generators
├── domains/                           # Domain business logic tests
│   ├── classesAndCredits.test.ts      # Class deduction & balance calculation
│   ├── earningsCalculations.test.ts   # Multi-currency financial aggregations
│   ├── packageCalculations.test.ts    # Package expiry & N-4 due date derivation
│   ├── yearlyPackageCalculations.test.ts # Yearly occurrence generation
│   ├── studentIdIntegrity.test.ts     # Sequential STU_001 ID integrity
│   ├── inactivityAndAttention.test.ts # Active/Inactive status classification
│   ├── studentRenewalCreditRollover.test.ts # Renewal rollover balance math
│   └── registrationFailureAndRecovery.test.ts # Idempotent registration retry
├── frontend/                          # Frontend component & helper tests
│   ├── apiClient.test.ts              # HTTP text/plain transport & error handling
│   ├── calendarViews.test.ts          # Day/Week/Month calendar views & event positioning
│   ├── formatters.test.ts             # Currency, date, and 12h time formatters
│   ├── studentRegistrationAndDirectory.test.ts # 4-section form validation
│   ├── studentRenewalWorkflow.test.tsx# Multi-step renewal modal interactions
│   ├── studentFinancialAccounting.test.tsx # Currency-grouped accounting UI
│   └── financesConsolidation.test.ts  # Consolidated finances page & summary cards
├── backend/                           # Apps Script backend tests
│   ├── apiEntry.test.ts               # doPost parsing & response envelope
│   ├── operationAdapters.test.ts      # OperationRouter handler mappings
│   ├── renewalRoutingAndBootstrap.test.ts # packages.renew & students.renew routing
│   ├── finalRenewalSafetyGates.test.ts # Fail-closed recovery & ScriptLock concurrency
│   ├── classSchedulePersistence.test.ts # Recurring schedule string serialization & locking
│   ├── approvedSourceCorrectionsRegression.test.ts # Adversarial renewal recovery & lock safety
│   └── securityHardening.test.ts      # HMAC-SHA256 signature verification & allowlist
├── schema/                            # Schema migration & integrity tests
│   ├── schemaValidation.test.ts       # 4 canonical tables header validation
│   ├── fourTableMigrationHarness.test.ts # Four-table datastore verification
│   └── absentOperationalTabsRegression.test.ts # Verifies system functions without legacy tabs
└── integration/                       # Multi-batch regression suites
    ├── batch2FixesRegression.test.ts  # Status badges, phone prefix escaping
    ├── batch3FixesRegression.test.ts  # Attendance deduction & rescheduling
    ├── batch4FixesRegression.test.ts  # Currency insulation & 12h local time mapping
    ├── batch5FixesRegression.test.ts  # Soft muted calendar styling, STU_005 active classification
    ├── finalizedWorkflowsLifecycle.test.ts # Full lifecycle verification
    └── calendarFinalFixRegression.test.ts # Unified 3-color status logic
```

---

## 4. Test & Verification Commands

```bash
# 1. Automated line-limit and catch-all policy check
npm run check:lines

# 2. Strict TypeScript type check (tsc --noEmit)
npm run typecheck

# 3. Unit, domain, and integration regression suite (Vitest)
npx vitest run

# 4. Production build verification (tsc && vite build)
npm run build

# 5. Git whitespace diff check
git diff --check
```

---

## 5. Current Test Suite Status

### Verified Test State: PASSED (75 test files passed, 651 tests passed)
As of 2026-11-17 on `main`:
- **Test Suites / Files:** 75 passed, 0 failed (75 total)
- **Tests:** 651 passed, 0 failed, 0 skipped (651 total)
- **TypeScript Compiler:** Passed with 0 errors
- **Production Build:** Passed, clean bundle in `dist/`
- **Line Limit Check:** Passed (198 files across `src` and `public` $\le 149$ lines, 0 catch-all files)
- **Whitespace / Diff Check:** Passed (0 errors)

### Deterministic Test Date Helpers (`tests/fixtures/testDateHelpers.ts`):
Unit test files use deterministic date helpers (`getNextWeekday`, `getFutureDate`) to compute future dates relative to execution time, ensuring tests remain deterministic and immune to calendar expiration.
