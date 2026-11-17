# 03 — Pages, Components, and Interactions

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** Frontend-03
- **Status:** Authoritative Frontend UI & Interactions Specification
- **Version:** 5.0.0 (Canonical Four-Table Datastore & Unified Workflows)
- **Last Verified Date:** 2026-11-17
- **Audience:** Frontend developers, UI/UX engineers, AI coding agents

---

## 2. Product Context

The application is a private, single-administrator management system for online tutoring operations.
The frontend is built with React 18, TypeScript, and Vite. It communicates exclusively with the Google Apps Script backend through `apiClient.ts` using text/plain HTTP POST transport. The browser never reads or writes Google Sheets directly.

---

## 3. Global Application Shell (`AppShell.tsx`)

### 3.1 Persistent Navigation Sidebar (`Sidebar.tsx`)
- Brand header: Application title (`APP_NAME`).
- Navigation items:
  1. 📊 **Dashboard** (`dashboard`)
  2. 📅 **Calendar** (`calendar`)
  3. 🎓 **Students** (`students`)
  4. ⏱️ **Class Schedule** (`classes`)
  5. 💰 **Finances** (`finances`)
- Footer controls:
  - Authenticated administrator display name, initial avatar, and email.
  - Settings shortcut button (`settings`).
  - Session Sign Out button (clears token, resets auth state).
- Responsive behavior: Mobile overlay drawer with backdrop toggle.

### 3.2 Top Bar (`TopBar.tsx`)
- Mobile hamburger menu toggle.
- "Welcome Back, [User]!" greeting.
- Live updating date and 12-hour AM/PM clock in canonical timezone `Asia/Kolkata` (`useLiveHeaderTime.ts`).
- Account dropdown (`AccountDropdown.tsx`) with user identity, Settings navigation, and Sign Out.

---

## 4. Dashboard Page (`DashboardPage.tsx`)

### 4.1 Overview Summary Cards (`DashboardSummary.tsx`)
1. **Active Students:** Total count of active students.
2. **Upcoming Classes (7 Days):** Count of scheduled sessions within the next 7 calendar days.
3. **Total Outstanding Balance:** Sum of uncollected student debt in INR.

### 4.2 Today's Classes (`TodayClassesSection.tsx`)
- Shows scheduled class sessions for the current day in `Asia/Kolkata`.
- Displays student name, enrolled subject, scheduled 12-hour time (e.g. `6:00 PM – 7:00 PM`).
- **Join Class Action:** Direct launch button opening the student's `primary_meeting_link` in a new tab.

### 4.3 Weekly Schedule Time-Grid (`DashboardCalendar.tsx`)
- Compact 7-day calendar overview showing weekly class distribution.

### 4.4 Things That Need Attention (`ThingsThatNeedAttention.tsx`)
- Actionable alert cards for active students:
  - Missing meeting link (prompts configuration).
  - Missing recurring schedule (prompts schedule setup).
  - Low package balance ($\le 4$ classes remaining) with 1-click package renewal shortcut.

---

## 5. Calendar Page (`CalendarPage.tsx`)

### 5.1 Controls Bar (`CalendarControlsBar.tsx`)
- View mode switcher: **Day View**, **Week View**, **Month View**.
- Navigation buttons: Previous, Next, and "Today".
- Active date range title formatted in `Asia/Kolkata`.

### 5.2 Weekly Time Grid (`WeeklyTimeGrid.tsx`)
- 7 vertical day columns (Monday through Sunday).
- Hourly time grid from 06:00 to 23:00.
- Event blocks positioned by local start time and package class duration.

### 5.3 Unified 3-Color Event Classification (`calendarClassification.ts`)
1. 🟢 **Soft Muted Green (`PAST_COMPLETED`):** Past session marked completed or attended.
2. 🔴 **Soft Muted Red (`CANCELLED`):** Explicitly cancelled session, or uncompleted past session.
3. 🟡 **Amber / Warm Accent (`UPCOMING`):** Scheduled future dated session or recurring slot placeholder.

### 5.4 Hybrid Event Synthesis
- Dated class sessions from `ClassSessions` take precedence.
- For active students with configured `Packages.class_schedule`, recurring schedule slots without a dated session are rendered as placeholders, preventing double booking.

---

## 6. Students Page (`StudentsPage.tsx`)

### 6.1 Directory Controls & Filters
- **Status Tabs:** **All Students**, **Active** (default), **Inactive**.
- **Search:** Real-time debounced text filter matching student name or subject.
- **Action Button:** `+ Add Student` opening the 4-section registration modal.

### 6.2 Directory Table (`StudentList.tsx`, `StudentRow.tsx`)
- **Columns:**
  - Student Name (with red Inactive badge if inactive).
  - Subject(s) chips.
  - Recurring Schedule summary string.
  - Class Progress bar (`consumed / purchased`, e.g. `09 / 12`).
  - Remaining Balance subtitle (`X classes remaining`).
