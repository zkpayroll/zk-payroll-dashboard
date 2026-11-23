/**
 * Employee payment destination confirmation module (#671).
 *
 * Validates that each employee in a payroll run has explicitly confirmed
 * their payment destination before submission proceeds. This prevents
 * funds from being routed to stale or unconfirmed wallet addresses.
 *
 * Privacy guarantees:
 * - Wallet addresses are never logged or included in error messages.
 * - Only structural validity (format, confirmation flag, staleness) is checked.
 * - No salary amounts, private keys, or proof material are handled.
 */

export type ConfirmationStatus = "confirmed" | "pending" | "stale" | "missing";

export interface EmployeeDestinationRecord {
  readonly employeeId: string;
  readonly walletAddress: string;
  /** ISO timestamp of when the employee last confirmed this destination. */
  readonly confirmedAt: string | null;
  /** ISO timestamp of when the wallet address was last updated. */
  readonly updatedAt: string | null;
}

export interface DestinationConfirmationResult {
  readonly employeeId: string;
  readonly status: ConfirmationStatus;
  readonly error: string | null;
}

export interface BatchDestinationConfirmationSummary {
  readonly totalEmployees: number;
  readonly confirmedCount: number;
  readonly pendingCount: number;
  readonly staleCount: number;
  readonly missingCount: number;
  readonly canProceed: boolean;
  readonly results: readonly DestinationConfirmationResult[];
  readonly blockerMessage: string | null;
}

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

/** Returns true when the address matches the Stellar public key format. */
function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_RE.test(address.trim());
}

/** Evaluates one employee record and returns a typed confirmation result. */
export function evaluateDestinationConfirmation(
  record: EmployeeDestinationRecord,
): DestinationConfirmationResult {
  const { employeeId, walletAddress, confirmedAt, updatedAt } = record;

  if (!employeeId.trim()) {
    return { employeeId, status: "missing", error: "Employee ID is required." };
  }

  if (!walletAddress.trim() || !isValidStellarAddress(walletAddress)) {
    return {
      employeeId,
      status: "missing",
      error: "A valid Stellar wallet address is required.",
    };
  }

  if (!confirmedAt) {
    return {
      employeeId,
      status: "pending",
      error: "Payment destination has not been confirmed by the employee.",
    };
  }

  if (updatedAt && new Date(updatedAt) > new Date(confirmedAt)) {
    return {
      employeeId,
      status: "stale",
      error: "Wallet address was updated after the last confirmation — re-confirmation required.",
    };
  }

  return { employeeId, status: "confirmed", error: null };
}

/**
 * Validates all employee destination records in a batch and returns an
 * aggregate summary. `canProceed` is true only when every record is confirmed.
 */
export function validateBatchDestinationConfirmations(
  records: readonly EmployeeDestinationRecord[],
): BatchDestinationConfirmationSummary {
  if (records.length === 0) {
    return {
      totalEmployees: 0,
      confirmedCount: 0,
      pendingCount: 0,
      staleCount: 0,
      missingCount: 0,
      canProceed: false,
      results: [],
      blockerMessage: "No employee records provided — payroll run cannot proceed.",
    };
  }

  const results = records.map(evaluateDestinationConfirmation);
  const confirmedCount = results.filter((r) => r.status === "confirmed").length;
  const pendingCount = results.filter((r) => r.status === "pending").length;
  const staleCount = results.filter((r) => r.status === "stale").length;
  const missingCount = results.filter((r) => r.status === "missing").length;
  const canProceed = confirmedCount === records.length;

  let blockerMessage: string | null = null;
  if (!canProceed) {
    const blockers = pendingCount + staleCount + missingCount;
    blockerMessage = `${blockers} employee destination(s) require confirmation before this payroll run can proceed.`;
  }

  return {
    totalEmployees: records.length,
    confirmedCount,
    pendingCount,
    staleCount,
    missingCount,
    canProceed,
    results,
    blockerMessage,
  };
}
