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

- **UI Components**:
  - `Sheet`: Slide-out drawer component based on Radix UI Dialog
  - `Badge`: Status indicator component with multiple variants
  - `ScrollArea`: Scrollable content area based on Radix UI

- **Testing**:
  - Comprehensive test suite for TransactionDetailDrawer component
  - Tests for status display, proof masking, clipboard operations, and null handling

- **Documentation**:
  - Detailed feature documentation in `docs/TRANSACTION_DETAIL_FEATURE.md`
  - User guide in `docs/TRANSACTION_DETAIL_USAGE.md`
  - Updated README with feature highlights

### Changed

- **TransactionHistory**: Enhanced with transaction detail integration
  - Added hover effects on table rows
  - Added "Details" button in new Actions column
  - Added click handlers for opening detail view
  - Updated column count in empty state
  - Import and use TransactionDetailDrawer component

### Technical Details

- Implemented progressive disclosure pattern for sensitive data
- Added value masking utility for ZK proofs
- Integrated clipboard API with user feedback
- Used Tailwind CSS for consistent styling
- Followed accessibility best practices (WCAG AA)
- Maintained privacy-first design principles

### Security

- ZK proofs masked by default to prevent accidental exposure
- Individual salaries remain encrypted and hidden
- Clear privacy notice on every transaction detail view
- Secure external links with `noopener` and `noreferrer`

### Dependencies

- Added `@radix-ui/react-dialog` ^1.1.17
- Added `@radix-ui/react-scroll-area` ^1.2.12

## Previous Versions

### To be documented from git history
