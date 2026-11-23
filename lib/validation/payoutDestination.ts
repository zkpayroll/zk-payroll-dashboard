/**
 * Client-side validation for payout destinations.
 *
 * These rules mirror the server-side Zod schema so that the UI can give
 * actionable feedback before the form is submitted.
 *
 * Privacy:  This module NEVER handles or validates raw salary amounts.
 *           It only validates the structural correctness of wallet addresses,
 *           asset codes, and related non-financial fields.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Stellar account IDs start with G and are exactly 56 alphanumeric characters. */
const STELLAR_ADDRESS_REGEX = /^G[A-Z0-9]{55}$/;

/**
 * Well-known asset codes accepted for payroll disbursements.
 * This list is intentionally conservative — unknown codes are rejected.
 */
export const ALLOWED_ASSET_CODES = ["USDC", "EURC", "XLM"] as const;
export type AllowedAssetCode = (typeof ALLOWED_ASSET_CODES)[number];

// ─── Field-level validators ───────────────────────────────────────────────────

/** Returns an error string if the address is invalid, or null if valid. */
export function validateStellarAddress(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed) return "Wallet address is required.";
  if (!STELLAR_ADDRESS_REGEX.test(trimmed)) {
    return "Invalid Stellar address. Must start with G and be exactly 56 characters.";
  }
  return null;
}

/** Returns an error string if the asset code is not allowed, or null. */
export function validateAssetCode(code: string): string | null {
  if (!code.trim()) return "Asset code is required.";
  if (
    !(ALLOWED_ASSET_CODES as readonly string[]).includes(
      code.trim().toUpperCase(),
    )
  ) {
    return `Unsupported asset. Allowed values: ${ALLOWED_ASSET_CODES.join(", ")}.`;
  }
  return null;
}

/** Returns an error string if the employee ID is empty, or null. */
export function validateEmployeeId(id: string): string | null {
  if (!id.trim()) return "Employee ID is required.";
  return null;
}

// ─── Full destination row ─────────────────────────────────────────────────────

export interface PayoutDestinationInput {
  employeeId: string;
  walletAddress: string;
  assetCode: string;
}

export interface PayoutDestinationErrors {
  employeeId?: string;
  walletAddress?: string;
  assetCode?: string;
}

/**
 * Validates a single payout destination row.
 * Returns an errors object — if all fields are `undefined` the row is valid.
 */
export function validatePayoutDestination(
  input: PayoutDestinationInput,
): PayoutDestinationErrors {
  return {
    employeeId: validateEmployeeId(input.employeeId) ?? undefined,
    walletAddress: validateStellarAddress(input.walletAddress) ?? undefined,
    assetCode: validateAssetCode(input.assetCode) ?? undefined,
  };
}

/** Returns true when a destination errors object has no errors. */
export function isPayoutDestinationValid(
  errors: PayoutDestinationErrors,
): boolean {
  return !errors.employeeId && !errors.walletAddress && !errors.assetCode;
}

// ─── Batch validation ─────────────────────────────────────────────────────────

export interface BatchValidationResult {
  /** Index-keyed errors — only entries with at least one error are present. */
  rowErrors: Record<number, PayoutDestinationErrors>;
  /**
   * Duplicate wallet addresses across rows (could indicate copy-paste error).
   * Contains the first duplicated address found.
   */
  duplicateAddresses: string[];
  /** True when every row is valid and there are no duplicates. */
  isValid: boolean;
}

/**
 * Validates an array of payout destination rows.
 *
 * Duplicate wallet address detection flags rows that share the same Stellar
 * address across different employees — this is almost always a mistake.
 */
