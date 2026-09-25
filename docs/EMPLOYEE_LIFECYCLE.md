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
