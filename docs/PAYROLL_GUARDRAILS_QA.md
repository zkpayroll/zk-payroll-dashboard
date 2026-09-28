# Payroll Guardrails — Behaviour & Repeatable QA

Operator-facing reference for the payroll guardrails added in #541–#544. Each
section covers where the feature lives, how it behaves, what it guarantees
about sensitive data, and repeatable manual QA steps (main path, edge case
and failure state) alongside the automated tests that cover it.

> **Privacy rule shared by all four features:** none of them shows, logs or
> echoes salary amounts, wallet addresses or other employee identifiers in
> errors, tooltips, toasts or audit entries.

Run all automated coverage for this page with:

```bash
npx vitest run \
  __tests__/multi-asset-rounding-tooltip.test.tsx \
  __tests__/employee-identifier-format.test.ts \
  __tests__/payout-count-limit-indicator.test.tsx \
  __tests__/audit-hold-release-dialog.test.tsx \
  __tests__/draft-checksum.test.ts \
  __tests__/approval-expiry-badge.test.tsx \
  __tests__/payer-account-status.test.tsx \
  __tests__/pending-payroll-obligations.test.tsx
```

---

## Multi-asset rounding explanation tooltip (#544)

**Where:** Payroll → Multi-asset → open a run. There is an ⓘ button next to each **"*ASSET* total"** card in `MultiAssetPayrollReview`.

**Behaviour** (`describeAssetRounding` in `lib/payroll/multiAsset.ts`):
- Every Stellar asset settles with **7 decimal places**, so each payment is rounded to 0.0000001 of the asset.
- Totals are displayed with 2–7 decimals.
- A group total can differ from an unrounded or converted figure by at most **payment count × ½ stroop**.
- Each asset is rounded independently. There is no cross-asset conversion.
- The tooltip opens on hover, keyboard focus or click, and closes on mouse-leave, blur, a second click or **Escape**.

**Privacy:** the explanation is computed from the asset code and payment count only, never from individual amounts.

| # | Steps | Expected |
|---|-------|----------|
| 1 | Open a multi-asset run and Tab to the ⓘ next to "USDC total" | The tooltip appears. A screen reader announces it through `aria-describedby`. |
| 2 | Read the drift line on a group with several payments | "Across *N* payments … at most *N × 0.00000005* USDC". |
| 3 | Press **Escape** | The tooltip closes. |
| 4 | Edge case: a group with one payment | "With a single payment, rounding affects at most half of one stroop." |
| 5 | Privacy: compare the tooltip text with the employee amounts in that group | No employee amount appears. |

---

## Employee identifier format helper text (#541)

**Where:** Employees → **Add Employee** → *Stellar wallet address* field (`AddEmployeeModal`).

**Behaviour** (`lib/employees/identifierFormat.ts`):
- The hint under the field explains the format: 56 characters, starts with **G**, only **A–Z** and **2–7**, and never a secret key. It is followed by a live `n/56` count.
- On submit, `describeStellarAddressIssue` returns the single most useful fix, in this order:
  1. empty field;
  2. pasted **secret key** (starts with S);
  3. *N* characters missing or too many;
  4. wrong first letter;
  5. lowercase;
  6. invalid characters (0, 1, 8, 9 or symbols).

**Privacy:** error messages never repeat the entered address.

| # | Steps | Expected |
|---|-------|----------|
| 1 | Paste a valid `G…` public key with surrounding spaces and submit | No address error; the spaces are ignored. |
| 2 | Paste a key missing its last 6 characters | "Must be 56 characters — 6 missing…". |
| 3 | Edge case: paste a secret key (`S…`) | "This looks like a secret key… Enter the public key that starts with G instead." |
| 4 | Enter a lowercase copy of a valid key | "Stellar addresses are uppercase…". |
| 5 | Privacy: for each error above, check the message text | The typed value never appears in it. |

---

## Payout count limit indicator (#542)

**Where:** Payroll → Run payroll → **Review** step (`PayrollWizard` → `PayoutCountLimitIndicator`).

**Behaviour** (`getPayoutLimitStatus` in `lib/payroll/payoutLimit.ts`):
- The run's payout count is compared with the **saved** capacity policy's `maxBatchSize`. The default is 500, set in Payroll Policy → Capacity. Unsaved edits don't count.

| State | When | UI |
|-------|------|----|
| `ok` | below 80% of the limit | Neutral: "*N* payouts remaining in this batch." |
| `near` | 80% or more | Yellow warning with the number remaining. |
| `at` | exactly at the limit | Yellow: no more payouts can be added. |
| `over` | above the limit | Red alert with remediation (split into *N* batches or raise the limit). **Continue is disabled.** |
| `unconfigured` | the limit is missing or invalid | Gray prompt to set a limit. Nothing is blocked. |

**Privacy:** only counts are shown. There are no names, addresses or amounts.

| # | Steps | Expected |
|---|-------|----------|
| 1 | Start a run with a few employees | Shows `n / 500`, state `ok`, and Continue is enabled. |
| 2 | Set **Max Batch Size** to the run's size + 1, save, and reopen Review | State `near`, with the remaining count shown. |
| 3 | Failure state: set Max Batch Size below the run's size and save | Red alert: "exceeds the *L*-payout batch limit by *X*. Split it into *B* batches…". Continue is disabled. |
| 4 | Edge case: change Max Batch Size **without saving** | The indicator still uses the saved limit. |

