# Changelog

All notable changes to the ZK Payroll Dashboard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Organization Policy Migration Validation (#599)**: Validates an organization's
  payroll policy configuration against the current configuration schema before it is
  used for payroll or migrated.
  - New `validateCompanyConfigMigration` API (`lib/company/policyMigration.ts`)
    detecting schema version, migration eligibility, and already-current state
  - New `configSchemaVersion` field on `CompanyConfig` (defaults to version 1 when
    absent; current version is 2) with legacy-policy migration guardrails
  - Actionable migration banner and per-issue messages in the Configuration Health
    checker (Company Setup and Settings pages)
  - Focused unit tests for valid, invalid, unsupported-version, and already-current
    policy states

- **Dashboard payout destination change review (#596)**: Interactive review component and validation rules for reviewing, confirming, or rejecting employee payout destination changes in the dashboard layer of ZK Payroll
  - Address verification prevents confirming invalid Stellar address formats or unchanged addresses matching the previous destination
  - Cooldown guardrail enforces wallet rotation cooldown lock to prevent destination changes mid-cooldown
  - Actionable feedback displays clear error banners (`role="alert"`) and inline validation when confirming or rejecting requests
  - Rejection validation requires an explicit rationale of at least 5 characters with maximum length bounds
  - Dual-mode interface: single-employee drawer review and dashboard-wide overview of all pending destination changes
  - Zero PII / salary leakage: Stellar addresses remain masked (`GDQP2K…4W37`) and financial details are never rendered or logged
  - New modules: `src/payroll/payoutDestinationReview.ts`, `components/review/PayoutDestinationChangeReview.tsx`, `components/features/payroll/PayoutDestinationChangeReview.tsx`

- **SDK Blocked Execution Diagnostics** (#605): Pure, privacy-preserving diagnostics engine in the SDK layer for identifying, categorizing, and explaining why a payroll execution is blocked prior to on-chain submission.
  - Identifies blockers and warnings across treasury reserves, ZK proof readiness/freshness, contract pause states, batch capacity limits, executive approvals, recipient eligibility, wallet rotation cooldowns, session authentication, and **run lifecycle state** (already-executed and cancelled runs).
  - New `RUN_ALREADY_EXECUTED` blocker: prevents re-submission of a run that already has a recorded `executedAt` on-chain confirmation timestamp.
  - New `RUN_CANCELLED` blocker: prevents execution of any run whose status is `cancelled`, regardless of other conditions.
  - `diagnosePayrollRun` convenience helper now automatically derives `isAlreadyExecuted` from `run.executedAt` and `isCancelled` from `run.status === "cancelled"`, so domain-model consumers get lifecycle protection without manual flag wiring.
  - Structured `BlockedExecutionReport` rollup with categorized diagnostics, primary blocker identification, typed remediations, and formatted privacy-safe text reports.
  - Exported through `lib/sdk/blockedExecutionDiagnostics.ts` and SDK root index `lib/sdk/index.ts`.

### Fixed

- **Blocked-execution test mocks** (#605): Corrected all five `PayrollRun` object literals in `__tests__/blocked-execution-diagnostics.test.ts` that would have failed `tsc --noEmit` under `strict: true`:
  - Added missing required `PayrollTransaction` fields (`companyId`, `timestamp`, `createdAt`) to every mock.
  - Changed `status: "completed"` to `status: "verified"` — `"completed"` is not a member of the `"pending" | "verified" | "failed" | "cancelled"` union.
  - Replaced `proof` object literals (`{ circuit, hash, timestamp, status }`) with plain proof-hash strings matching `PayrollTransaction.proof: string`.
  - Removed excess properties (`date`, `type`, `recipient`, `amount`) that are not defined on `PayrollRun` or `PayrollTransaction` and would be rejected by TypeScript's strict excess-property checking.
- **Payroll instruction version badge** (#534): The payroll wizard now shows which payroll instruction (compiled policy payload) governs the run
  - The review and confirmation steps render a version pill next to the "Payroll instructions" label, comparing the version snapshotted when the draft started against the currently saved policy version
  - Indigo `vN` when the draft matches the active policy; amber `vN · drafted` with a tooltip when a newer policy version was saved mid-run — the run keeps its drafted version instead of silently adopting new rules, and the tooltip names the remediation (start a new draft)
  - Snapshots are taken from the **saved** policy only, mirroring the payout limit indicator; unsaved editor edits never affect an in-flight run
  - Restored legacy drafts without a snapshot render the active version as current; runs with no saved policy version hide the badge entirely
  - State-only rendering: the badge carries version numbers and operational metadata only — no amounts, employee data, wallet addresses, or digest material

- **New modules**:
  - `src/payroll/instructionVersion.ts`: Pure version sanitization, draft snapshotting, and privacy-safe status/label derivation (unit tested)
  - `components/features/payroll/PayrollInstructionVersionBadge.tsx`: Accessible version pill with current/stale/unconfigured states and tooltip detail

- **Withholding configuration form validation** (#535): Interactive form component and validation rules for withholding rates, threshold amounts, jurisdiction codes, and effective dates with privacy guardrails preventing salary/PII leakage.
- **Deactivated asset status banner** (#550): Alert banner component and status validation warning operators when a settlement asset is deactivated and offering remediation steps.
- **Payroll period health summary card** (#549): Summary card displaying overall period health status score, treasury funding readiness, cutoff deadlines, and active blockers.
- **Request ID support panel** (#551): Operational support panel and diagnostic bundle generator enabling safe, sanitized trace ID copying for support tickets.
- **Multi-asset rounding explanation tooltip** (#544): An info tooltip next to each asset total on the multi-asset payroll review explains 7-decimal Stellar settlement, how totals are displayed, and the maximum rounding drift for the group (based only on the payment count, never on individual salaries). Keyboard, hover and click accessible; closes on Escape.
- **Visual Regression Coverage for Payroll Status Badges**: Status colours, labels, and contrast are now declared in one contract and asserted by tests, so a failed run cannot quietly render in green
  - `src/payroll/statusBadges.ts` owns the approved label, badge variant, and colour pair for every run lifecycle status (`pending`, `verified`, `failed`, `cancelled`) and every reconciliation outcome (`matched`, `pending`, `mismatched`, `failed`, `manually_reviewed`)
  - `components/ui/StatusBadge.tsx` and `components/features/payroll/ReconciliationBadge.tsx` now read their labels and variants from that contract, so a change is made once and covered by tests; rendered output is unchanged
  - WCAG 2.1 contrast is measured, not assumed: each payroll badge colour pair is scored against the 4.5:1 AA floor for its 12px text, and an unapproved shade fails as unresolvable rather than being quietly accepted
  - Colour-collision detection rejects two statuses on one surface that would be indistinguishable at a glance
  - Label inspection rejects digits, currency symbols, contact details, and over-long labels, so a badge can never carry an amount, a count, or a counterparty
  - Failure diagnostics are actionable but value-free: they name the status, the expected pair, the actual pair, and the measured ratio, so they are safe to print in CI logs
  - The shared `destructive` variant measures 3.60:1 and is recorded in `KNOWN_STATUS_BADGE_CONTRAST_DEVIATIONS` as a tracked deviation; the suite fails if a deviation is claimed for a colour the payroll badges actually use
  - `__tests__/visual-regression/payroll-status-badges.test.tsx` adds 52 tests and 11 snapshots covering per-status rendering, a side-by-side colour family, contrast, collisions, label privacy, and edge cases (unrecognised status, empty status, upper-case status, hidden icon)

- **Privacy-Safe Operational Notes on Payroll Runs (#530)**: Admins can attach handoff context to a payroll run, and a note can never become a place where a salary figure or employee data is stored
  - Rendered as an "Operational Notes" panel on the payroll run detail screen (`/payroll/[id]`), above the employee results table
  - Clear states: empty, live character counter (280 limit), inline `role="alert"` block with per-category rewrite guidance, `role="status"` save confirmation, read-only restriction banner for non-admins, and a lock notice on cancelled or failed runs
  - Blocked content is reported by category — salary or payment amount, employee personal data (roster name, email, wallet address, employee id), and credential or secret — and the message never echoes the note text back
  - Dates (`2026-09-25`), years, batch references (`20260925`), small counts, and compensation vocabulary without a figure ("compensation review", "Q1 bonus run") remain writable so ordinary operations are not blocked
  - The store re-runs the same rules on write, so the role check, run lock, and privacy scan cannot be bypassed by calling the store directly
  - Session-scoped and in-memory only: notes are not persisted to `localStorage` and are not sent to a payroll API, log, or telemetry event; `buildRunNoteAuditEntry` emits run id, note id, role, character count, and timestamp for any future audit trail without the note body

- **New modules**:
  - `lib/privacy/runNotes.ts`: Sensitive-content scanner (compensation / employee identity / credential) and privacy-safe audit metadata builder (unit tested)
  - `src/payroll/runNotes.ts`: Length budget, validation states, admin-only role gate, and run lock rules (unit tested)
  - `stores/payrollRunNotes.ts`: In-memory note store with admin-gated writes, `lastError` surfacing, and body-free audit entries
  - `components/features/payroll/PayrollRunNotesPanel.tsx`: Accessible note panel with editor, findings list, and empty/locked/read-only states

- **Inactive Employee Payroll Warning (#293)**: Reviewer-facing warning for inactive or suspended employees left behind in a payroll draft
  - Payroll drafts store employee ids only, so each draft entry is re-resolved against the current roster every time a reviewer looks at it
  - Shown on the wizard review step, the pre-signing payload review screen (`/payroll/review`), and the executive approvals screen (`/payroll/approvals`)
  - Clear states: silent when every draft entry is eligible, amber warning for inactive or suspended employees, red critical alert when the draft references an id that is no longer in the roster (stale draft data)
  - Every alert names the affected employees, labels the eligibility reason, and lists the two ways to resolve it: drop them from the draft or restore their status on the lifecycle screen
  - The wizard's existing "inactive or invalid employee data" signing blocker now also catches lifecycle suspensions and offboarded records, and names the affected employees instead of a generic message
  - State-only rendering: a warning carries the employee id, display name, and eligibility reason — salary, salary commitment, wallet address, and any other amount never enter the warning, the risk factor text, a log, or telemetry

- **New modules**:
  - `src/payroll/inactiveEmployees.ts`: Pure eligibility rules (`getIneligibilityReason`), draft-order flagging with stale-id detection, reason labels, and the privacy-safe warning/message builder (unit tested)
  - `components/warnings/InactiveEmployeeWarning.tsx`: Accessible `role="alert"` reviewer banner with the affected-employee list, severity variant, and next steps

- **Payroll Submission Progress Stepper (#295)**: Progress visibility for the six-stage payroll submission lifecycle
  - Stages: validation, approval, signing, submission, confirmation, reconciliation
  - Clear per-stage states: in progress, complete, pending, failed, and skipped (cancelled runs)
  - Rendered above the payroll wizard's step nav during execution, on the payroll run detail page for in-flight and historical runs, and as a compact progress column in transaction history rows
  - Stage derivation is a pure, unit-tested module reusable from wizard state, run records, or the redacted payroll event stream
  - State-only rendering: no amounts, employee data, wallet addresses, proofs, or transaction hashes are shown

- **New modules**:
  - `src/payroll/submissionProgress.ts`: Pure stage-ordering, state derivation, summaries, and event-stream mapping (unit tested)
  - `components/stepper/PayrollSubmissionStepper.tsx`: Accessible stepper (nav/list semantics, state markers, compact mode)
  - `components/stepper/SubmissionProgressCell.tsx`: Inline six-dot progress cell with screen-reader summary for table rows

- **Payroll Quick Filters Toolbar (#284)**: One-click filtering of the transaction history by lifecycle state
  - Chip groups for status, approval state, risk state, treasury readiness, and reconciliation outcome
  - Faceted counts on each chip update as other filters narrow the list
  - Toggle semantics (re-click to clear a group) plus a single "Clear quick filters" action
  - Quick filters compose with the existing search, filter panel, and saved views; counts stack in the header filter badge
  - Derived risk and treasury facets are computed from run state only — no salary, employee, wallet, or proof data is surfaced

- **New modules**:
  - `src/payroll/quickFilters.ts`: Pure facet derivation, matching, toggling, and faceted counts (unit tested)
  - `components/filters/PayrollQuickFilters.tsx`: Reusable, accessible toolbar (fieldset/group/checkbox semantics)

### Changed

- **PayrollRunDetail**: Accepts a `userRole` prop (default `operator`) and renders the operational notes panel; the role is also forwarded to the cancellation dialog so role-gated affordances on the run screen agree
- **Payroll run page** (`app/payroll/[id]/page.tsx`): Resolves the signed-in role from the session cookie (`verifySessionToken`) and falls back to `operator`, so only an authenticated admin sees the note editor
- **PayrollWizard**: The review step shows the inactive/suspended employee warning above the draft roster, the confirmation-step signing blocker now also trips on lifecycle suspensions, offboarded records, and stale draft ids, naming the affected employees, and both review and confirmation steps render the payroll instruction version badge comparing the draft's snapshotted policy version against the active one (#534)
- **PayrollReviewRiskScoring**: The `inactive_employee` risk factor now shares the draft eligibility rules, so suspended and offboarded employees (previously scored as clean) and unresolved draft ids are caught; the factor description names them
- **Payroll approvals and payload review screens**: Render the shared reviewer warning above the existing risk score and payload inspector
- **TransactionHistory**: Renders the quick filters toolbar above the results and applies it after search/panel filters; footer count logic extracted to a memo shared with the toolbar
- **Mock data**: `MOCK_TRANSACTIONS` now carry `approvalStatus`, `reconciliationStatus`, and `cancellationReason` state fields for realistic filtering demos (state labels only, amounts unchanged)
- **Types**: `PayrollTransaction` optionally exposes run-state `reconciliationStatus` and `cancellationReason` for history rows

### Testing

- `__tests__/instruction-version-rule.test.ts`: Unit tests for version sanitization (fractional, zero, negative, NaN), draft snapshotting, current/stale/unconfigured derivation (including draft-newer-than-saved), the wizard store delegation, and a privacy assertion that no amount, address, or employee id survives into a label or detail
- `__tests__/instruction-version-badge.test.tsx`: Component tests for the current and stale pill states (including the "drafted" marker and aria-label), hidden unconfigured state, snapshot/clear store behaviour, and agreement between the shared derivation and the badge
- `__tests__/inactive-employees-rule.test.ts`: 16 unit tests for eligibility reasons (active, pending, inactive, suspended, offboarded), draft-order flagging, stale-id detection, de-duplication, severity escalation, and a privacy assertion that no salary, commitment, or wallet value survives into a warning
- `__tests__/inactive-employee-warning.test.tsx`: 7 component tests for the clean (silent) state, the amber warning naming inactive and suspended employees, the critical stale-record state, redaction of amounts, and the risk-score factor for a suspended employee
- `__tests__/inactive-employee-payroll-wizard.test.tsx`: 3 integration tests covering a suspended employee blocking wallet signing, an all-active draft staying unblocked, and the reviewer warning with next steps on the draft review step
- `__tests__/payroll-quick-filters.test.ts`: 21 unit tests for derivation, matching, toggle immutability, and faceted counts
- `__tests__/payroll-quick-filters-toolbar.test.tsx`: 10 component/integration tests covering chip toggling, counts, empty-result guidance, clear-all, archived mode, and a privacy assertion that the toolbar never renders amounts, hashes, proofs, or employee data

### Transaction Detail Drawer (previously tracked under [Unreleased])

- **Transaction Detail Drawer**: Comprehensive detail view for inspecting payroll transactions
  - View transaction summary with total amount and employee count
  - Display verification status with clear visual indicators and explanations
  - Show timeline with creation and verification timestamps
  - View zero-knowledge proof (masked by default, revealed on demand)
  - Display blockchain transaction hash with copy-to-clipboard functionality
  - Direct link to Stellar Expert blockchain explorer
  - Privacy notice explaining data protection measures
  - Responsive slide-out drawer interface
  - Full accessibility support with ARIA labels and keyboard navigation
  - Clickable table rows for quick access
  - Dedicated "Details" button in actions column

- **Reconciliation status history**:
  - Added namespaced badges for `Matched`, `Pending`, `Mismatched`, `Failed`, and `Manually reviewed` outcomes
  - Added reconciliation-aware filtering, search, CSV labels, and legacy `complete`/`partial` normalization
  - Added privacy-safe status resolution that does not render private payroll values

- **UI Components**:
  - `Sheet`: Slide-out drawer component based on Radix UI Dialog
  - `Badge`: Status indicator component with multiple variants
  - `ScrollArea`: Scrollable content area based on Radix UI

- **Testing**:
  - Comprehensive test suite for TransactionDetailDrawer component
  - Tests for status display, proof masking, clipboard operations, and null handling
  - Reconciliation resolver, badge, filtering, legacy mapping, privacy, and edge-case coverage

- **Documentation**:
  - Detailed feature documentation in `docs/TRANSACTION_DETAIL_FEATURE.md`
  - User guide in `docs/TRANSACTION_DETAIL_USAGE.md`
  - Updated README with feature highlights

#### Changed

- **TransactionHistory**: Enhanced with transaction detail integration
  - Added hover effects on table rows
  - Added "Details" button in new Actions column
  - Added click handlers for opening detail view
  - Updated column count in empty state
  - Import and use TransactionDetailDrawer component
  - Renders the #284 quick filters toolbar above the results (see Added above)

#### Technical Details

- Implemented progressive disclosure pattern for sensitive data
- Added value masking utility for ZK proofs
- Integrated clipboard API with user feedback
- Used Tailwind CSS for consistent styling
- Followed accessibility best practices (WCAG AA)
- Maintained privacy-first design principles

#### Security

- ZK proofs masked by default to prevent accidental exposure
- Individual salaries remain encrypted and hidden
- Clear privacy notice on every transaction detail view
- Secure external links with `noopener` and `noreferrer`

#### Dependencies

- Added `@radix-ui/react-dialog` ^1.1.17
- Added `@radix-ui/react-scroll-area` ^1.2.12

## Previous Versions

### To be documented from git history
