export type SettlementLifecycleStage =
  | "initiated"
  | "proof_verified"
  | "submitted"
  | "settled"
  | "reconciled"
  | "failed"
  | "cancelled";

export type SettlementOrderingErrorCode =
  | "missing_event_id"
  | "invalid_ledger_sequence"
  | "negative_tx_index"
  | "negative_op_index"
  | "invalid_timestamp";

export interface SettlementOrderingIssue {
  eventId: string;
  code: SettlementOrderingErrorCode;
  message: string;
}

export interface SettlementEventLike {
  id: string;
  ledgerSequence?: number | null;
  txIndex?: number | null;
  opIndex?: number | null;
  confirmationNonce?: string | number | null;
  timestamp?: string | null;
  createdAt?: string | null;
  status?: string | null;
  stage?: SettlementLifecycleStage | null;
  txHash?: string | null;
  proof?: string | null;
}

export interface OrderSettlementEventsOptions {
  /**
   * Direction across distinct ledgers/timestamps.
   * Defaults to `"desc"` (newest ledger first) for transaction history tables.
   */
  ledgerDirection?: "asc" | "desc";
  /**
   * Tie-breaking direction for events recorded in the same ledger.
   * Defaults to `"asc"` (causal execution order: lower txIndex -> opIndex -> lifecycle stage first).
   */
  sameLedgerDirection?: "asc" | "desc";
}

export interface OrderSettlementEventsResult<T extends SettlementEventLike> {
  ordered: T[];
  issues: SettlementOrderingIssue[];
}

const STAGE_ORDER: Record<SettlementLifecycleStage, number> = {
  initiated: 1,
  proof_verified: 2,
  submitted: 3,
  settled: 4,
  reconciled: 5,
  failed: 6,
  cancelled: 7,
};

const STATUS_FALLBACK_ORDER: Record<string, number> = {
  pending: 1,
  paused: 2,
  verified: 3,
  failed: 4,
  cancelled: 5,
};

function parseConfirmationNonce(nonce: string | number | null | undefined): bigint | null {
  if (typeof nonce === "number" && Number.isFinite(nonce) && nonce >= 0) {
    return BigInt(Math.trunc(nonce));
  }
  if (typeof nonce === "string" && /^\d+$/.test(nonce.trim())) {
    try {
      return BigInt(nonce.trim());
    } catch {
      return null;
    }
  }
  return null;
}

