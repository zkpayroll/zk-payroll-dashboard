/**
 * Approval expiry evaluation for payroll batches.
 * Mirrors proof freshness pattern: active / expiring_soon / expired / missing
 * Privacy-safe: only timestamps and status strings are evaluated, no salary values.
 */

export type ApprovalExpiryState = "active" | "expiring_soon" | "expired" | "missing";

export const APPROVAL_EXPIRING_WINDOW_MS = 48 * 60 * 60 * 1000; // 48h

export interface ApprovalExpiryInput {
  /** ISO timestamp when approval was granted, if any */
  approvedAt?: string | null;
  /** ISO timestamp when approval expires, if any */
  expiresAt?: string | null;
  /** Explicit approval status, if the approval was revoked/expired */
  approvalStatus?: string | null;
  /** Whether approval record exists at all */
  hasApproval?: boolean;
}

export interface ApprovalExpiryEvaluation {
  state: ApprovalExpiryState;
  label: string;
  message: string;
  remainingMs: number | null;
  blocksExecution: boolean;
}

/**
 * Evaluate approval expiry state.
 * - missing: no approval record attached
 * - expired: past expiry or explicitly marked expired/revoked
 * - expiring_soon: within window of expiry
 * - active: comfortably valid
 */
export function evaluateApprovalExpiry(
  input: ApprovalExpiryInput,
  now: number = Date.now()
): ApprovalExpiryEvaluation {
  const { approvedAt, expiresAt, approvalStatus, hasApproval } = input;

  // Explicit missing: no record at all
  if (hasApproval === false || (!approvedAt && !expiresAt && !approvalStatus)) {
    return {
      state: "missing",
      label: "Approval missing",
      message: "No executive approval is attached. Request approval before executing.",
      remainingMs: null,
      blocksExecution: true,
    };
  }

  // Explicit expired/revoked status strings
  const normalizedStatus = (approvalStatus ?? "").toLowerCase();
  if (normalizedStatus === "expired" || normalizedStatus === "revoked" || normalizedStatus === "rejected") {
    return {
      state: "expired",
      label: "Approval expired",
      message:
        normalizedStatus === "revoked"
          ? "This approval was revoked. A fresh approval is required before execution."
          : normalizedStatus === "rejected"
          ? "This batch was rejected during approval. Address feedback and resubmit."
          : "The approval window has expired. Request a new approval before executing.",
      remainingMs: null,
      blocksExecution: true,
    };
  }

  // No expiry timestamp — treat as active but warn if not approved
  if (!expiresAt) {
    if (approvedAt) {
      return {
        state: "active",
        label: "Approval active",
        message: "Approval is active and ready for execution.",
        remainingMs: null,
        blocksExecution: false,
      };
    }
    return {
      state: "missing",
      label: "Approval missing",
      message: "Approval metadata is incomplete. Verify the approval record before executing.",
      remainingMs: null,
      blocksExecution: true,
    };
  }

  const expiresAtMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return {
      state: "missing",
      label: "Approval missing",
      message: "Approval expiry is invalid. Re-validate the approval before executing.",
      remainingMs: null,
      blocksExecution: true,
    };
  }

  if (expiresAtMs <= now) {
    return {
      state: "expired",
      label: "Approval expired",
      message: "Approval has expired. Execution will fail until a fresh approval is obtained.",
      remainingMs: 0,
      blocksExecution: true,
    };
  }

  const remainingMs = expiresAtMs - now;
  if (remainingMs <= APPROVAL_EXPIRING_WINDOW_MS) {
    return {
      state: "expiring_soon",
      label: "Approval expiring soon",
      message: "Approval expires soon. If execution may be delayed, renew approval first.",
      remainingMs,
      blocksExecution: false,
    };
  }

  return {
    state: "active",
    label: "Approval active",
    message: "Approval is valid and comfortably ahead of its expiry window.",
    remainingMs,
    blocksExecution: false,
  };
}

export function formatApprovalCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
