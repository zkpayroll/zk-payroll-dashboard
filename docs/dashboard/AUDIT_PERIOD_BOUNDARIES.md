# Adjacent Payroll Period Boundaries in Audit Grants

## Overview

When issuing third-party audit grants, compliance officers and payroll operators must define explicit temporal boundaries for audit verification. Adjacent payroll periods (e.g. monthly or bi-weekly runs) share transition boundaries where transactions and cryptographic commitments occur.

This document describes the interval convention, boundary resolution rules, and zero-knowledge privacy guarantees governing adjacent payroll periods in the dashboard layer.

---

## Half-Open Interval Standard `[start, end)`

zk-payroll evaluates payroll period boundaries as **half-open intervals**:

$$\text{Period Interval} = [\text{startUtc}, \text{endUtc})$$

- **$\text{startUtc}$ is Inclusive ($\ge$)**: State transitions and payout receipts occurring at or after the start timestamp fall within the period.
- **$\text{endUtc}$ is Exclusive ($<$)**: Transactions timestamped at or beyond the end timestamp are excluded from the current period.

### Boundary Collision Rule

When two adjacent periods are continuous ($\text{end}_A = \text{start}_B$):
- Any event or receipt timestamped exactly at $T = \text{end}_A = \text{start}_B$ belongs **exclusively to succeeding Period B**.
- This strictly eliminates double-counting or skipped transactions across audit grants.

---

## Relationship States

| State | Condition | Impact | Operator Guidance |
|---|---|---|---|
| **Continuous** | $\text{start}_B - \text{end}_A = 0$ | Zero gap or overlap; seamless audit coverage. | No action needed. Verified for grant issuance. |
| **Overlapping** | $\text{start}_B < \text{end}_A$ | Risk of multi-period transaction double-counting. | Reconcile and partition period dates before grant export. |
| **Gap** | $\text{start}_B > \text{end}_A$ | Uncovered temporal gap; transactions fall outside audit. | Adjust start/end dates to maintain complete audit coverage. |
| **Reversed** | $\text{start}_A > \text{start}_B$ | Chronological inversion. | Correct sequence order. |

---

## Zero-Knowledge Privacy Guarantee

All boundary evaluations and audit grant scope inspections operate strictly on:
1. ISO 8601 UTC timestamps and period identifiers.
2. Anonymized batch run counts and state hashes.

**Guarantees**:
- Individual recipient identities, bank/wallet destinations, and salary amounts are never exposed.
- View keys provide off-chain circuit verification without leaking confidential financial details.