export function validatePayoutDestinations(
  destinations: PayoutDestinationInput[],
): BatchValidationResult {
  const rowErrors: Record<number, PayoutDestinationErrors> = {};

  for (let i = 0; i < destinations.length; i++) {
    const errs = validatePayoutDestination(destinations[i]);
    if (!isPayoutDestinationValid(errs)) {
      rowErrors[i] = errs;
    }
  }

  // Detect duplicate wallet addresses (ignoring empty/invalid ones)
  const seen = new Map<string, number>();
  const duplicateAddresses: string[] = [];

  for (let i = 0; i < destinations.length; i++) {
    const addr = destinations[i].walletAddress.trim();
    if (!addr) continue;
    if (seen.has(addr)) {
      if (!duplicateAddresses.includes(addr)) {
        duplicateAddresses.push(addr);
      }
    } else {
      seen.set(addr, i);
    }
  }

  const isValid =
    Object.keys(rowErrors).length === 0 && duplicateAddresses.length === 0;

  return { rowErrors, duplicateAddresses, isValid };
}

// ─── Payout Destination Change Review Validation (#596) ─────────────────────────

/**
 * Validates a destination address for change review.
 * Accepts Stellar public addresses (starting with G, uppercase alphanumeric, 12 to 56 characters).
 */
export function validateDestinationAddress(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed) {
    return "Destination address is required.";
  }
  if (!trimmed.startsWith("G") && !trimmed.startsWith("g")) {
    return "Invalid destination address format. Stellar public addresses must start with G.";
  }
  if (!/^G[A-Z0-9]{11,55}$/i.test(trimmed)) {
    return "Invalid destination address format. Must be an alphanumeric Stellar address (12-56 characters).";
  }
  return null;
}

export interface PayoutDestinationChangeApprovalInput {
  status?: string;
  previousWallet?: string;
  newWallet?: string;
  isCooldownActive?: boolean;
}

export interface PayoutDestinationChangeValidationResult {
  isValid: boolean;
  error: string | null;
}

/**
 * Validates whether a payout destination change request can be confirmed / approved.
 *
 * Enforces:
 * 1. Request status must be 'pending'.
 * 2. New destination address must be provided and well-formed.
 * 3. New destination must differ from the previous destination.
 * 4. Payout destination must not be locked by an active cooldown.
 */
export function validatePayoutDestinationChangeApproval(
  input: PayoutDestinationChangeApprovalInput,
): PayoutDestinationChangeValidationResult {
  if (input.status && input.status !== "pending") {
    return {
      isValid: false,
      error: `Destination change is in '${input.status}' status and cannot be approved.`,
    };
  }

  const newWallet = input.newWallet?.trim() || "";
  if (!newWallet) {
    return {
      isValid: false,
      error: "New destination address is required.",
    };
  }

  const addressErr = validateDestinationAddress(newWallet);
  if (addressErr) {
    return {
      isValid: false,
      error: addressErr,
    };
  }

  const prevWallet = input.previousWallet?.trim() || "";
  if (prevWallet && newWallet.toUpperCase() === prevWallet.toUpperCase()) {
    return {
      isValid: false,
      error: "Cannot confirm destination: New destination address matches the previous destination address.",
    };
  }

  if (input.isCooldownActive) {
    return {
      isValid: false,
      error: "Cannot confirm destination: Payout destination is locked while an active wallet rotation cooldown is in progress.",
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validates a rejection reason when declining a payout destination change.
 *
 * Enforces:
 * 1. Request status must be 'pending'.
 * 2. Rejection reason must not be empty or whitespace.
 * 3. Rejection reason must be at least 5 characters.
 * 4. Rejection reason must not exceed 300 characters.
 */
export function validatePayoutDestinationChangeRejection(
  reason: string,
  status?: string,
): PayoutDestinationChangeValidationResult {
  if (status && status !== "pending") {
    return {
      isValid: false,
      error: `Destination change is in '${status}' status and cannot be rejected.`,
    };
  }

  const trimmed = reason.trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: "Rejection reason is required to reject a payout destination change.",
    };
  }

  if (trimmed.length < 5) {
    return {
      isValid: false,
      error: "Rejection reason must be at least 5 characters explaining why the destination was rejected.",
    };
  }

  if (trimmed.length > 300) {
    return {
      isValid: false,
      error: "Rejection reason cannot exceed 300 characters.",
    };
  }

  return { isValid: true, error: null };
}

