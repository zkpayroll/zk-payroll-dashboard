# Beneficiary Changes UI Behavior

## Overview

This document describes the UI behavior and validation for beneficiary changes in the ZK Payroll Dashboard, including the salary commitment version impact and recovery flows.

## Salary Commitment Versions

When a beneficiary is changed on an active salary commitment:

- **Version Increment**: The salary commitment version is incremented automatically
- **Active Period**: The new beneficiary takes effect immediately for future payroll cycles
- **Historical Data**: Previous payroll records retain the original beneficiary information
- **Verification**: The commitment hash is updated to reflect the new beneficiary

## UI Validation Rules

### Beneficiary Address Validation

1. **Address Format**
   - Must be a valid Stellar public key (starting with 'G' or 'g')
   - Must be 56 characters long
   - Must pass Stellar address validation

2. **Address Uniqueness**
   - Cannot be the same as current beneficiary
   - Cannot be a zero/null address
   - Must be an active Stellar account

3. **Permission Requirements**
   - Only salary administrators can change beneficiary
   - Change requires explicit confirmation
   - Audit trail is recorded for all changes

## UI Components

### Beneficiary Change Dialog

- Shows current and new beneficiary information
- Displays version increment warning
- Requires confirmation checkbox
- Shows estimated impact on future payroll

### Validation Feedback

- Real-time address validation
- Clear error messages for invalid inputs
- Success notification on completion
- Automatic UI refresh with new beneficiary

## Recovery Flow

### Undo Capability

- Users can revert to previous beneficiary within 24 hours
- Recovery requires administrative access
- Audit log shows all beneficiary changes

### Error Recovery

- If change fails, original beneficiary is preserved
- Clear error message indicates the issue
- Retry option is provided
- Support contact information is displayed

## Commitment Versioning

The salary commitment version is automatically incremented when:

1. Beneficiary address changes
2. Salary amount changes (for new commitments)
3. Any critical parameters are modified

This ensures blockchain verification always references the correct commitment version.
