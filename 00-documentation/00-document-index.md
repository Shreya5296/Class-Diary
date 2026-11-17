# 00 — Document Index & Documentation Registry

## 1. Project Identification

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document set version:** 5.0.0 (Canonical Four-Table Realignment)
- **Status:** Authoritative documentation matching verified implementation on `main`
- **Last Verified Date:** 2026-11-17
- **Primary user:** One authorized administrator (`ashreya0502@gmail.com`)
- **Authentication:** Server-side HMAC-SHA256 signed session tokens via Apps Script Script Properties (`ADMIN_AUTH_KEY`)
- **Frontend:** React 18, TypeScript, Vite (Vercel SPA)
- **Backend:** Google Apps Script Web App (API, business logic & datastore operations)
- **Datastore:** Exactly FOUR physical Google Sheets tables in one private Google Spreadsheet
- **Primary Timezone:** `Asia/Kolkata` (IST, UTC+05:30)
- **Base Currency:** `INR` (multi-currency supported with original currency retained and manual `in_inr` conversion)

---

## 2. Documentation Architecture & Directory Map

```text
Personal Dashboard/
├── README.md                                    # Root project guide, architecture overview, and quickstart
├── running.txt                                  # Concise current project control document
├── 00-documentation/                            # Canonical system specifications
│   ├── 00-document-index.md                     # [Current] Document registry, classification, and authority map
│   ├── 01-product-requirements.md              # [Current] Product scope, active modules, user boundaries
│   ├── 02-system-architecture.md               # [Current] End-to-end architecture, boundaries, components, data flow
│   ├── 03-security-and-authentication.md       # [Current] HMAC-SHA256 token verification, allowlist, Script Properties
│   ├── 04-google-sheets-data-model.md          # [Current] Canonical 4-table schema, columns, IDs, normalization
│   ├── 05-business-rules-and-workflows.md      # [Current] Student, package, renewal, class, deduction, finance rules
│   ├── 06-apps-script-api-specification.md     # [Current] API operations, payloads, responses, validation, error codes
│   ├── 07-frontend-product-and-ui-specification.md # [Current] Screen layouts, navigation, forms, tables, modals
│   ├── 08-frontend-file-and-code-architecture.md  # [Current] Frontend tree, single-purpose micro-files (<= 149 lines)
│   ├── 09-data-import-and-migration.md         # [Historical] Legacy import pipeline (Retired in Phase 15)
│   ├── 10-testing-and-acceptance-criteria.md   # [Current] Quality gates, Vitest regression suite, line-limit checks
│   ├── 11-deployment-and-operations.md         # [Current] Vercel frontend, Apps Script clasp deployment, runbooks
│   ├── 12-implementation-agent-instructions.md # [Current] AI coding agent rules, 4-table restrictions, invariants
│   └── 13-glossary-and-architecture-decisions.md # [Current] Terminology, ADRs, schema history, and constraints
├── 01-frontend/                                # Frontend domain deep-dives
│   ├── 01-frontend-requirements.md             # [Current] Frontend functional requirements & navigation scope
│   ├── 02-design-system-and-ui-guidelines.md   # [Current] Visual tokens, typography, spacing, CSS architecture
│   ├── 03-pages-components-and-interactions.md # [Current] Component hierarchy, modals, tables, inline expansion
│   └── 04-frontend-state-and-data-flow.md      # [Current] Async state, API transport, caching, error boundaries
├── 02-backend/                                 # Backend domain deep-dives
│   ├── 01-apps-script-project-structure.md     # [Current] Apps Script file structure, handlers, services, repositories
│   ├── 02-api-contracts-and-error-handling.md  # [Current] Request envelope, response factory, error envelope
│   ├── 03-authentication-and-authorization.md  # [Current] Token verification, secret key, admin allowlist
│   ├── 04-business-services-and-validation.md  # [Current] Backend validation, lock manager, renewal idempotency
│   ├── 05-google-sheets-access-and-integrity.md# [Current] HeaderMapper, RowReader, RowWriter, DateFormatService
│   └── apps-script/README.md                   # [Current] clasp synchronization, manifest, deployment notes
├── 03-data/                                    # Datastore and schema deep-dives
│   ├── 01-master-spreadsheet-schema.md         # [Current] Master 4-table spreadsheet schema & physical column order
│   ├── 02-entity-relationships-and-data-dictionary.md # [Current] ER diagram, composite session ID, field dictionary
│   ├── 03-financial-and-class-balance-calculations.md # [Current] Dynamic class balance & multi-currency math
│   ├── 04-data-validation-and-schema-migrations.md    # [Current] Schema validation, FinalCanonicalSchemaMigration
│   └── 05-existing-sheets-import-and-reconciliation.md# [Historical] Legacy spreadsheet reconciliation
├── 04-quality-and-operations/                  # Quality assurance & operational runbooks
│   ├── 01-test-strategy-and-acceptance-criteria.md    # [Current] Test layers, mock spreadsheet, regression coverage
│   ├── 02-security-and-privacy-checklist.md    # [Current] Security release gates, formula injection guards
│   ├── 03-deployment-and-environment-configuration.md # [Current] Deployment procedure, Script Properties, Vercel
│   ├── 04-backup-and-recovery.md               # [Current] Spreadsheet backup runbook, rollback procedures
│   └── 05-maintenance-and-troubleshooting.md   # [Current] Common failure modes, Apps Script quota, diagnosis
├── 05-agent-handoff/                           # AI Agent and handoff documents
│   ├── 00-project-state.md                     # [Current] Durable project run state, current commit, snapshot
│   ├── 01-implementation-sequence.md           # [Current] Milestone sequence, completed phases, execution flow
│   ├── 02-coding-agent-rules.md                # [Current] Non-negotiable coding agent rules, 4-table restriction
│   ├── 03-definition-of-done.md                # [Current] Verification checklist and acceptance criteria
│   ├── 04-requirements-traceability.md         # [Current] Requirements to implementation verification matrix
│   ├── 05-autonomous-execution-protocol.md     # [Current] Autonomous execution guidelines and safety checks
│   ├── 06-configurable-business-policies.md    # [Current] ConfigService, ScriptProperties, non-configurable rules
│   └── 07-owner-setup-and-inputs.md            # [Current] Production secrets, spreadsheet IDs, owner checklist
└── docs/                                       # Project audit records and pre-launch migration archive
    ├── README.md                               # [Current] Navigation guide to canonical documentation
    ├── audits/                                 # Historical post-deployment audits & running.txt historical archive
    └── prelaunch/                              # Historical pre-launch migration proposals and field maps
```

