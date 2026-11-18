# 03 Data — 03 Financial and Class Balance Calculations

## 1. Document Control

- **Product:** Personal Dashboard (Student Management Dashboard)
- **Document ID:** Data-03
- **Status:** Authoritative Calculations Specification
- **Version:** 5.0.0 (Strict Four-Table Architecture)
- **Last Verified Date:** 2026-11-17
- **Audience:** Developers, financial reviewers, AI coding agents

---

## 2. Dynamic Class Balance Calculations

Class balances are **derived dynamically** on read by combining `Packages` and `ClassSessions`. There are no stored running balance columns in Google Sheets.

### 2.1 Formula Definitions
1. **Total Purchased Classes:**
   $$\text{Purchased} = \sum_{p \in \text{Packages}, p.\text{student\_id} = \text{student}} p.\text{classes\_purchased}$$
   Includes all historical and active package rows. On package renewal, the historical package row is preserved intact and the new package row adds solely the newly purchased class count.
2. **Total Consumed Classes:**
   $$\text{Consumed} = \sum_{\substack{s \in \text{ClassSessions} \\ s.\text{student\_id} = \text{student} \\ s.\text{deduct\_class} = \text{TRUE}}} 1$$
3. **Remaining Available Classes:**
   $$\text{Remaining} = \max(0, \text{Purchased} - \text{Consumed})$$
4. **Exhausted Status:**
   $$\text{is\_exhausted} = (\text{Remaining} \le 0)$$

### 2.2 Attendance State Effects
| Attendance State | Session Status | Default `deduct_class` | Effect on Package Balance |
|---|---|---|---|
| `PRESENT` / `ATTENDED` | `COMPLETED` | `TRUE` | Consumes 1 class credit |
| `NOT_MARKED` | `SCHEDULED` | `FALSE` | Credit is not consumed |
| `ABSENT` / `NO_SHOW` (Unexcused) | `COMPLETED` | `TRUE` (if applied by admin) | Consumes 1 class credit |
| `ABSENT` (Excused) | `COMPLETED` | `FALSE` | Credit is not consumed |
| `CANCELLED` ($< 4$h notice, unexcused) | `CANCELLED` | `TRUE` | Consumes 1 class credit |
| `CANCELLED` ($\ge 4$h notice or waived) | `CANCELLED` | `FALSE` | Credit preserved; replacement auto-scheduled |

---

## 3. Financial Calculations & Multi-Currency Rules

### 3.1 Financial Model Architecture
The financial model is based on **lifetime package value and recorded payments, grouped strictly by currency**:

1. **Total Agreed Payable Value:**
   $$\text{Total Payable}_{\text{currency}} = \sum_{p \in \text{Packages}, p.\text{currency} = \text{cur}} p.\text{package\_price}$$
   Includes all historical and current packages for the student. Cancelled packages remain included unless explicitly adjusted by the owner.
2. **Total Recorded Payments:**
   $$\text{Total Paid}_{\text{currency}} = \sum_{m \in \text{Payments}, m.\text{currency} = \text{cur}} m.\text{amount}$$
   Includes all active payment rows. The physical Payments sheet has no status column; voided payments are physically removed from the sheet with durable tombstones stored in `ScriptProperties`.
3. **Net Outstanding Balance:**
   $$\text{Outstanding}_{\text{currency}} = \max(0, \text{Total Payable}_{\text{currency}} - \text{Total Paid}_{\text{currency}})$$
   - Outstanding balance **never becomes negative**.
4. **Excess Payment as Available Credit:**
   - If total payments received exceed total package payable, the difference is displayed separately as **Available Credit**:
     $$\text{Available Credit}_{\text{currency}} = \max(0, \text{Total Paid}_{\text{currency}} - \text{Total Payable}_{\text{currency}})$$
5. **Data Reliability & Missing Values:**
   - Missing, blank, or non-numeric values in `package_price` or `amount` mark the balance as **unreliable** (`isReliable: false`).
   - The application **does not silently coerce missing values to zero**.
6. **Class Credit vs Monetary Invariant:**
   - Remaining classes carried over during package renewal **do not increase the renewal package price**.
   - Remaining classes are **not monetary credit**.

### 3.2 Debtor Balance Insulation
Debts and overpayments are isolated per student:
- If Student A has paid ₹10,000 against a ₹6,000 package (overpayment of ₹4,000), their outstanding balance is ₹0, and their available credit is ₹4,000.
- Student A's surplus **never offsets** Student B's unpaid balance of ₹5,000.
- Total outstanding balance reflects the true sum of all uncollected debts across students:
  $$\text{Total Outstanding} = \sum_{\text{student}} \max(0, \text{Outstanding}_{\text{student}})$$

### 3.3 Strict Currency Insulation
- Foreign payments retain original currency (`USD`, `EUR`, `GBP`) in `Payments.currency`.
- Foreign currency amounts are **never** added directly to INR totals.
- No automated external exchange-rate APIs are called. Only manually entered `in_inr` values are used for INR conversion.
- Foreign payments without manual `in_inr` contribute 0 to INR aggregations.