---

## Payroll instruction version badge (#534)

**Where:** Payroll → Run payroll → **Review** and **Confirmation** steps (`PayrollWizard` → `PayrollInstructionVersionBadge`).

**Behaviour** (`getInstructionVersionStatus` in `src/payroll/instructionVersion.ts`):
- A payroll *instruction* is the compiled policy payload that governs a run (saved policy version + digest, compiled by `lib/sdk/payrollPolicyCompiler.ts`).
- The wizard **snapshots the saved policy version when a draft starts**. The badge compares the snapshot with the active saved version; the run keeps its drafted version — it never silently adopts a newer policy.

| State | When | UI |
|-------|------|----|
| `current` | draft snapshot matches the active version (or no snapshot — legacy drafts) | Indigo pill `vN` with a tooltip naming the governing version. |
| `stale` | active saved version differs from the snapshot | Amber pill `vN · drafted` plus a tooltip explaining which version governs the run and how to adopt the newer one (start a new draft). |
| `unconfigured` | no saved policy version exists | Badge is hidden. |

**Privacy:** the badge shows only version numbers and operational metadata — never amounts, employee data, wallet addresses, or digest material.

| # | Steps | Expected |
|---|-------|----------|
| 1 | Start a run with the default policy | Review shows "Payroll instructions" with an indigo `v1` badge; tooltip says the run follows the active policy version. |
| 2 | On Confirm | The same version pill appears next to the Ready/Warning/Blocked status. |
| 3 | Failure state: save a new policy version while a draft is open, then view Review | Amber `v1 · drafted` badge; tooltip says a newer policy (v2) is active and how to adopt it. |
| 4 | Edge case: a restored draft from before this feature (no snapshot) | Badge shows the active version as `current`. |
| 5 | Edge case: unsaved policy edits in the editor | Badge still reflects the **saved** version only. |

---

## Audit hold release confirmation dialog (#543)

**Where:** Compliance → **Holds** tab. Each active hold has a **Release** button, which opens `AuditHoldReleaseDialog`.

**Behaviour:**
- The dialog (`role="alertdialog"`) shows only the hold's reason code, target and placement time.
- **Release Hold** stays disabled until both of these are provided:
  - a written justification of **at least 10 characters** (trimmed);
  - the "*reason for this hold has been resolved*" acknowledgement.
- Escape and Cancel close the dialog, except while the release is in progress. Double submits are blocked.
- On success:
  - the hold stays in the list with a **Released** badge, the release time and the justification;
  - an audit activity entry is recorded;
  - a toast confirms the release.
- Releasing a hold that is missing or already released fails with an actionable error, and the dialog stays open.

**Privacy:** the justification field asks operators not to include salary amounts or personal identifiers.

| # | Steps | Expected |
|---|-------|----------|
| 1 | Place a hold, then click **Release** | The dialog shows the reason code and placement time, and Release Hold is disabled. |
| 2 | Enter a justification of 10+ characters and tick the acknowledgement | Release Hold is enabled. |
| 3 | Confirm | The hold is marked **Released** with the note. There's a new audit feed entry and a success toast. |
| 4 | Edge case: enter a justification of "ok" and tick the box | Release Hold stays disabled. |
| 5 | Failure state: trigger a release error, e.g. a hold already released in another tab | The error appears inline and the dialog stays open. |
| 6 | Press **Escape** | The dialog closes with no change to the hold. |

---

## Draft integrity, approval timestamps, payer status, and pending obligations (#516, #568–#570)

**Where:** Payroll → Run Payroll → Confirmation, Payroll Run Details, and Payroll → Approvals.

- The wizard hashes the reviewed employee commitments, payout destinations, eligibility state, and aggregate total with SHA-256. It compares that digest immediately before submission. A mismatch returns the operator to Review, clears the old proof, and requires a fresh proof before another submission attempt.
- Approval status validates timestamps before showing an active or expiring state. If an approval record has a missing, malformed, future, or inconsistent timestamp, execution is blocked and a recovery message is shown; no payroll values are included.
- The payer status indicator checks account existence against the configured Horizon endpoint. It distinguishes disconnected, checking, active, missing, network-mismatch, and unavailable states. It never renders the wallet address or balance.
- The approvals page lists pending runs using period and recipient-count metadata only. It does not show payroll amounts, employee names, employee IDs, or wallet addresses.

| # | Steps | Expected |
|---|-------|----------|
| 1 | Start a payroll run, review it, generate a proof, and continue to confirmation | Submission is allowed only when the reviewed draft digest still matches. |
| 2 | Change a reviewed draft commitment or payout destination before submission | The wizard returns to Review, shows a privacy-safe mismatch warning, clears the old proof, and requires a new proof. |
| 3 | Open a payroll run whose approval has a malformed or future timestamp | The approval badge shows a blocking validation error and links to the approval workflow. |
| 4 | Open confirmation with the payer wallet disconnected, then connect it | The status changes from a connection prompt to a Horizon account check and then to active or an actionable error state. |
| 5 | Open Payroll → Approvals with pending runs | Pending count, period, recipient count, and review links appear; amounts and employee details remain absent. |
