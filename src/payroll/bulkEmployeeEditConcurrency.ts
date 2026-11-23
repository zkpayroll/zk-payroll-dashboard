/**
 * Bulk employee edit concurrency controls (#694).
 *
 * Prevents conflicting bulk edits from overwriting each other when multiple
 * operators work on the employee roster simultaneously. Each edit session
 * is stamped with a version token derived from the snapshot it was opened
 * against; submission is rejected if the roster has been modified since
 * the session was opened (optimistic locking).
 *
 * Privacy guarantees: version tokens carry only timestamps and session
 * identifiers. No salary amount, employee identity, or proof material is
 * included in tokens or error messages.
 */

export interface BulkEditSession {
  /** Opaque token representing the roster snapshot at session open time. */
  versionToken: string;
  /** ISO timestamp when this session was opened. */
  openedAt: string;
  /** Number of employee records included in this session. */
  recordCount: number;
}

export interface BulkEditSubmission {
  /** Token from the session that produced this edit batch. */
  versionToken: string;
  /** Current version token of the roster (fetched immediately before submit). */
  currentVersionToken: string;
  /** Number of records the caller intends to modify. */
  recordCount: number;
  /** Maximum records permitted in a single bulk edit (0 = unlimited). */
  maxRecordsPerBatch?: number | null;
}

export type BulkEditRejectionReason =
  | "version_conflict"
  | "batch_too_large"
  | "empty_batch"
  | "session_expired";

export interface BulkEditConcurrencyDecision {
  allowed: boolean;
  rejectionReason?: BulkEditRejectionReason;
  /** Operator-facing message; never contains salary or identity data. */
  message: string;
}

export const DEFAULT_MAX_RECORDS_PER_BATCH = 500;
/** Session validity window in milliseconds (30 minutes). */
const SESSION_TTL_MS = 30 * 60 * 1000;

export function openBulkEditSession(recordCount: number): BulkEditSession {
  const now = Date.now();
  const versionToken = `ber_${now}_${Math.random().toString(36).slice(2, 10)}`;
  return {
    versionToken,
    openedAt: new Date(now).toISOString(),
    recordCount,
  };
}

export function isSessionExpired(session: BulkEditSession, now: number = Date.now()): boolean {
  const openedMs = new Date(session.openedAt).getTime();
  return now - openedMs > SESSION_TTL_MS;
}

export function checkBulkEditConcurrency(
  submission: BulkEditSubmission,
  session: BulkEditSession,
  now: number = Date.now(),
): BulkEditConcurrencyDecision {
  if (isSessionExpired(session, now)) {
    return {
      allowed: false,
      rejectionReason: "session_expired",
      message:
        "This edit session has expired (sessions are valid for 30 minutes). Re-open the bulk edit to start a fresh session.",
    };
  }

  if (submission.recordCount === 0) {
    return {
      allowed: false,
      rejectionReason: "empty_batch",
      message: "The edit batch contains no records. Select at least one employee to modify.",
    };
  }

  const maxRecords =
    typeof submission.maxRecordsPerBatch === "number" && submission.maxRecordsPerBatch > 0
      ? submission.maxRecordsPerBatch
      : DEFAULT_MAX_RECORDS_PER_BATCH;

  if (submission.recordCount > maxRecords) {
    return {
      allowed: false,
      rejectionReason: "batch_too_large",
      message: `Bulk edits are limited to ${maxRecords} records per submission. Split the edit into smaller batches.`,
    };
  }

  if (submission.versionToken !== submission.currentVersionToken) {
    return {
      allowed: false,
      rejectionReason: "version_conflict",
      message:
        "The employee roster was modified by another operator after this edit session was opened. Reload the roster to see the latest state, then re-apply your changes.",
    };
  }

  return {
    allowed: true,
    message: `Bulk edit approved for ${submission.recordCount} record${submission.recordCount === 1 ? "" : "s"}.`,
  };
}

export class BulkEditConcurrencyError extends Error {
  decision: BulkEditConcurrencyDecision;

  constructor(decision: BulkEditConcurrencyDecision) {
    super(decision.message);
    this.name = "BulkEditConcurrencyError";
    this.decision = decision;
  }
}

export function assertBulkEditAllowed(
  submission: BulkEditSubmission,
  session: BulkEditSession,
  now?: number,
): void {
  const decision = checkBulkEditConcurrency(submission, session, now);
  if (!decision.allowed) {
    throw new BulkEditConcurrencyError(decision);
  }
}
