/**
 * Payroll owner transfer — incoming acceptance interface (#511).
 *
 * The request half already exists and is complete: `reviewOwnerTransfer()`
 * in src/payroll/ownerTransfer.ts validates the outgoing transfer and
 * `buildOwnerTransferAuditEntry()` produces a masked audit record, and
 * docs/PAYROLL_UX_PATTERNS.md:534 documents the contract — "The request is
 * recorded; the new owner must accept it from their wallet before it takes
 * effect."
 *
 * The accepting half did not exist at all: no request model, no state machine,
 * no accept/decline, and nothing a recipient could act on. This module
 * supplies the missing half as pure functions so the rules can be unit
 * tested, mirroring the request module's style and its privacy posture:
 *
 *   PRIVACY — like the request side, nothing here reads or returns payroll
 *   data. Acceptance decisions are made against addresses, roles and
 *   timestamps. `notes` and any amount are never touched, and every address
 *   is passed through `maskWalletAddress` before it can reach a message.
 *
 * There is no backend endpoint yet (docs/PAYROLL_UX_PATTERNS.md:552), so this
 * is the client-side contract a future API call will have to satisfy.
 */

import { maskWalletAddress } from "./ownerTransfer";

/** Lifecycle of an incoming transfer request. */
export type OwnerTransferRequestStatus =
  /** Recorded, waiting on the recipient. */
  | "pending_acceptance"
  /** Recipient accepted; the transfer takes effect. */
  | "accepted"
  /** Recipient declined; the current owner keeps the role. */
  | "declined"
  /** Past its expiry without a decision. */
  | "expired";

export interface OwnerTransferRequest {
  id: string;
  /** Masked, as produced by buildOwnerTransferAuditEntry. */
  fromOwner: string;
  toOwner: string;
  /** Unmasked recipient address, used to check who may accept. */
  toOwnerAddress: string;
  status: OwnerTransferRequestStatus;
  requestedAt: string;
  /** Set on accept/decline. */
  decidedAt?: string;
  /** Optional recipient-supplied reason. Must not contain payroll data. */
  decisionNote?: string;
  /** Payroll runs still in flight when the request was made. */
  inFlightRunCount: number;
}

/** How long a recipient has to decide before the request lapses. */
export const OWNER_TRANSFER_ACCEPTANCE_WINDOW_MS = 72 * 60 * 60 * 1000;

export type OwnerTransferAcceptanceErrorCode =
  | "unknown_request"
  | "not_recipient"
  | "already_decided"
  | "request_expired"
  | "self_transfer";

export interface OwnerTransferAcceptanceError {
  code: OwnerTransferAcceptanceErrorCode;
  message: string;
}

export type OwnerTransferAcceptanceAction = "accept" | "decline";

export interface OwnerTransferAcceptanceReview {
  /** True when the given wallet may act on this request. */
  canDecide: boolean;
  /** True when the action is `accept` and the transfer would take effect. */
  wouldTakeEffect: boolean;
  /** Effective status, accounting for a lapsed window. */
  effectiveStatus: OwnerTransferRequestStatus;
  /** Blocking problems, in display order. */
  errors: OwnerTransferAcceptanceError[];
  /** Non-blocking notes about what accepting will do. */
  notices: string[];
}