function resolveTimestampMs(event: SettlementEventLike): number | null {
  const raw = event.createdAt ?? event.timestamp ?? null;
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function resolveStageRank(event: SettlementEventLike): number {
  if (event.stage && event.stage in STAGE_ORDER) {
    return STAGE_ORDER[event.stage];
  }
  if (event.status && event.status in STATUS_FALLBACK_ORDER) {
    return STATUS_FALLBACK_ORDER[event.status];
  }
  return 99;
}

/**
 * Validates a settlement event for deterministic ordering and returns
 * actionable issues when ledger/operation coordinates are malformed (#854).
 */
export function validateSettlementEventCoordinates(
  event: SettlementEventLike,
): SettlementOrderingIssue[] {
  const issues: SettlementOrderingIssue[] = [];
  const eventId = event.id?.trim() || "<missing-id>";

  if (!event.id || !event.id.trim()) {
    issues.push({
      eventId,
      code: "missing_event_id",
      message: "Settlement event is missing a stable identifier for tie-breaking.",
    });
  }

  if (
    event.ledgerSequence !== undefined &&
    event.ledgerSequence !== null &&
    (!Number.isInteger(event.ledgerSequence) || event.ledgerSequence <= 0)
  ) {
    issues.push({
      eventId,
      code: "invalid_ledger_sequence",
      message: `Settlement event ${eventId} has an invalid ledgerSequence (${String(event.ledgerSequence)}). Must be a positive integer.`,
    });
  }

  if (
    event.txIndex !== undefined &&
    event.txIndex !== null &&
    (!Number.isInteger(event.txIndex) || event.txIndex < 0)
  ) {
    issues.push({
      eventId,
      code: "negative_tx_index",
      message: `Settlement event ${eventId} has a negative or non-integer txIndex (${String(event.txIndex)}).`,
    });
  }

  if (
    event.opIndex !== undefined &&
    event.opIndex !== null &&
    (!Number.isInteger(event.opIndex) || event.opIndex < 0)
  ) {
    issues.push({
      eventId,
      code: "negative_op_index",
      message: `Settlement event ${eventId} has a negative or non-integer opIndex (${String(event.opIndex)}).`,
    });
  }

  const rawTime = event.createdAt ?? event.timestamp;
  if (rawTime !== undefined && rawTime !== null && resolveTimestampMs(event) === null) {
    issues.push({
      eventId,
      code: "invalid_timestamp",
      message: `Settlement event ${eventId} has an unparseable timestamp.`,
    });
  }

  return issues;
}

/**
 * Deterministic comparator for payroll settlement events (#854).
 * Orders across distinct ledgers/timestamps using `ledgerDirection`, and breaks
 * same-ledger ties deterministically by `txIndex`, `opIndex`, `confirmationNonce`,
 * lifecycle stage rank, and `id`.
 */
export function compareSettlementEvents(
  a: SettlementEventLike,
  b: SettlementEventLike,
  options: OrderSettlementEventsOptions = {},
): number {
  const ledgerMul = (options.ledgerDirection ?? "desc") === "desc" ? -1 : 1;
  const intraMul = (options.sameLedgerDirection ?? "asc") === "asc" ? 1 : -1;

  const aLedger =
    typeof a.ledgerSequence === "number" && Number.isInteger(a.ledgerSequence) && a.ledgerSequence > 0
      ? a.ledgerSequence
      : null;
  const bLedger =
    typeof b.ledgerSequence === "number" && Number.isInteger(b.ledgerSequence) && b.ledgerSequence > 0
      ? b.ledgerSequence
      : null;

  if (aLedger !== null && bLedger !== null && aLedger !== bLedger) {
    return (aLedger - bLedger) * ledgerMul;
  }

  const aTime = resolveTimestampMs(a);
  const bTime = resolveTimestampMs(b);
  if (
    (aLedger === null || bLedger === null) &&
    aTime !== null &&
    bTime !== null &&
    aTime !== bTime
  ) {
    return (aTime - bTime) * ledgerMul;
  }

  // Same-ledger (or identical-timestamp) deterministic tie-breakers:
  const aTx =
    typeof a.txIndex === "number" && Number.isInteger(a.txIndex) && a.txIndex >= 0
      ? a.txIndex
      : null;
  const bTx =
    typeof b.txIndex === "number" && Number.isInteger(b.txIndex) && b.txIndex >= 0
      ? b.txIndex
      : null;
  if (aTx !== null && bTx !== null && aTx !== bTx) {
    return (aTx - bTx) * intraMul;
  }

  const aOp =
    typeof a.opIndex === "number" && Number.isInteger(a.opIndex) && a.opIndex >= 0
      ? a.opIndex
      : null;
  const bOp =
    typeof b.opIndex === "number" && Number.isInteger(b.opIndex) && b.opIndex >= 0
      ? b.opIndex
      : null;
  if (aOp !== null && bOp !== null && aOp !== bOp) {
    return (aOp - bOp) * intraMul;
  }

  const aNonce = parseConfirmationNonce(a.confirmationNonce);
  const bNonce = parseConfirmationNonce(b.confirmationNonce);
  if (aNonce !== null && bNonce !== null && aNonce !== bNonce) {
    return (aNonce < bNonce ? -1 : 1) * intraMul;
  }

  const aStage = resolveStageRank(a);
  const bStage = resolveStageRank(b);
  if (aStage !== bStage) {
    return (aStage - bStage) * intraMul;
  }

  if (aTime !== null && bTime !== null && aTime !== bTime) {
    return (aTime - bTime) * intraMul;
  }

  return (a.id ?? "").localeCompare(b.id ?? "") * intraMul;
}

/**
 * Returns a new array of settlement events sorted deterministically alongside
 * any coordinate validation issues (#854). Never mutates the input array.
 */
export function orderSettlementEvents<T extends SettlementEventLike>(
  events: readonly T[],
  options: OrderSettlementEventsOptions = {},
): OrderSettlementEventsResult<T> {
  const issues: SettlementOrderingIssue[] = [];
  for (const event of events) {
    issues.push(...validateSettlementEventCoordinates(event));
  }

  const ordered = [...events].sort((a, b) =>
    compareSettlementEvents(a, b, options),
  );

  return { ordered, issues };
}

/**
 * Redacts sensitive zero-knowledge proof payloads and masks raw transaction
 * hashes before rendering settlement event diagnostics (#854).
 */
export function sanitizeSettlementEventForDisplay<T extends SettlementEventLike>(
  event: T,
): T & { maskedTxHash: string | null } {
  const rawHash = event.txHash?.trim() ?? "";
  const maskedTxHash = rawHash
    ? rawHash.length > 12
      ? `${rawHash.slice(0, 6)}…${rawHash.slice(-4)}`
      : rawHash
    : null;

  return {
    ...event,
    ...(event.proof ? { proof: "[REDACTED_ZK_PROOF]" } : {}),
    maskedTxHash,
  };
}
