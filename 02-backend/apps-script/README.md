# Google Apps Script Backend

Backend API and business services for the Student Management Dashboard.

- **Last Verified Date:** 2026-11-17
- **Status:** Authoritative Backend Specification
- **Production Deployment:** Strictly frozen at version `@52`.

## Architecture
- Executed on Google Apps Script (V8 runtime).
- Deployed as a Web App (`doPost(e)` over HTTP POST with text/plain transport).
- Canonical datastore: strictly four physical Google Sheets tables (`Students`, `Packages`, `Payments`, `ClassSessions`) in one private Google Spreadsheet.
- Primary Timezone: `Asia/Kolkata` (IST, UTC+05:30).
- Authentication: HMAC-SHA256 signed session tokens verified against `ADMIN_AUTH_KEY` and allowlist (`ashreya0502@gmail.com`).

## Logical Structure
- `api/`: API entry point (`ApiEntry.gs`), request parsing, operation router, standard response factory.
- `auth/`: Identity verification, token cryptographic validation, admin allowlist authorization.
- `sheets/`: SheetRegistry, header mapper, row reader/writer, DateFormatService, LockManager with reentrancy.
- Domain folders: `students/`, `packages/`, `payments/`, `classes/`, `reports/`.
- `shared/`: ID generation, date/time formatting, money rounding, error codes.
- `config/`: Runtime configuration via ScriptProperties (`ConfigService.gs`).
- `setup/`: Database migrations and historical transition scripts.

## Production Restrictions
Production deployment `@52` is strictly frozen. No developer or AI agent is authorized to execute `clasp push` or `clasp deploy` without explicit authorization.