const STATUS_LABELS: Record<OwnerTransferRequestStatus, string> = {
  pending_acceptance: "Awaiting your acceptance",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

/**
 * Whether the acceptance window has closed.
 *
 * A lapsed request must not be acceptable: the current owner has, by now,
 * most likely reassigned the role or revoked the request, and accepting a
 * stale record would silently take the role.
 */
export function isAcceptanceWindowOpen(
  request: OwnerTransferRequest,
  now: number = Date.now(),
): boolean {
  const requestedAt = Date.parse(request.requestedAt);
  if (!Number.isFinite(requestedAt)) return false;
  return now - requestedAt < OWNER_TRANSFER_ACCEPTANCE_WINDOW_MS;
}

/**
 * The status a request actually presents, which may differ from its stored
 * status once the window has closed.
 */
export function effectiveTransferStatus(
  request: OwnerTransferRequest,
  now: number = Date.now(),
): OwnerTransferRequestStatus {
  if (request.status === "pending_acceptance" && !isAcceptanceWindowOpen(request, now)) {
    return "expired";
  }
  return request.status;
}

/**
 * Reviews whether `actingWallet` may accept or decline `request`.
 *
 * @param request The recorded request, as the recipient would see it.
 * @param actingWallet The connected wallet address.
 * @param action Which decision is being attempted.
 * @param now Injected clock so expiry is deterministic in tests.
 */
export function reviewOwnerTransferAcceptance(
  request: OwnerTransferRequest | null | undefined,
  actingWallet: string | null | undefined,
  action: OwnerTransferAcceptanceAction = "accept",
  now: number = Date.now(),
): OwnerTransferAcceptanceReview {
  const errors: OwnerTransferAcceptanceError[] = [];
  const notices: string[] = [];

  if (!request) {
    return {
      canDecide: false,
      wouldTakeEffect: false,
      effectiveStatus: "expired",
      errors: [
        {
          code: "unknown_request",
          message:
            "This transfer request no longer exists. It may have been withdrawn by the current owner, or already completed on another device.",
        },
      ],
      notices,
    };
  }

  const effectiveStatus = effectiveTransferStatus(request, now);
  const wallet = (actingWallet ?? "").trim();

  if (!wallet) {
    errors.push({
      code: "not_recipient",
      message: "Connect the wallet that was nominated to receive this role.",
    });
  } else if (wallet !== request.toOwnerAddress) {
    // Deliberately says only that this is the wrong wallet. It does not
    // confirm the nominated address to a stranger who guesses at it.
    errors.push({
      code: "not_recipient",
      message:
        "This transfer was nominated to a different wallet. Connect the nominated wallet to accept it.",
    });
  }

  if (request.fromOwner === request.toOwner) {
    errors.push({
      code: "self_transfer",
      message:
        "This request nominates the current owner as the recipient, so there is nothing to hand over.",
    });
  }

  if (effectiveStatus === "accepted") {
    errors.push({
      code: "already_decided",
      message: `This transfer was already accepted${request.decidedAt ? ` on ${new Date(request.decidedAt).toLocaleString()}` : ""}. No further action is needed.`,
    });
  } else if (effectiveStatus === "declined") {
    errors.push({
      code: "already_decided",
      message: `This transfer was already declined${request.decidedAt ? ` on ${new Date(request.decidedAt).toLocaleString()}` : ""}. Ask the current owner to nominate a recipient again.`,
    });
  } else if (effectiveStatus === "expired") {
    errors.push({
      code: "request_expired",
      message:
        "This transfer request has expired. Ask the current owner to nominate you again.",
    });
  }

  if (request.inFlightRunCount > 0) {
    notices.push(
      `${request.inFlightRunCount} payroll run${request.inFlightRunCount === 1 ? " is" : "s are"} still in flight. Accepting hands over the role while ${
        request.inFlightRunCount === 1 ? "it runs" : "they run"
      } — confirm you are ready to take those over.`,
    );
  }
  notices.push(
    `Accepting is immediate and cannot be undone from your side. The current owner will lose payroll owner access.`,
  );

  return {
    canDecide: errors.length === 0,
    wouldTakeEffect: errors.length === 0 && action === "accept",
    effectiveStatus,
    errors,
    notices,
  };
}

/** Audit-safe record of a recipient's decision. */
export interface OwnerTransferDecisionAuditEntry {
  action: "payroll_owner_transfer_accepted" | "payroll_owner_transfer_declined";
  requestId: string;
  fromOwner: string;
  toOwner: string;
  decidedAt: string;
}

/**
 * Builds the audit record for a decision.
 *
 * @throws when the review says the action is not permitted, so a caller
 *   cannot accidentally mint an audit entry for a decision that never
 *   legitimately happened.
 */
export function buildOwnerTransferDecisionAuditEntry(
  request: OwnerTransferRequest,
  actingWallet: string,
  action: OwnerTransferAcceptanceAction,
  now: number = Date.now(),
): OwnerTransferDecisionAuditEntry {
  const review = reviewOwnerTransferAcceptance(request, actingWallet, action, now);
  if (!review.canDecide) {
    throw new Error(
      `Cannot ${action} transfer request ${request.id}: ${review.errors.map((e) => e.code).join(", ")}`,
    );
  }
  return {
    action:
      action === "accept"
        ? "payroll_owner_transfer_accepted"
        : "payroll_owner_transfer_declined",
    requestId: request.id,
    fromOwner: request.fromOwner,
    toOwner: maskWalletAddress(request.toOwnerAddress),
    decidedAt: new Date(now).toISOString(),
  };
}

/** Label for a request status, for the recipient-facing UI. */
export function transferStatusLabel(status: OwnerTransferRequestStatus): string {
  return STATUS_LABELS[status];
}