- Clicking a row expands inline details.

### 6.3 Inline Expanded Details (`StudentExpandedDetails.tsx`)
- **Personal Details:** Student phone and email.
- **Parent Details:** Parent name, parent phone, and parent email.
- **Primary Meeting Link:** Displays meeting URL with platform badge (Google Meet, Zoom) and copy feedback button.
- **Packages History:** Lists current and historical packages with purchased counts, rates, validity dates.
- **Actions:**
  - `Edit Student`: Opens `EditStudentModal.tsx`.
  - `Renew Package`: Opens `StudentRenewalModal.tsx`.

### 6.4 Add Student Modal (`AddStudentModal.tsx`)
4-section registration workflow:
1. **Student Details:** Name (required), phone, email, subject multi-select chips.
2. **Parent Details:** Parent name (required), parent phone (required), parent email.
3. **Package Details:** Plan type, package price, classes purchased, class duration, auto-calculated editable per-class rate, start date.
4. **Schedule Details:** Recurring weekly schedule slots (day of week, start time) and first class date.
- Auto-scheduling worker generates initial dated sessions with duplicate and conflict prevention.

### 6.5 Edit Student Modal (`EditStudentModal.tsx`)
- Allows editing student contacts, primary meeting link, package parameters, and recurring schedule slots.

### 6.6 Package Renewal Modal (`StudentRenewalModal.tsx`)
Multi-step renewal modal:
1. **Step 1: Student Selection & Summary:** Reviews current student balance, historical packages, and consumed classes.
2. **Step 2: Renewal Package Terms:** Plan type, newly purchased classes, package price, currency, class duration, start date.
3. **Step 3: Recurring Schedule:** Confirms or adjusts weekly recurring schedule.
4. **Step 4: Optional Payment:** Allows recording renewal payment concurrently.
5. **Step 5: Confirmation & Idempotent Submission:** Sends request with `sessionStorage`-cached idempotency key.
- Preserves historical package row intact and appends new package purchase row to `Packages`.

---

## 7. Class Schedule Page (`ClassesPage.tsx`)

### 7.1 Controls & Filters
- Student selector dropdown to filter sessions by student or view all.
- `Auto-Schedule Classes` button opening batch scheduling modal.

### 7.2 Sessions Ledger Table
- **Columns:**
  - Weekday & Date (`dd/mm/yyyy`).
  - Scheduled Time (12-hour AM/PM).
  - Student Name & Subject.
  - Attendance Status badge (`PRESENT`, `ABSENT`, `NOT_MARKED`, `CANCELLED`, `CANCELLED_LATE`).
  - Class Deduction badge (`Deducted` vs `Credit Preserved`).
  - Join Class action button.
  - Session Notes action button.
  - Attendance controls.

### 7.3 Attendance Controls (`AttendanceControl.tsx`)
- **Attended (`PRESENT`):** Marks session completed, sets `deduct_class = true`.
- **No-Show (`NO_SHOW`):** Prompts deduction preference.
- **Cancel:** Opens `CancelClassModal.tsx` requiring a non-blank cancellation reason. If advance notice ($\ge 4$h) or waived, auto-schedules a replacement session.
- **Restore Credit:** Restores class credit in place on an erroneously deducted session (`deduct_class = false`).

### 7.4 Session Notes Modal
- Allows reviewing and updating pedagogical lesson coverage and teacher remarks in `ClassSessions.session_notes`.

---

## 8. Finances Page (`FinancesPage.tsx`)

Consolidates all financial and billing management into one single ledger screen.

### 8.1 Summary Cards (`FinanceSummaryCards.tsx`)
1. **Total Invoiced / Payable:** Sum of package billing values across student packages in INR.
2. **Collected Earnings:** Actual payments received in INR.
3. **Total Outstanding Balance:** Sum of uncollected student debt ($\max(0, \text{Payable} - \text{Paid})$) across students.

### 8.2 Student Balances Tab (`StudentBalanceTable.tsx`)
- Lists all students with Total Invoiced, Total Paid, Net Outstanding Balance, Available Credit, and Payment Count.
- Balances are grouped strictly by currency.
- Excess payments are displayed separately as Available Credit; outstanding balance is never negative.
- **Add Payment Action:** Opens `AddPaymentModal.tsx` prefilled with selected student.

### 8.3 Add Payment Modal (`AddPaymentModal.tsx`)
- Captures Student, Payment Date, Amount, Currency (INR, USD, GBP, EUR), and manual `in_inr`.
- Client generates an idempotency key to prevent accidental double submission.

### 8.4 Payment History Tab (`FinancialHistoryTable.tsx`)
- Chronological table of all recorded payments.
- Real-time search by student name or reference.
- Date range filter.
- **CSV Export:** Client-side CSV generation of the filtered payment records.

---

## 9. Settings Page (`SettingsPage.tsx`)
- Displays system time zone (`Asia/Kolkata`), default currency (`INR`), and default duration (60 minutes).
