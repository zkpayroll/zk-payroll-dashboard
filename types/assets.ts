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

/**
 * Types for Dashboard Payment Asset Compatibility Validation (#626).
 *
 * Privacy-safe domain types for verifying that the Stellar assets intended to
 * pay a set of employees are compatible — supported, correctly issued, and
 * consistent across every payment — before a payroll run is executed.
 *
 * Results only ever surface asset codes, issuer accounts, opaque counts, and
 * human-readable messages. Employee identities, wallet addresses, and payment
 * amounts are deliberately never surfaced.
 */

export type PaymentAssetCompatibilityStatus =
  | "compatible"
  | "warning"
  | "incompatible";

/** A single intended payment: which asset an employee should be paid in. */
export interface PaymentAssetTarget {
  /**
   * Opaque employee reference. Accepted for grouping by callers, but it is
   * never surfaced in a compatibility result (privacy-safe).
   */
  employeeId?: string;
  /** Stellar asset code the employee expects to be paid in. */
  assetCode?: string;
  /** Issuer account for issued assets; must be omitted for native XLM. */
  assetIssuer?: string;
}

/** A malformed or unusable payment target that was skipped. */
export interface PaymentAssetCompatibilityFinding {
  /** Index of the offending target within the input list. */
  index: number;
  /** Asset code, when it could be parsed. */
  assetCode?: string;
  /** Actionable description of why the target was rejected. */
  reason: string;
}

/** An asset that every compatible payment target agrees on. */
export interface CompatiblePaymentAsset {
  code: string;
  label: string;
  /** Resolved issuer account; omitted for native XLM. */
  issuer?: string;
  /** Number of payment targets that resolve to this asset. */
  paymentCount: number;
}

/** The same asset code assigned with two or more different issuer accounts. */
export interface PaymentAssetIssuerConflict {
  code: string;
  /** Distinct issuer accounts observed (empty for native assets). */
  issuers: string[];
  /** Actionable description of the conflict. */
  reason: string;
}

export interface PaymentAssetCompatibilityResult {
  status: PaymentAssetCompatibilityStatus;
  /** Whether the payroll run can proceed with the compatible assets. */
  canRunPayroll: boolean;
  /** Assets that are safe to pay with, and how many targets use each. */
  compatibleAssets: CompatiblePaymentAsset[];
  /** Assigned asset codes that are not on the supported allowlist. */
  unsupportedAssets: string[];
  /** Malformed payment targets that were skipped. */
  invalidTargets: PaymentAssetCompatibilityFinding[];
  /** Asset codes assigned with conflicting issuer accounts. */
  issuerConflicts: PaymentAssetIssuerConflict[];
  /** Issued assets whose issuer does not match the supported issuer. */
  issuerMismatches: PaymentAssetCompatibilityFinding[];
  /** Human-readable status summary. */
  summaryMessage: string;
  /** Actionable blockers preventing the payroll run. */
  blockers: string[];
  /** Non-blocking advisory warnings (e.g. ignored unsupported assets). */
  warnings: string[];
  /** Recommended remediation action. */
  remediationAction?: {
    label: string;
    href: string;
  };
}
