import type { Employee } from "@/types/models";

/**
 * Employee commitment replacement review (#757).
 *
 * Replacing an employee's salary commitment hash — whether triggered by a
 * salary change, a wallet rotation, or a corrected import — is a sensitive
 * mutation: once applied it is immediately picked up by the next payroll run
 * and cannot be silently reversed without leaving an audit gap. Before this
 * change `updateEmployee()` (see `stores/employees.ts`) applied any partial
 * update, including a brand-new `salaryCommitment`, with no review step and
 * no record of what changed.
 *
 * This module defines the pure decision logic for a review/confirmation gate
 * that must run before such a replacement is committed:
 *  - classify what is actually changing (commitment hash, wallet address, or
 *    both) so the confirmation UI can say exactly what the operator is
 *    approving,
 *  - reject replacements that fail basic structural checks (identical
 *    commitment, empty/malformed commitment, employee not found) with an
 *    actionable, named error code,
 *  - never include the raw `salary` number or a full wallet address in the
 *    error or summary — only hashed/truncated/boolean-safe fields.
 *
 * PRIVACY: nothing returned by this module ever contains `employee.salary`.
 * Commitment hashes and wallet addresses are truncated for display; callers
 * must not reach into the raw `Employee` record when rendering review UI.
 */

export type CommitmentReplacementErrorCode =
  | "EMPLOYEE_NOT_FOUND"
  | "COMMITMENT_UNCHANGED"
  | "COMMITMENT_EMPTY"
  | "COMMITMENT_MALFORMED";

export interface CommitmentReplacementError {
  code: CommitmentReplacementErrorCode;
  message: string;
}

export type CommitmentChangeKind = "commitment_only" | "wallet_only" | "commitment_and_wallet";

export interface CommitmentReplacementReview {
  employeeId: string;
  changeKind: CommitmentChangeKind;
  /** First 10 chars of the current commitment hash, for display only. */
  previousCommitmentPreview: string;
  /** First 10 chars of the proposed commitment hash, for display only. */
  nextCommitmentPreview: string;
  walletChanged: boolean;
  /** Truncated previous wallet address, only present when the wallet changed. */
  previousWalletPreview?: string;
  /** Truncated proposed wallet address, only present when the wallet changed. */
  nextWalletPreview?: string;
}

export interface CommitmentReplacementRequest {
  employee: Employee | undefined;
  nextCommitment: string;
  nextAddress?: string;
}

export type CommitmentReplacementResult =
  | { ok: true; review: CommitmentReplacementReview }
  | { ok: false; error: CommitmentReplacementError };

/** A Soroban-style hex/base32 commitment hash is expected to be non-trivial length. */
const MIN_COMMITMENT_LENGTH = 8;

function truncate(value: string, length = 10): string {
  return value.length <= length ? value : `${value.slice(0, length)}…`;
}

function isWellFormedCommitment(commitment: string): boolean {
  return commitment.trim().length >= MIN_COMMITMENT_LENGTH;
}

/**
 * Validate a proposed commitment replacement and build the review summary
 * that a confirmation dialog should show before the mutation is applied.
 * Returns a tagged result instead of throwing so callers can render
 * actionable, privacy-safe failure states without a try/catch.
 */
export function reviewCommitmentReplacement(
  request: CommitmentReplacementRequest,
): CommitmentReplacementResult {
  const { employee, nextCommitment, nextAddress } = request;

  if (!employee) {
    return {
      ok: false,
      error: {
        code: "EMPLOYEE_NOT_FOUND",
        message: "The employee record could not be found. Refresh and try again.",
      },
    };
  }

  const trimmedNext = nextCommitment.trim();

  if (trimmedNext.length === 0) {
    return {
      ok: false,
      error: {
        code: "COMMITMENT_EMPTY",
        message: "A new commitment hash is required to proceed with the replacement.",
      },
    };
  }

  if (!isWellFormedCommitment(trimmedNext)) {
    return {
      ok: false,
      error: {
        code: "COMMITMENT_MALFORMED",
        message: "The new commitment hash is too short to be valid. Re-generate it before confirming.",
      },
    };
  }

  const walletChanged = Boolean(nextAddress) && nextAddress !== employee.address;
  const commitmentChanged = trimmedNext !== employee.salaryCommitment;

  if (!commitmentChanged && !walletChanged) {
    return {
      ok: false,
      error: {
        code: "COMMITMENT_UNCHANGED",
        message: "The proposed commitment and wallet address match the current record — nothing to replace.",
      },
    };
  }

  const changeKind: CommitmentChangeKind =
    commitmentChanged && walletChanged
      ? "commitment_and_wallet"
      : walletChanged
        ? "wallet_only"
        : "commitment_only";

  return {
    ok: true,
    review: {
      employeeId: employee.id,
      changeKind,
      previousCommitmentPreview: truncate(employee.salaryCommitment),
      nextCommitmentPreview: truncate(trimmedNext),
      walletChanged,
      previousWalletPreview: walletChanged ? truncate(employee.address) : undefined,
      nextWalletPreview: walletChanged && nextAddress ? truncate(nextAddress) : undefined,
    },
  };
}

export const COMMITMENT_CHANGE_KIND_LABELS: Record<CommitmentChangeKind, string> = {
  commitment_only: "Salary commitment hash",
  wallet_only: "Wallet address",
  commitment_and_wallet: "Salary commitment hash and wallet address",
};
