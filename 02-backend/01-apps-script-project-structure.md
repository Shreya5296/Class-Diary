# 02 Backend — 01 Apps Script Project Structure

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** Backend-01
- **Status:** Authoritative Backend Code Structure Specification
- **Version:** 5.0.0 (Strict Four-Table Architecture)
- **Last Verified Date:** 2026-11-17
- **Audience:** Backend engineers, developers, AI coding agents

---

## 2. Apps Script Architectural Rules

1. **Google Apps Script V8 Runtime:** Plain JavaScript compatible with Apps Script V8. Node.js built-ins (`fs`, `http`) and npm libraries do not exist in the GAS runtime.
2. **Single Entry Point (`doPost`):** All frontend API requests enter through `api/ApiEntry.gs`.
3. **Domain Organization:** Code in `02-backend/apps-script/` is organized into logical domain folders: handlers, services, repositories, and validators.
4. **Micro-File Modularization:** Each file maintains a single responsibility (handlers handle routing & input unpacking, services execute business logic & locking, repositories manage sheet rows, validators check constraints).

---

## 3. Directory & File Inventory (`02-backend/apps-script/`)

```text
02-backend/apps-script/
├── appsscript.json             # Manifest (V8 runtime, timeZone Asia/Kolkata, webApp permissions)
├── .claspignore                # Clasp deployment filter
├── README.md                   # Backend deployment guide
├── api/                        # HTTP transport & routing
│   ├── ApiEntry.gs             # doPost(e) & doGet(e) entry points, timing, error wrapping
│   ├── RequestParser.gs        # JSON envelope parsing, token extraction
│   ├── OperationRouter.gs      # Operation registry and dispatch
│   └── ResponseFactory.gs      # Standard success/error JSON response envelopes
├── auth/                       # Authentication & authorization
│   ├── IdentityVerifier.gs     # HMAC-SHA256 signature verification & mock guards
│   ├── AdminAuthorization.gs   # Admin allowlist check (ashreya0502@gmail.com)
│   └── TokenValidation.gs      # Token parsing & cryptographic verification
├── students/                   # Students domain (Table 1: 10 columns)
│   ├── StudentHandlers.gs      # students.list, get, create, update, archive, reactivate
│   ├── StudentService.gs       # Business rules, name normalization, primary_meeting_link
│   ├── StudentRepository.gs    # CRUD persistence for Students sheet (10 cols)
│   └── StudentValidation.gs    # Input validation (required names, phone format)
├── packages/                   # Packages domain (Table 2: 12 columns)
│   ├── PackageHandlers.gs      # packages.list, get, create, update, getBalance, renew, students.renew
│   ├── PackageService.gs       # Dynamic balance derivation, N-4 fee due date, schedule serialization
│   ├── PackageRepository.gs    # CRUD persistence for Packages sheet (12 cols, no package_id)
│   ├── PackageValidation.gs    # Package pricing & total classes validation
│   ├── RenewalService.gs       # Package renewal business logic under shared ScriptLock
│   ├── RenewalIdempotency.gs   # Checkpoint persistence & fail-closed recovery
│   ├── RenewalValidation.gs    # Input and expected package snapshot validation
│   ├── RenewalSessionTransition.gs # Future session alignment on renewal
│   └── IdempotencyRetention.gs # Durable idempotency cleanup and retention
├── payments/                   # Payments domain (Table 3: 6 columns)
│   ├── PaymentHandlers.gs      # payments.list, record, void
│   ├── PaymentService.gs       # Idempotency caching, currency validation, physical row deletion on void
│   ├── PaymentRepository.gs    # Persistence for Payments sheet (6 cols)
│   └── PaymentValidation.gs    # Amount > 0, date format validation
├── classes/                    # Class Sessions domain (Table 4: 9 columns)
│   ├── ClassHandlers.gs        # classes.list, schedule, batchSchedule, complete, cancel, restoreCredit
│   ├── ClassService.gs         # Session scheduling, conflict detection, attendance deduction, auto-replacement
│   ├── ClassRepository.gs      # Persistence for ClassSessions (9 cols, composite key matching, session_notes)
│   ├── ClassValidation.gs      # Session time & date validation
│   ├── ClassScheduleHandlers.gs# schedules.list, save
│   └── ClassScheduleService.gs # Recurring schedule string parser & persistence under shared ScriptLock
├── reports/                    # Reports domain
│   ├── ReportHandlers.gs       # dashboard.overview, reports.financialSummary
│   └── ReportService.gs        # Multi-currency financial aggregations & debtor insulation
├── sheets/                     # Core Google Sheets data access layer (Strictly 4 canonical tables)
│   ├── SheetRegistry.gs        # Canonical sheet names and expected headers (4 tables)
│   ├── HeaderMapper.gs         # Dynamic header name to index mapping, + escape, date conversion
│   ├── RowReader.gs            # Generic sheet record reading
│   ├── RowWriter.gs            # Generic row appending and update by key/index
│   ├── DateFormatService.gs    # Standardizes date format to dd/MM/yyyy
│   ├── LockManager.gs          # Concurrency protection with execution-local reentrancy support
│   ├── SpreadsheetProvider.gs  # Resolves active spreadsheet
│   ├── SpreadsheetBootstrap.gs # Creates canonical sheets if missing
│   └── SchemaValidator.gs      # Verifies headers against canonical schemas
├── config/                     # Configuration service
│   └── ConfigService.gs        # Reads runtime parameters from ScriptProperties (replaces AppConfig)
├── shared/                     # Shared helpers
│   ├── IdGenerator.gs          # Sequential STU_001 and entity ID generators
│   ├── DateTime.gs             # Timezone-safe date arithmetic
│   └── Money.gs                # Currency & rounding helpers
├── setup/                      # Migrations & maintenance operations
│   ├── FourTableMigration.gs   # Four-table datastore migration, backup & verification engine
│   ├── FinalCanonicalSchemaMigration.gs # Historical canonical migration
│   ├── StudentIdMigration.gs   # Migrated 23 legacy IDs to STU_001..STU_026
│   ├── StudentIdVerification.gs# Referential integrity verifier & rollback engine
│   ├── StudentIdPreflight.gs   # Read-only preflight analysis engine
│   ├── SystemHandlers.gs       # system.inspectTabs, migrateCanonicalSchemas, backdateStudentSessions
│   ├── SchemaMigration.gs      # Schema migration runner
│   └── RunBootstrap.gs         # Manual bootstrap runner
└── fees/                       # Deprecated legacy fallback fee service (preserved for backward compatibility)
```