---

## 3. Documentation Audit & Classification Register

| Document Path | Status | Summary of Content / Action Taken |
|---|---|---|
| `README.md` | **Current** | Updated to reflect 4-table datastore, micro-file rule, commands, and architecture. |
| `running.txt` | **Current** | Completely rewritten into concise project control document; historical milestones archived. |
| `00-documentation/00-document-index.md` | **Current** | Complete document inventory, classifications, and authority map. |
| `00-documentation/01-product-requirements.md` | **Current** | Scope across active functional modules; consolidated Finances; retired standalone MeetingLinks/Imports. |
| `00-documentation/02-system-architecture.md` | **Current** | Aligned architecture to 4-table datastore, HMAC-SHA256 auth, shared ScriptLock, and React. |
| `00-documentation/03-security-and-authentication.md` | **Current** | Verified server-side HMAC-SHA256 session tokens, allowlist, Script Properties, zero-GCP. |
| `00-documentation/04-google-sheets-data-model.md` | **Current** | Authoritative 4-table canonical schema. Verified absence of package_id, session_id, and payment status column. |
| `00-documentation/05-business-rules-and-workflows.md` | **Current** | Aligned renewal balance derivation, currency-grouped finances, payment voiding, cancellation reason, locking. |
| `00-documentation/06-apps-script-api-specification.md` | **Current** | Complete reference of registered backend operations (including packages.renew, students.renew, schedules.save). |
| `00-documentation/07-frontend-product-and-ui-specification.md` | **Current** | Matches actual UI navigation (Dashboard, Calendar, Students, Classes, Finances, Settings). |
| `00-documentation/08-frontend-file-and-code-architecture.md` | **Current** | Maps actual `src/` directory structure, domains, and strictly enforced <= 149 lines rule. |
| `00-documentation/09-data-import-and-migration.md` | **Historical** | Marked as permanently retired feature (retired in Phase 15). Preserved for project history. |
| `00-documentation/10-testing-and-acceptance-criteria.md` | **Current** | Documents Vitest regression suite (651 tests across 75 files), line limits, TypeScript strict check. |
| `00-documentation/11-deployment-and-operations.md` | **Current** | Details Vercel hosting, Apps Script clasp deployment, frozen version @52, Script Properties. |
| `00-documentation/12-implementation-agent-instructions.md` | **Current** | Rules for AI agents: 4-table restriction, micro-files, deterministic tests, schedule locking. |
| `00-documentation/13-glossary-and-architecture-decisions.md` | **Current** | Comprehensive glossary, ADR-01 through ADR-11 covering architecture, renewal, and locking. |
| `01-frontend/01-frontend-requirements.md` | **Current** | Functional requirements matching 5 navigation areas + settings; micro-file constraint. |
| `01-frontend/02-design-system-and-ui-guidelines.md` | **Current** | Visual tokens, layout rules, and component styling guidelines. |
| `01-frontend/03-pages-components-and-interactions.md` | **Current** | Detailed page interaction flows, renewal modal, attendance controls, and payment modal. |
| `01-frontend/04-frontend-state-and-data-flow.md` | **Current** | Asynchronous data flow, optimistic updates, error classification, and session storage. |
| `02-backend/01-apps-script-project-structure.md` | **Current** | Backend directory map, domain separation, 4-table repository responsibilities. |
| `02-backend/02-api-contracts-and-error-handling.md` | **Current** | Operation envelopes, error codes, payment void physical deletion, renewal contracts. |
| `02-backend/03-authentication-and-authorization.md` | **Current** | Cryptographic token verification, admin allowlist, and zero-GCP architecture. |
| `02-backend/04-business-services-and-validation.md` | **Current** | Business services, renewal idempotency, schedule lock reentrancy, attendance deduction. |
| `02-backend/05-google-sheets-access-and-integrity.md` | **Current** | SheetRegistry, HeaderMapper, RowReader, RowWriter, LockManager, DateFormatService. |
| `02-backend/apps-script/README.md` | **Current** | Backend clasp deployment guide and runtime notes. |
| `03-data/01-master-spreadsheet-schema.md` | **Current** | Master 4-table physical schemas, column orders, and data types. |
| `03-data/02-entity-relationships-and-data-dictionary.md` | **Current** | Direct relational model, composite session key, complete field dictionary. |
| `03-data/03-financial-and-class-balance-calculations.md` | **Current** | Currency-grouped accounting, dynamic class balance, renewal rollover math. |
| `03-data/04-data-validation-and-schema-migrations.md` | **Current** | Schema validation and milestone history (STU_001 migration, 4-table simplification). |
| `03-data/05-existing-sheets-import-and-reconciliation.md` | **Historical** | Legacy pre-launch spreadsheet reconciliation runbook. |
| `04-quality-and-operations/01-test-strategy-and-acceptance-criteria.md` | **Current** | Multi-tier test strategy, Vitest mock suites, Playwright E2E coverage. |
| `04-quality-and-operations/02-security-and-privacy-checklist.md` | **Current** | Formula injection guards, token verification, privacy audit checklist. |
| `04-quality-and-operations/03-deployment-and-environment-configuration.md` | **Current** | Deployment runbook, frozen @52 version distinction, rollback procedures. |
| `04-quality-and-operations/04-backup-and-recovery.md` | **Current** | Spreadsheet point-in-time backup, recovery, and data restoration runbook. |
| `04-quality-and-operations/05-maintenance-and-troubleshooting.md` | **Current** | Apps Script quota limits, error diagnosis, and recovery runbooks. |
| `05-agent-handoff/00-project-state.md` | **Current** | Authoritative durable run state, current commit `620aaf7`, 651 passing tests. |
| `05-agent-handoff/01-implementation-sequence.md` | **Current** | Complete milestone sequence, completed development phases, and execution rules. |
| `05-agent-handoff/02-coding-agent-rules.md` | **Current** | Non-negotiable coding agent rules, 4-table restrictions, micro-file rules. |
| `05-agent-handoff/03-definition-of-done.md` | **Current** | Verification gates, line limits, zero error typecheck, clean build, test suites. |
| `05-agent-handoff/04-requirements-traceability.md` | **Current** | Traceability matrix linking requirements to actual implementation files and tests. |
| `05-agent-handoff/05-autonomous-execution-protocol.md` | **Current** | Autonomous agent rules, safety boundaries, and task completion protocols. |
| `05-agent-handoff/06-configurable-business-policies.md` | **Current** | ScriptProperties configuration vs fixed business invariants. |
| `05-agent-handoff/07-owner-setup-and-inputs.md` | **Current** | Owner inputs, deployment readiness checklist, and production secrets register. |
| `docs/README.md` | **Current** | Root navigation guide for canonical specifications and historical archives. |
| `docs/audits/post-deployment-audit.md` | **Historical** | Post-deployment audit from earlier Version @23 milestone (labeled historical). |
| `docs/audits/running-historical-archive.md` | **Historical** | Complete historical milestone archive from original running.txt (labeled historical). |
| `docs/prelaunch/*` (11 files) | **Historical** | Pre-launch proposals, maps, and decision logs (each labeled with historical banner). |
