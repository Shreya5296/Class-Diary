# 06 — Configurable Business Policies

## 1. Document Control & Purpose

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** 05-06
- **Status:** Authoritative Configurable Business Policies Specification
- **Version:** 5.0.0
- **Last Updated:** 2026-11-17

This document defines which operational policies and parameters are configurable, where they are stored, how they are validated, and which business rules remain strictly fixed in application code.

Configuration supports legitimate operational preferences without requiring code changes. It must not bypass authorization, weaken data integrity, or alter historical calculations silently.

## 2. Configuration Storage Architecture

The obsolete on-sheet `AppConfig` tab was **permanently retired** in Phase 16.

All runtime configuration is managed through **`ConfigService.gs`**, which reads from **Apps Script `ScriptProperties`** with safe in-code defaults:

```text
Configuration Hierarchy:
1. Fixed Security & Data Invariants (Code & Schemas)
2. Apps Script ScriptProperties (Server-side environment configuration)
3. In-Code Default Constants (APP_DEFAULTS in ConfigService.gs)
4. Frontend Public Environment Variables (Vite public config)
```

### 2.1 Backend Script Properties (Authoritative)

| Property Key | Type | Description | Default |
|---|---|---|---|
| `ADMIN_AUTH_KEY` | String (Secret) | HMAC-SHA256 secret key for signing session tokens | Required for auth |
| `ADMIN_EMAILS` | Comma-delimited | Allowlist of authorized administrator emails | `ashreya0502@gmail.com` |
| `SCHEMA_VERSION` | String | Current canonical schema version | `2.0.0` |
| `DEFAULT_TIMEZONE` | String (IANA) | System time zone for scheduling & calendar | `Asia/Kolkata` |
| `DEFAULT_CURRENCY` | String (ISO) | Default billing currency | `INR` |
| `DEFAULT_CLASS_DURATION_MINUTES` | Integer string | Default session duration in minutes | `60` |

### 2.2 Frontend Runtime & Environment Variables

| Variable | Environment | Description |
|---|---|---|
| `VITE_APPS_SCRIPT_URL` | Public (Build/Env) | Published Web App URL (`https://script.google.com/macros/s/.../exec`) |
| `VITE_USE_MOCK_DATA` | Local Dev / Test | Set to `true` to run against local in-memory mock store |
| `VITE_APP_TITLE` | Public (Build/Env) | Application title in header |

*Security Rule:* No private API keys, service account credentials, or database secrets are ever stored in frontend environment variables.

## 3. Fixed Business Invariants (Non-Configurable)

The following rules are structural and cannot be overridden by configuration:
1. **The Four-Table Datastore:** Only `Students`, `Packages`, `Payments`, and `ClassSessions` exist. Meeting links are embedded into `Students.primary_meeting_link` and lesson notes into `ClassSessions.session_notes`.
2. **Package Identity:** Packages are linked by `student_id`. No `package_id` exists in the Google Sheet.
3. **Session Identity:** Sessions are keyed by composite `student_id__schedule_date__schedule_time` (or row index). No `session_id` exists in the Google Sheet.
4. **Attendance Deduction:** Attended sessions (`PRESENT`/`ATTENDED`) deduct 1 class credit. Non-deducted cancellations preserve the credit and require an explicit cancellation reason. Automatic replacement session scheduling on cancellation is an optional future capability; current production behavior leaves rescheduling to manual scheduling.
5. **Currency Handling:** Original currency is preserved. Currencies are accounted separately (currency-grouped cards and breakdowns); cross-currency conversion is not performed unless an explicit `in_inr` value is recorded. Foreign payments do NOT contribute zero; they contribute to their own currency balance. No unapproved third-party exchange rate API is called.
6. **Micro-File Limit:** All frontend source files strictly <= 149 lines.
7. **Single Meeting Link:** Exactly one primary meeting link per student managed directly on the Students page.
