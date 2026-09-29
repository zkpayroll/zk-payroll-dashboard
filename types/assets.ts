/**
 * Types for Dashboard Asset Availability Safety Check.
 *
 * Privacy-safe domain types for verifying that configured Stellar assets
 * meet payroll eligibility criteria before disbursements are initiated.
 */

export type AssetAvailabilitySafetyStatus = "available" | "warning" | "blocked";

export interface ConfiguredAssetItem {
  code: string;
  issuer?: string;
  label?: string;
}

export interface AssetValidationError {
  assetCode?: string;
  reason: string;
}

export interface AssetAvailabilitySafetyResult {
  /** Overall availability safety status. */
  status: AssetAvailabilitySafetyStatus;
  /** Whether payroll creation and execution is unblocked. */
  canExecutePayroll: boolean;
  /** Valid, supported assets available for payroll. */
  supportedAssets: Array<{
    code: string;
    label: string;
    issuer?: string;
  }>;
  /** Configured assets not in the supported allowlist. */
  unsupportedAssets: string[];
  /** Malformed or invalid asset entries. */
  invalidAssets: AssetValidationError[];
  /** Duplicate asset configurations detected. */
  duplicateAssets: string[];
  /** Human-readable status summary. */
  summaryMessage: string;
  /** Actionable blocker descriptions preventing payroll execution. */
  blockers: string[];
  /** Non-blocking advisory warnings (e.g. ignored unsupported assets). */
  warnings: string[];
  /** Recommended remediation action. */
  remediationAction?: {
    label: string;
    href: string;
  };
}
