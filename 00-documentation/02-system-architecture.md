# 02 — System Architecture

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** 02
- **Status:** Authoritative Architecture Specification
- **Version:** 5.0.0 (Canonical Four-Table Architecture)
- **Last Verified Date:** 2026-11-17
- **Audience:** Developers, architects, AI coding agents

---

## 2. Architectural Principles & Stack

1. **Frontend-Backend Separation:**
   - **Frontend:** React 18, TypeScript, and Vite. Static single-page application hosted on Vercel.
   - **Backend:** Google Apps Script (GAS) Web App deployed as an executable API endpoint.
   - **Datastore:** Exactly FOUR physical Google Sheets tables in a single private Google Spreadsheet.
2. **Strict Datastore Boundary:**
   - The browser never communicates directly with the Google Sheets API.
   - All spreadsheet reads and mutations pass through the authenticated Apps Script Web App.
3. **Zero-GCP Authentication:**
   - No Google Cloud Console, GCP project, OAuth consent screen, or OAuth credentials are required.
   - Session authentication uses server-side HMAC-SHA256 tokens signed with `ADMIN_AUTH_KEY` stored in Apps Script `ScriptProperties`.
4. **Transport via CORS-Free Text/Plain POST:**
   - The frontend issues HTTP POST requests with `Content-Type: text/plain;charset=utf-8` and `redirect: 'follow'`.
   - Using `text/plain` prevents CORS preflight (`OPTIONS`) requests, which Google Apps Script Web Apps cannot answer.
5. **Micro-File Architecture:**
   - Every source file in `src/` and `public/` is strictly $\le 149$ lines, organized by single-responsibility domains.

---

## 3. High-Level Architecture Diagram

```mermaid
flowchart TD
    subgraph Browser["User Browser (Desktop / Tablet)"]
        UI["React 18 SPA (Vite)"]
        State["Domain Hooks & Local State"]
        APIClient["Centralized API Client (apiClient.ts)"]
    end

    subgraph Hosting["Frontend Hosting (Vercel)"]
        VercelSPA["Static Bundle & SPA Rewrites (vercel.json)"]
    end

    subgraph Backend["Google Apps Script Web App"]
        DoPost["doPost(e) Entry Point (ApiEntry.gs)"]
        AuthGuards["HMAC-SHA256 Auth & Allowlist (IdentityVerifier.gs)"]
        Router["OperationRouter.gs"]
        Services["Domain Business Services (Student, Package, Class, Payment, Report, Renewal)"]
        LockMgr["LockManager.gs (Reentrant ScriptLock)"]
        Repositories["Domain Repositories (CRUD & Memory Maps)"]
        SheetsAccess["HeaderMapper.gs & DateFormatService.gs"]
    end

    subgraph Datastore["Canonical Google Spreadsheet (Private)"]
        T1["Students (10 cols)"]
        T2["Packages (12 cols)"]
        T3["Payments (6 cols)"]
        T4["ClassSessions (9 cols)"]
    end

    UI --> State
    State --> APIClient
    APIClient -- "POST text/plain;charset=utf-8" --> DoPost
    DoPost --> AuthGuards
    AuthGuards --> Router
    Router --> Services
    Router --> LockMgr
    Services --> LockMgr
    Services --> Repositories
    Repositories --> SheetsAccess
    SheetsAccess --> T1
    SheetsAccess --> T2
    SheetsAccess --> T3
    SheetsAccess --> T4
```

---

