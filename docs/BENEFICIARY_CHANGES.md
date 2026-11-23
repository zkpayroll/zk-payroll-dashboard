# Beneficiary Changes UI Behavior

## Overview

This document defines the user interface behavior, multi-stage verification workflow, validation guardrails, and privacy guarantees for beneficiary (payout destination) changes in the ZK Payroll Dashboard.

Changing an employee or contributor payout destination is a critical security event. The UI enforces strict format validation, multi-party sign-off, a mandatory cooling-off window, active payroll safety locks, and a 24-hour administrative undo recovery flow, while strictly preserving privacy by never exposing employee identities or salary amounts.

## Expected Behavior and Route Structure

The beneficiary management interface is available at `/beneficiaries` (`app/beneficiaries/page.tsx`) and through dashboard verification cards (`components/features/dashboard/DashboardBeneficiaryVerificationStatusCheck.tsx`):

- **Aggregate Status Visibility**: Operators see overall readiness without employee-level data (`ready`, `pending`, or `blocked`).
- **Masked Destination Previews**: All Stellar addresses are truncated and masked (e.g. `GA7Q...VSGZ`) via `maskAddress`. Full keys and raw employee data are never rendered in public UI feeds.
- **Ordered Operator Guidance**: Each pending request provides plain-language next steps via `BeneficiaryChangeGuidance` (`components/features/employees/BeneficiaryChangeGuidance.tsx`).
- **Active Payroll Lock**: All mutation actions (request submission, step sign-offs) are disabled while an active payroll cycle is in progress.
- **24-Hour Undo Capability**: Administrators can revert changes within 24 hours using a valid 32-character alphanumeric recovery code.

## Verification Workflow States

Beneficiary change requests transition through the following formal states:

| Status | Trigger / Condition | UI Tone | Actionable Operator Guidance |
| ------ | ------------------- | ------- | ---------------------------- |
| `draft` | Request drafted but not yet submitted | Info | Submit the beneficiary change to start verification. |
| `pending_verification` | Awaiting required verification steps | Info | Complete remaining steps (`contributor_confirmation`, `two_factor_auth`, `dual_operator_signoff`). |
| `cooling_off` | All verification steps satisfied; waiting for mandatory cooling-off window (default 24h) | Warning | Waiting for cooling-off period to end (e.g. "takes effect in about 24 hours"). |
| `verified_active` | Verified and cooling-off elapsed | Ready | Beneficiary change is active and will be used for future payroll cycles. |
| `rejected` | Explicitly rejected by policy or operator | Blocked | Displays rejection reason; operator must submit a new request if needed. |
| `expired` | Request TTL exceeded (default 7 days) without completion | Blocked | Verification window expired; operator must submit a new request. |

### Required Verification Steps

1. **Contributor Confirmation (`contributor_confirmation`)**: The employee or contributor confirms the destination address switch.
2. **Two-Factor Authentication (`two_factor_auth`)**: Multi-factor authentication check completed.
3. **Dual Operator Sign-Off (`dual_operator_signoff`)**: Requires approval from an operator different from the requester. Self-signoff is strictly prohibited.

### Active Payroll Lock

When an active payroll cycle is executing (`isPayrollInProgress: true`):

- Requests cannot be submitted or transitioned to active status.
- The UI displays an alert: `Beneficiary changes cannot be applied while an active payroll cycle is in progress.`
- Prevents mid-cycle race conditions and ensures on-chain commitment integrity.

## UI Validation and Error Feedback

Input validation runs in real time via `lib/beneficiary-validation.ts`.

### Address Validation Rules

- **Format**: Must be a valid 56-character Stellar public key starting with `G` followed by 55 base32 characters (`^G[A-Z2-7]{55}$`).
- **Degenerate Key Rejection**: All-zero or dummy addresses (e.g. `G` followed by 55 `A`s, or `GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5H7`) are rejected.
- **Address Uniqueness**: The new beneficiary address must differ from the current beneficiary address.
- **Trimming & Sanitization**: Leading and trailing whitespace is stripped before validation.

### Confirmation Validation Rules

- **Confirmation Checkbox**: Explicit operator confirmation is required (`You must confirm the beneficiary change`).
- **Version Impact Checkbox**: Acknowledgment of commitment version increment is required (`You must understand the version impact`).

### Recovery Validation Rules

- **Recovery Code Format**: Must be a 32-character uppercase alphanumeric code (`^[A-Z0-9]{32}$`).
- **Admin Approval**: Administrator confirmation checkbox is required (`Administrator confirmation is required`).

### Error Message Catalog

| Scenario | User-Facing Message |
| -------- | ------------------- |
| Empty address | `Beneficiary address is required` |
| Malformed address | `Invalid Stellar address format` |
| Same address | `New beneficiary must differ from current beneficiary` |
| Null/zero address | `Cannot use null/zero address as beneficiary` |
| Active payroll cycle | `Beneficiary changes cannot be applied while an active payroll cycle is in progress.` |
| Unconfirmed request | `You must confirm the beneficiary change` |
| Unacknowledged impact | `You must understand the version impact` |
| Empty recovery code | `Recovery code is required` |
| Malformed recovery code | `Invalid recovery code format` |
| Unconfirmed recovery | `Administrator confirmation is required` |

## Salary Commitment Versioning

When a beneficiary changes on an active salary commitment:

1. **Version Increment**: The commitment version increments automatically (e.g. v1 -> v2).
2. **Future Payroll Application**: The new beneficiary takes effect for subsequent payroll cycles.
3. **Historical Data Preservation**: Prior settlement receipts and audit entries retain original beneficiary addresses.
4. **Commitment Hash Update**: The cryptographic commitment is recomputed to match the updated destination.

## Zero-Knowledge & Privacy Invariants

- **No Salary Data**: Beneficiary forms, tables, and guidance cards never accept, display, or log salary amounts or financial values.
- **No Identity Exposure**: Status messages reference masked strings (`GA7Q...VSGZ`) or opaque references (`emp-101`), never full names or credentials.
- **Aggregate Dashboard Metrics**: Dashboard cards surface counts only (`readyCount`, `pendingCount`, `blockedCount`), preventing side-channel leaks.

## Public API & Types Reference

Public types are centralized in `types/beneficiary.ts` and re-exported in `types/index.ts`:

- `BeneficiaryChangeStatus`
- `VerificationStepType`
- `BeneficiaryChangeWorkflowPolicy`
- `DEFAULT_BENEFICIARY_WORKFLOW_POLICY`
- `BeneficiaryChangeRequest`
- `CreateBeneficiaryChangeInput`
- `WorkflowEvaluationContext`
- `BeneficiaryChangeDecision`
- `BeneficiaryChangeWorkflowError`
- `BeneficiaryChangeGuidanceTone`
- `BeneficiaryChangeGuidance`
- `BeneficiaryVerificationStatus`
- `BeneficiaryVerificationStatusEvaluation`
- `BeneficiaryValidationResult`
- `isValidStellarAddress`
- `validateBeneficiaryChange`
- `validateBeneficiaryConfirmation`
- `validateBeneficiaryRecovery`

## Verification

Run focused unit and component tests:

```bash
npx vitest run __tests__/beneficiary-changes.test.ts
npx vitest run __tests__/beneficiary-change-guidance.test.ts
npx vitest run __tests__/beneficiary-change-verification-workflow.test.ts
npx vitest run __tests__/beneficiary-ui-behavior.test.tsx
```
