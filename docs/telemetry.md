# Telemetry & Privacy Plan

This document outlines the telemetry events tracked in the application, their payload shapes, and the explicit privacy controls to ensure no sensitive payroll or cryptographic data is ever leaked.

## Privacy Guidelines (The "Do Not Collect" List)

The following data fields must **never** be included in telemetry payloads:

- **Identities & PII**: Employee Names, Emails, SSNs, Company Names, Auditor Names.
- **Wallets**: Any Stellar public keys, including employee `address`, `admin` wallet, or `treasury` wallet.
- **Financials**: `salary`, `totalAmount`, `totalPayrollAmount`.
- **ZK & Cryptographic Data**: `proof`, `publicSignals`, `commitment`, `nullifier`, `merkleRoot`, `salt`, `privateInputs`.
- **Identifiers & Hashes**: `employeeIds`, `txHash`, `transactionHash`.

### Error Mapping & Safe Strings

To avoid accidental data leakage from raw exception messages (which may interpolate sensitive values), all error messages sent to telemetry must be mapped to a predefined enum:

- `circuit_error`
- `network_timeout`
- `wallet_rejected`
- `unknown`

### Bucketing

To prevent fingerprinting or identifying very small companies based on exact employee counts, the count of employees in a payroll run is bucketed before being sent (e.g., `"1-5"`, `"6-20"`, `"21-50"`, `"50+"`).

### Reconciliation Status Labels

The normalized reconciliation label is safe operational metadata: `matched`, `pending`, `mismatched`, `failed`, or `manually_reviewed`. It may be used as an enum in product analytics, but must not be accompanied by discrepancy strings, payroll amounts, employee counts, employee identifiers, wallet addresses, proofs, or transaction hashes. The history badge and CSV status column follow the same restriction.

## Event Definitions

### 1. `onboarding_completed`

- **Triggered**: When the user successfully configures their company details in the `CompanySetup` component.
- **Payload Shape**:

  ```ts
  {
    success: boolean;
  }
  ```

- **Excluded**: Company name, admin wallet, treasury wallet.

### 2. `payroll_wizard_started`

- **Triggered**: When the user initiates a payroll run via the `PayrollWizard` component.
- **Payload Shape**:

  ```ts
  {
    employeeCountBucket: string; // e.g., "1-5"
  }
  ```

- **Excluded**: Raw `employeeCount`, `employeeIds`, `totalAmount`.

### 3. `payroll_proof_generation_completed`

- **Triggered**: When the local Zero-Knowledge proof generation process finishes (success or failure).
- **Payload Shape**:

  ```ts
  {
    success: boolean;
    error_type?: "circuit_error" | "network_timeout" | "wallet_rejected" | "unknown";
  }
  ```

- **Excluded**: The ZK `proof` itself, `privateInputs`, employee salaries, SSNs.

### 4. `payroll_submission_completed`

- **Triggered**: When the final transaction is submitted to the Stellar network (success or failure).
- **Payload Shape**:

  ```ts
  {
    success: boolean;
    error_type?: "circuit_error" | "network_timeout" | "wallet_rejected" | "unknown";
  }
  ```

- **Excluded**: `transactionHash`, `totalAmount`, `employeeIds`, the ZK `proof`.
