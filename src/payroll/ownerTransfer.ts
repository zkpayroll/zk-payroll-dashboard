/**
 * Payroll owner transfer review (#546).
 *
 * The payroll "owner" is the company admin wallet that controls treasury and
 * payroll execution. Handing it to another account is irreversible from the
 * current owner's side, so the review screen validates the transfer up front
 * and requires an explicit typed confirmation before it can be submitted.
 *
 * Everything here is pure (no store, no network) so the rules can be unit
 * tested, and nothing here reads or returns salary data: error, warning and
 * audit messages only ever reference role names, counts and masked addresses.
 */

import { StrKey } from "@stellar/stellar-sdk";

/** The phrase the reviewer must type to confirm the transfer. */
export const OWNER_TRANSFER_CONFIRMATION_PHRASE = "TRANSFER OWNERSHIP";

export interface OwnerTransferParty {
  /** Stable id (role-directory member id), or null for a manually entered address. */
  id: string | null;
  /** Display label, e.g. "Payroll Operator". Never a salary or amount. */
  name: string;
  walletAddress: string;
  /** Current payroll role, if the account already holds one. */
  role?: string;
}

export interface OwnerTransferInput {
  currentOwner: OwnerTransferParty;
  candidate: OwnerTransferParty | null;
  /** Payroll runs still in flight (e.g. status "pending"). */
  inFlightRunCount: number;
  confirmationText: string;
  acknowledged: boolean;
}

export type OwnerTransferErrorCode =
  | "no_candidate"
  | "invalid_address"
  | "same_as_current_owner"
  | "runs_in_flight"
  | "confirmation_mismatch"
  | "not_acknowledged";

export interface OwnerTransferIssue<C extends string> {
  code: C;
  message: string;
}

export type OwnerTransferWarningCode = "candidate_read_only_role" | "candidate_outside_directory";

export interface OwnerTransferReview {
  /** True when the transfer may be submitted. */
  canSubmit: boolean;
  /** Blocking problems, in display order. */
  errors: OwnerTransferIssue<OwnerTransferErrorCode>[];
  /** Non-blocking things the reviewer should know before confirming. */
  warnings: OwnerTransferIssue<OwnerTransferWarningCode>[];
}

/** Roles whose holders are not expected to control funds. */
const READ_ONLY_ROLES = new Set(["auditor", "complianceReviewer"]);

/** Valid Stellar account (G…) address, checksum included. */
export function isValidStellarAccount(address: string): boolean {
  const value = address.trim();
  try {
    return StrKey.isValidEd25519PublicKey(value);
  } catch {
    return false;
  }
}

/** Shows enough of an address to recognise it, e.g. `GDQP2K…4W37`. */
export function maskWalletAddress(address: string): string {
  const value = address.trim();
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

/**
 * Validate a proposed owner transfer. The rules are:
 * blocking — a candidate is chosen, its address is a valid Stellar account,
 * it differs from the current owner, no payroll run is in flight (the owner
 * signs those runs), the confirmation phrase matches exactly and the reviewer
 * ticked the acknowledgement.
 */
export function reviewOwnerTransfer(input: OwnerTransferInput): OwnerTransferReview {
  const errors: OwnerTransferIssue<OwnerTransferErrorCode>[] = [];
  const warnings: OwnerTransferIssue<OwnerTransferWarningCode>[] = [];
  const { candidate, currentOwner } = input;

  if (!candidate || candidate.walletAddress.trim() === "") {
    errors.push({ code: "no_candidate", message: "Choose the account that will become the new owner." });
  } else if (!isValidStellarAccount(candidate.walletAddress)) {
    errors.push({
      code: "invalid_address",
      message: "The new owner's wallet is not a valid Stellar account address (it should start with G).",
    });
  } else if (candidate.walletAddress.trim() === currentOwner.walletAddress.trim()) {
    errors.push({
      code: "same_as_current_owner",
      message: "This account already owns the payroll. Choose a different account.",
    });
  }

  if (input.inFlightRunCount > 0) {
    const n = input.inFlightRunCount;
    errors.push({
      code: "runs_in_flight",
      message: `${n} payroll run${n === 1 ? " is" : "s are"} still in progress. Finish or cancel ${
        n === 1 ? "it" : "them"
      } before transferring ownership, because the owner signs in-flight runs.`,
    });
  }

  if (input.confirmationText.trim() !== OWNER_TRANSFER_CONFIRMATION_PHRASE) {
    errors.push({
      code: "confirmation_mismatch",
      message: `Type ${OWNER_TRANSFER_CONFIRMATION_PHRASE} exactly to confirm.`,
    });
  }

  if (!input.acknowledged) {
    errors.push({
      code: "not_acknowledged",
      message: "Confirm that you understand you will lose owner access.",
    });
  }

  if (candidate && candidate.walletAddress.trim() !== "") {
    if (candidate.role && READ_ONLY_ROLES.has(candidate.role)) {
      warnings.push({
        code: "candidate_read_only_role",
        message:
          "The new owner currently has a read-only role. Ownership will give them full treasury and payroll control.",
      });
    }
    if (candidate.id === null) {
      warnings.push({
        code: "candidate_outside_directory",
        message:
          "This address is not in the role directory. Double-check it with the recipient; a transfer to the wrong address cannot be undone by you.",
      });
    }
  }

  return { canSubmit: errors.length === 0, errors, warnings };
}

export interface OwnerTransferAuditEntry {
  action: "payroll_owner_transfer_requested";
  /** Masked addresses only; never the full wallet or any payroll amounts. */
  fromOwner: string;
  toOwner: string;
  requestedAt: string;
}

/** Audit-safe record of a submitted transfer request. */
export function buildOwnerTransferAuditEntry(
  currentOwner: OwnerTransferParty,
  candidate: OwnerTransferParty,
  requestedAt: Date = new Date(),
): OwnerTransferAuditEntry {
  return {
    action: "payroll_owner_transfer_requested",
    fromOwner: maskWalletAddress(currentOwner.walletAddress),
    toOwner: maskWalletAddress(candidate.walletAddress),
    requestedAt: requestedAt.toISOString(),
  };
}
