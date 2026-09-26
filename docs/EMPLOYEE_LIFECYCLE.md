# Employee Lifecycle Management Guide

## Overview

The **Employee Lifecycle Management** screen (`/employees/lifecycle`) provides administrators with a dedicated, focused interface for managing employee statuses across their lifecycle: **activating**, **suspending**, and **offboarding**.

This workflow ensures reliable payroll operations by preventing disbursements to ineligible, suspended, or offboarded personnel, while upholding zero-knowledge privacy guarantees.

---

## Lifecycle State Machine

```
   [Onboarded]
        │
        ▼
   ┌─────────┐      Suspend      ┌───────────┐
   │         │ ────────────────> │           │
   │ Active  │                   │ Suspended │
   │         │ <──────────────── │           │
   └─────────┘     Activate      └───────────┘
        │                              │
        │ Offboard                     │ Offboard
        ▼                              ▼
  ┌─────────────────────────────────────────┐
  │               Offboarded                │
  │     (Permanent - Terminal State)        │
  └─────────────────────────────────────────┘
```

### State Definitions

1. **Active**:
   - Eligible for payroll batch inclusions and proof generation.
   - Can transition to: **Suspended** or **Offboarded**.

2. **Suspended**:
   - Temporarily excluded from payroll calculations and disbursements.
   - Retains record history and onboarding credentials.
   - Can transition to: **Active** (reactivation) or **Offboarded**.

3. **Offboarded**:
   - Permanently excluded from payroll batches.
   - Terminal state: Cannot be reactivated directly (requires new onboarding if re-hired).
   - No further lifecycle actions available.

---

## Authorization & Role Controls

- **Admin Only**: Only users with the `admin` role can access `/employees/lifecycle` and execute lifecycle state transitions.
- **Middleware Guard**: Next.js route protection automatically redirects non-admin roles (operator, auditor) away from `/employees/lifecycle`.
- **Store-Level Validation**: Store transitions enforce role verification (`role === "admin"`) even if called programmatically.

---

## Privacy Safeguards

- **No Sensitive Value Leakage**: Action failure messages, audit events, and confirmation prompts never expose raw salaries or salary commitments.
- **Auditable Events**: Every state transition generates a privacy-safe `EmployeeLifecycleEvent` recording `action`, `performedBy`, `performedAt`, and an optional operator note, without leaking financial details.

---

## Payroll Draft Visibility

A payroll draft stores `employeeIds` only. Suspending or deactivating an employee
after a draft has been assembled therefore does **not** rewrite the draft — the
excluded employee stays in it until someone notices.

`src/payroll/inactiveEmployees.ts` re-resolves every draft entry against the
current roster, and `components/warnings/InactiveEmployeeWarning.tsx` shows the
result to reviewers in three places:

| Surface | What a reviewer sees |
| --- | --- |
| Payroll wizard review step | Amber alert naming each inactive or suspended employee, plus the two ways to resolve it |
| `/payroll/review` (payload review) | The same alert before the signing payload is inspected |
| `/payroll/approvals` (executive approval) | The alert plus an `inactive_employee` risk factor in the review risk score |

States:

- **Clean** — every draft entry is eligible: no alert is rendered.
- **Warning (amber)** — a draft entry is inactive, suspended, or offboarded.
- **Critical (red)** — a draft entry references an id that is no longer in the
  roster (deleted employee or stale draft data).

The wizard's confirmation step treats any of these as a hard blocker, so wallet
signing cannot proceed against an ineligible record, and the blocker message
names the affected employees.

**Privacy**: the warning carries the employee id, display name, and eligibility
reason only. Salary, salary commitment, and wallet address are never rendered,
logged, or sent to telemetry with it.

---

## Reproducible QA Test Cases

### QA-1: Successful Path — Suspending an Active Employee

1. **Pre-condition**: Log in as an administrator. Navigate to `/employees/lifecycle`.
2. **Action**:
   - Locate an active employee (e.g., "Alice Mensah").
   - Click the **Suspend** action button.
   - In the confirmation dialog, enter an optional note: `"Extended leave of absence"`.
   - Click **Confirm Suspend**.
3. **Expected Outcome**:
   - Success toast / banner confirms suspension.
   - Employee's status badge updates to `Pending / Suspended`.
   - Action buttons update to offer **Activate** and **Offboard**.
   - The employee is flagged as inactive (`isActive: false`) and will not be selected in subsequent payroll runs.
   - A new entry is appended to the "Recent Lifecycle Changes" audit log.

### QA-2: Edge Case — Offboarded Employee Terminal State

1. **Pre-condition**: An employee has been transitioned to `Offboarded`.
2. **Action**: View the employee's row in `/employees/lifecycle`.
3. **Expected Outcome**:
   - Status badge displays `Offboarded` (`inactive`).
   - The Actions column displays `"No actions available"`.
   - No `Activate` or `Suspend` buttons are rendered or accessible.

### QA-3: Edge Case — Non-Admin Authorization Guard

1. **Pre-condition**: Access the dashboard with an `operator` or unauthenticated session.
2. **Action**: Attempt to navigate directly to `/employees/lifecycle`.
3. **Expected Outcome**:
   - Middleware intercepts the request and redirects to `/` (or `/login`).
   - Direct store calls with non-admin roles return `{ success: false, error: "Only administrators can manage employee lifecycle status." }`.

### QA-4: Failure Path — Inactive Employee Left in a Payroll Draft

1. **Pre-condition**: A payroll draft exists that includes an employee who has since been suspended or deactivated.
2. **Action**: Open the payroll wizard review step (or `/payroll/review`, `/payroll/approvals`).
3. **Expected Outcome**:
   - An amber `Inactive or suspended employees in this payroll` alert is shown, naming each affected employee with their eligibility reason.
   - "What to do" lists both resolutions: remove them from the draft, or restore their status on `/employees/lifecycle`.
   - Continuing to the confirmation step blocks wallet signing, and the blocker line reads `Payroll contains inactive or invalid employee data: <names>`.
   - No salary, commitment, or wallet value appears anywhere in the alert.

### QA-5: Edge Case — Stale Draft Id and Clean Drafts

1. **Pre-condition**: A saved draft references an employee id that has been deleted from the roster.
2. **Action**: Open the draft review surfaces listed above; then open a draft whose employees are all active.
3. **Expected Outcome**:
   - The stale entry raises the critical variant, titled `Payroll draft references unavailable employee records`, labelled `No longer in the employee roster`.
   - A fully active draft renders no alert at all (silent clean state, not a green banner).
   - Duplicate ids in a draft are reported once.

## Import Reference Collision Warning

During employee CSV imports and batch onboarding, external import references (e.g. `IMP-2025-001`) are checked against existing processed batch identifiers before work is committed.

- **Collision Prevention**: Surface actionable warnings when duplicate import references are detected to avoid creating redundant payroll entries.
- **Privacy Guaranteed**: Only external reference strings are validated and displayed. Employee salary values and zero-knowledge commitment secrets are never exposed in validation notices.

