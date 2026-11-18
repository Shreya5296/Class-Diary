# 01 — Product Requirements

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** 01
- **Status:** Authoritative Product Specification
- **Version:** 5.0.0 (Canonical Four-Table Datastore & Unified Workflows)
- **Last Verified Date:** 2026-11-17
- **Audience:** Product owner, developers, AI coding agents, reviewers
- **Predecessor:** `00-document-index.md`

---

## 2. Purpose & Problem Statement

The Personal Dashboard is a private, single-administrator management system for private online tutoring operations.

Before this dashboard, student records, payments, class counts, and meeting links were scattered across disparate spreadsheets or manual notes. This led to administrative overhead:
- Finding current student contacts and specific meeting links was slow.
- Determining whether a student had remaining prepaid classes required manual tallying.
- Invoicing and tracking payments across domestic INR and foreign currencies lacked a unified view.
- Scheduling recurring classes and tracking attendance lacked conflict detection and calendar integration.

The dashboard consolidates all daily tutoring operations into one unified, responsive web interface backed by a single Google Spreadsheet datastore.

---

## 3. Product Summary & Technical Stack

- **Frontend:** React 18, TypeScript, Vite. Hosted on Vercel as a single-page application (SPA).
- **Backend:** Google Apps Script Web App. Provides authenticated REST-like POST operations, runs domain validation and business rules, and manages Google Sheets persistence.
- **Canonical Datastore:** One private Google Spreadsheet containing **strictly four physical tables**: `Students`, `Packages`, `Payments`, and `ClassSessions`.
- **Primary Timezone:** `Asia/Kolkata` (IST, UTC+05:30) for all dates, times, schedules, and live clocks.
- **Base Currency:** `INR`. Multi-currency transactions retain original currency with manual `in_inr` conversion.
- **User Model:** One authorized administrator (`ashreya0502@gmail.com`). No student or parent accounts.

---

## 4. Current Implemented Application Scope

The application consists of five primary functional navigation areas plus user preferences:

### 4.1 Dashboard (`/dashboard`)
- **Operational Summary Cards:** Active student count, upcoming classes in the next 7 days, total outstanding balance in INR.
- **Today's Classes:** Chronological view of today's scheduled classes with student name, subject, 12-hour formatted time (`Asia/Kolkata`), and direct **Join Class** action.
- **Things That Need Attention:** Actionable alert cards for active students missing meeting links, missing schedules, or with low package balance ($\le 4$ classes remaining).
- **Weekly Schedule Time-Grid:** Interactive weekly calendar snippet displaying scheduled sessions with student names and subjects.

### 4.2 Calendar (`/calendar`)
- **Multi-View Calendar:** Full Google Calendar style interface supporting **Day View**, **Week View** (7-day time grid from 06:00 to 23:00), and **Month View**.
- **Unified 3-Color Event Treatment:**
  1. `PAST_COMPLETED` (soft muted green): Past session marked `COMPLETED`, `PRESENT`, or `ATTENDED`.
  2. `CANCELLED` (soft muted red): Explicitly cancelled session, or uncompleted past session.
  3. `UPCOMING` (amber / warm accent): Scheduled future session or recurring slot.
- **Hybrid Event Synthesis:** Combines dated class sessions from `ClassSessions` with recurring slots from active student packages, preventing slot duplication.

### 4.3 Students (`/students`)
- **Student Directory Table:** Filterable by status tabs (**All**, **Active**, **Inactive**) and text search.
- **Columns:** Student Name (with inactive badge when applicable), Enrolled Subject(s), Recurring Schedule summary, Class Progress bar (`consumed / purchased`), and Quick Actions.
- **Inline Expansion:** Clicking a row expands detailed personal contact info, parent contact info, primary meeting link, package terms, and session history without leaving the page.
- **Add Student Modal:** 4-section modal workflow:
  1. Student Details (Name, optional Phone, optional Email, Subject multi-select: English, Math, Science, Social Science, Hindi, Geeta).
  2. Parent Details (Parent Name, Parent Phone, optional Parent Email).
  3. Package Details (Plan Type, Package Price, Purchased Classes, Class Duration, auto-calculated editable Per-Class Rate, Start Date).
  4. Schedule Details (Multi-day recurring schedule entries with start time, first class date).
