# Changelog

All notable changes to the ZK Payroll Dashboard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

- **TransactionHistory**: Renders the quick filters toolbar above the results and applies it after search/panel filters; footer count logic extracted to a memo shared with the toolbar
- **Mock data**: `MOCK_TRANSACTIONS` now carry `approvalStatus`, `reconciliationStatus`, and `cancellationReason` state fields for realistic filtering demos (state labels only, amounts unchanged)
- **Types**: `PayrollTransaction` optionally exposes run-state `reconciliationStatus` and `cancellationReason` for history rows

### Testing

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
