# Retention policy UI behaviour

This page describes how the audit log retention setting behaves in the payroll policy editor at `/settings/payroll-policy`, under the **Audit & Retention** tab.

## Fields

| Control | Type | Behaviour |
| --- | --- | --- |
| Audit Log Retention Period (Days) | Number input, `id="retention-period-days"` | Whole days only. Step is 1. Min 30, max 3650. |
| Presets | Buttons: 90d, 180d, 1 Year (365), 2 Years (730), 7 Years (2555) | Set the period to that value immediately. |
| Enforce Immutable Cryptographic Audit Log | Checkbox | Turns the immutable audit log on or off. Off shows a warning. |
| Require Auditor Sign-Off for Full Export Bundles | Checkbox | Turns auditor sign-off on or off. Off shows a warning. |
| Capture Detailed Verification Telemetry | Checkbox | Turns detailed telemetry on or off. No validation. |

## Valid range

- Allowed values: whole numbers from **30 to 3650** inclusive.
- Values below 30, above 3650, decimals (for example `365.5`), empty entries, and non-numeric entries are invalid.
- Values from 30 to 179 are accepted but show a warning: "Below industry retention standard" (recommended 365 days or more).

## Validation messages

When the value is invalid, the section shows a red alert with the following text. Messages never include the entered value or any payroll, employee, or salary data.

| Condition | Message |
| --- | --- |
| Empty or non-numeric | Enter the retention period as a number of days. Empty or non-numeric entries cannot be saved. |
| Decimal | Use a whole number of days, for example 365. Decimal values cannot be saved. |
| Below 30 | Increase the period to at least 30 days to meet the minimum retention requirement. |
| Above 3650 | Reduce the period to 3650 days (10 years) or fewer. |

The alert always starts with "Enter a whole number between 30 and 3650 days before saving. No policy change has been confirmed."

The alert offers two buttons:

- **Restore last valid value (N days)**: sets the period to the last value that was valid in this session. Defaults to 365 if none.
- **Use recommended 365 days**: sets the period to 365.

## What is saved

- Pressing save on the policy editor runs the policy compiler first.
- If the compiler reports any error, the save is blocked. The editor shows: "Cannot save policy: N critical validation error(s) must be resolved first." Nothing is written.
- The retention period is blocked when it is not a whole number, or when it is outside 30 to 3650. Those are the same rules as the alert above.
- A valid save stores the full policy, including the retention period, the two checkboxes, and the telemetry flag. The policy version increases by one.

## What changing the setting does not do

- Changing the period does not delete existing audit records.
- Immutable records and legal holds stay protected.
- Records tied to pending or unverified payroll settlements stay protected from retention purge until on-chain settlement is finalized.
- Reducing the period can make older records eligible for pruning later. Review compliance obligations before saving.

## Settlement-pending purge safeguard

- Dashboard retention purge controls in the archive center (`/archive`, `/archive/payroll-runs`, `/history/archived`) and `RetentionSafeguardPanel` check settlement finality before allowing any record deletion.
- While any payroll run has a pending settlement (`pending`, `in_progress`, `awaiting_confirmation`, `unconfirmed`, `paused`, or `settlementPending: true`) or an unverified settlement state (`unknown`, `failed`, or missing), retention purge is disabled across the batch.
- Safeguard banners and rejection messages report only aggregate counts, policy windows, and remediation links (`/payroll/reconciliation`, `/settings/payroll-policy`), never exposing employee identities, wallet addresses, or salary amounts.

## Related code

- `components/features/policy/AuditRetentionPolicySection.tsx`: the section UI and alert.
- `lib/payroll/retentionPeriodValidation.ts`: the shared range and message rules.
- `lib/sdk/payrollPolicyCompiler.ts`: the compiler checks that block saving.
- `stores/payrollPolicy.ts`: `updateAuditRetention` and `savePolicy`.
- `src/audit/recordRetention.ts`: `evaluateAuditRetention` and `evaluateRetentionPurgeGuard` settlement-aware retention checks.
- `stores/archive.ts`: `evaluateArchiveRetentionPurge` and `purgeExpiredRuns` store guard.
- `components/features/archive/PayrollArchiveCenter.tsx`: archive retention purge safeguard UI.