- **Auto-Scheduling Integration:** Automatically creates dated class sessions upon registration with duplicate avoidance and conflict prevention.
- **Edit Student Modal:** Edit personal contacts, update primary meeting link, update package terms, and update recurring schedule.
- **Package Renewal Modal:** Dedicated multi-step renewal workflow:
  - Preserves the historical package row intact in `Packages`.
  - Appends a new package row storing only the newly purchased classes.
  - Dynamically computes aggregate student available balance: sum of purchased classes across all package rows minus total consumed sessions.
  - Carried-forward classes do not increase the new package price.

### 4.4 Class Schedule & Attendance (`/classes`)
- **Sessions Ledger:** Chronological table of dated class sessions filterable by student.
- **Columns:** Student, Weekday & Date (`dd/mm/yyyy`), Class Time (12-hour AM/PM), Consumed / Purchased classes, Join Class, Session Notes, Attendance Status.
- **Session Notes:** Review and edit lesson coverage, topics discussed, and pedagogical remarks via dedicated modal. Notes are preserved independently.
- **Attendance Actions:**
  - **Present / Attended:** Marks `session_status = COMPLETED`, `attendance_status = PRESENT`, and `deduct_class = true`.
  - **Absent / No-Show:** Prompts owner whether to deduct class credit.
  - **Cancel:** Prompts for required cancellation reason, saved to `ClassSessions.cancellation_reason`. If cancelled $< 4$ hours before session and not waived, `deduct_class = true`. If waived or advance cancellation, `deduct_class = false` and an automatic replacement session is scheduled at the next available recurring slot.
  - **Restore Credit:** Restores class credit on an incorrectly deducted session (`deduct_class = false`).
- **Auto-Schedule Tool:** Modal to generate future sessions for a student based on package terms and recurring schedule.

### 4.5 Finances (`/finances`)
- **Consolidated Ledger:** Replaces older separate fees and reports tabs into one cohesive financial management screen.
- **Summary Cards:** Total Agreed Invoice Value, Collected Earnings (received payments), Total Outstanding Balance (uncollected debt).
- **Student Balances Tab:** Overview of all students, total invoiced, total paid, and net outstanding balance, with one-click **Add Payment** modal.
- **Financial Accounting Model:**
  - Calculated per student and grouped strictly by currency.
  - Outstanding is $\max(0, \text{Total Package Payable} - \text{Total Recorded Payments})$. Never becomes negative.
  - Excess payment is displayed separately as available credit ($\max(0, \text{Total Paid} - \text{Total Payable})$).
  - Foreign payments retain original currency; unconverted foreign payments contribute 0 to INR totals.
  - Missing or invalid numeric values are treated as unreliable/unavailable (`isReliable: false`), not silently coerced to zero.
- **Payment Operations:**
  - Recording appends a row to `Payments` with client-generated idempotency key to prevent duplicates.
  - Voiding physically deletes the matching row from `Payments` and records a durable tombstone in ScriptProperties (`payment_void_<id>`).
- **Payment History Tab:** Chronological list of all payments received, with student search, date range filtering, and CSV export.

### 4.6 Settings & Global Shell (`/settings` & Layout)
- **Top Bar:** Brand identity, Welcome Back header, live updating date and 12-hour clock in `Asia/Kolkata`.
- **Account Dropdown:** User avatar, name, email, link to Regional Preferences, and session Sign Out.
- **Regional Preferences:** Displays system defaults (`Asia/Kolkata` time zone, `INR` base currency, 60-min default duration).

---

## 5. Non-Goals & Out-of-Scope Items

The following are strictly out of scope:
- Parent or student logins, accounts, or public portals.
- Multiple administrative user accounts or role hierarchies.
- Direct credit card or payment gateway processing (Razorpay, Stripe, PayPal). Payments are recorded manually upon receipt.
- Automated creation of Zoom or Google Meet meetings via external APIs.
- Automated email or WhatsApp marketing campaigns.
- Native mobile applications (iOS/Android).
- Separate external SQL or NoSQL database servers.
- Additional Google Sheets tables beyond the four canonical tables.
- Standalone Meeting Links or Student Notes tables or pages (meeting links are stored directly in `Students.primary_meeting_link` and notes in `ClassSessions.session_notes`).
- Legacy bulk import / reconcile features (permanently retired in Phase 15).