## 4. Request & Response Lifecycle Flow

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrator
    participant UI as React UI (Client)
    participant Client as apiClient.ts
    participant GAS as Apps Script (ApiEntry.gs)
    participant Auth as IdentityVerifier.gs
    participant Svc as Domain Service
    participant Sheet as Google Sheets (Canonical Table)

    Admin->>UI: Triggers action (e.g. Mark Class Present)
    UI->>Client: sendApiRequest('classes.complete', { session_id, attendance_status: 'PRESENT' })
    Client->>GAS: HTTP POST (JSON body as text/plain, token, requestId)
    GAS->>Auth: verifyIdentityToken(token)
    Auth-->>GAS: Valid (admin: ashreya0502@gmail.com)
    GAS->>Svc: Classes_complete(spreadsheet, payload, actor)
    Svc->>Sheet: Read row & acquire LockManager
    Svc->>Sheet: Update ClassSessions (session_status='COMPLETED', deduct_class=true)
    Svc-->>GAS: Success { session_status: 'COMPLETED', deduct_class: true }
    GAS-->>Client: HTTP 200 { ok: true, data: { ... }, meta: { requestId } }
    Client-->>UI: Resolved Promise
    UI-->>Admin: UI updates & toast notification
```

---

## 5. Domain Relationship Diagram

The canonical datastore contains **strictly four tables** with all secondary records linking directly to `Students.student_id`.

```mermaid
erDiagram
    Students ||--o{ Packages : "has (linked by student_id)"
    Students ||--o{ Payments : "pays (linked by student_id)"
    Students ||--o{ ClassSessions : "attends (linked by student_id)"

    Students {
        string student_id PK "Unique identifier (STU_001)"
        string student_name "Full name"
        string parent_name "Parent name"
        string parent_phone "Parent phone (+ escaped)"
        string parent_email "Parent email"
        string student_phone "Student phone"
        string student_email "Student email"
        string subject "Enrolled subject(s)"
        string status "ACTIVE | INACTIVE | ARCHIVED"
        string primary_meeting_link "One primary meeting link"
    }

    Packages {
        string student_id FK "References Students.student_id"
        string student_name "Student name snapshot"
        string plan_type "PACKAGE | MONTHLY | YEARLY | PER_CLASS"
        string currency "INR | USD | EUR | GBP"
        number package_price "Agreed total price"
        number per_class "Per-class rate"
        number classes_purchased "Purchased classes for this package row"
        string start_date "Start date (YYYY-MM-DD)"
        string end_date "End date (YYYY-MM-DD)"
        string next_due_date "Next fee due date (YYYY-MM-DD)"
        number class_duration "Class duration in minutes"
        string class_schedule "Schedule text (e.g. Mon - 6:00 PM)"
    }

    Payments {
        string student_id FK "References Students.student_id"
        string student_name "Student name snapshot"
        string payment_date "Payment date (YYYY-MM-DD)"
        number amount "Original currency amount"
        string currency "Payment currency code"
        number in_inr "Manual INR equivalent"
    }

    ClassSessions {
        string student_id FK "References Students.student_id"
        string student_name "Student name snapshot"
        string schedule_date "Date (YYYY-MM-DD)"
        string schedule_time "Time (HH:mm, 24-hour)"
        string attendance_status "NOT_MARKED | PRESENT | ATTENDED | ABSENT | CANCELLED | CANCELLED_LATE"
        string session_status "SCHEDULED | COMPLETED | CANCELLED"
        boolean deduct_class "True consumes package balance"
        string cancellation_reason "Reason if cancelled"
        string session_notes "Lesson coverage, remarks, contextual notes"
    }
```

---

## 6. Attendance & Class Deduction Workflow

```mermaid
flowchart TD
    Start["Class Session Marked"] --> StatusCheck{"What action was chosen?"}
    
    StatusCheck -- "Present / Attended" --> SetPresent["Set session_status = 'COMPLETED'<br/>Set attendance_status = 'PRESENT'<br/>Set deduct_class = true"]
    SetPresent --> BurnCredit["Consumes 1 Class Credit<br/>(Derived dynamically across packages)"]
    
    StatusCheck -- "Absent / No-Show" --> PromptOwner{"Did owner choose to deduct?"}
    PromptOwner -- "Yes (Unexcused / Late)" --> SetAbsentDeduct["Set attendance_status = 'ABSENT'<br/>Set deduct_class = true"]
    SetAbsentDeduct --> BurnCredit
    PromptOwner -- "No (Excused)" --> SetAbsentNoDeduct["Set attendance_status = 'ABSENT'<br/>Set deduct_class = false"]
    SetAbsentNoDeduct --> NoDeduct["Credit is NOT consumed"]
    
    StatusCheck -- "Cancelled" --> CheckTime{"Cancelled < 4h before session?"}
    CheckTime -- "Yes (Late cancellation)" --> CheckWaive{"Credit waived by owner?"}
    CheckWaive -- "No" --> SetCancelLate["Set session_status = 'CANCELLED'<br/>Set attendance_status = 'CANCELLED_LATE'<br/>Set deduct_class = true"]
    SetCancelLate --> BurnCredit
    CheckWaive -- "Yes" --> SetCancelWaived["Set session_status = 'CANCELLED'<br/>Set deduct_class = false"]
    CheckTime -- "No (Advance notice)" --> SetCancelWaived
    
    SetCancelWaived --> AutoReschedule["Schedule Automatic Replacement Session<br/>at next recurring schedule slot<br/>& extend package end_date"]
    AutoReschedule --> NoDeduct
```

---

## 7. Package Renewal & Class Balance Derivation Architecture

### 7.1 Historical Package Preservation
When a package is renewed (`packages.renew` / `students.renew`):
1. **No Overwrite:** The historical package row is preserved untouched in `Packages`.
2. **New Row Appended:** A new package row is appended with the new package purchase details (`classes_purchased = newClasses`, `package_price = newPrice`, `start_date`, `end_date`, `class_schedule`).
3. **Aggregate Balance Derivation:** Student available class balance is dynamically derived across all packages:
   $$\text{Total Purchased} = \sum_{p \in \text{Packages}, p.\text{student\_id} = \text{sid}} p.\text{classes\_purchased}$$
   $$\text{Total Consumed} = \sum_{s \in \text{ClassSessions}, s.\text{student\_id} = \text{sid}, s.\text{deduct\_class} = \text{true}} 1$$
   $$\text{Remaining Available Balance} = \text{Total Purchased} - \text{Total Consumed}$$

---

## 8. Schedule Persistence & Concurrency Safeguards

1. **Storage Location:** Recurring schedules are persisted directly in `Packages.class_schedule`.
2. **Shared ScriptLock:** All conflicting writers to `Packages.class_schedule` (including `Schedules_save` and `RenewalService`) acquire the shared script lock via `LockManager.withLock(fn, timeoutMs)`.
3. **Reentrant Lock Support:** `LockManager.withLock` tracks execution-local lock depth. Nested calls within the same execution context (e.g. `RenewalService` calling `Schedules_save`) execute without self-deadlock, while ensuring the underlying Google Apps Script `ScriptLock` is acquired and released at depth 1.
4. **Lock Acquisition Failure:** If lock cannot be acquired within the timeout window, the write operation is safely aborted with `LOCK_TIMEOUT` and zero mutations occur.

---

## 9. Payment Safety & Void Mechanics

1. **6-Column Schema:** `student_id, student_name, payment_date, amount, currency, in_inr`.
2. **Idempotency:** Payment recording utilizes client-supplied `idempotency_key` cached in memory and durable store. Duplicate retries return the original record.
3. **Physical Row Deletion on Void:** Payments does not have a physical status column. Voiding locates the specific payment row and physically removes it via `sheet.deleteRow()`.
4. **Durable Tombstone:** A tombstone is recorded in `ScriptProperties` (`payment_void_<id>`). If a void request is retried, the tombstone prevents re-processing and safely returns idempotent success.
5. **Ambiguity Prevention:** If multiple identical rows exist that match the student, amount, and date without unique discrimination, `Payments_void` rejects with `AMBIGUOUS_RECORD` to avoid deleting the wrong row.
