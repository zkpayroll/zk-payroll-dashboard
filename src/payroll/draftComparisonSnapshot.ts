/**
 * Draft payroll comparison snapshot (#677).
 *
 * Before an operator approves or submits a payroll draft, they must be able to
 * see exactly what changed since the previously approved revision: which
 * recipients were added, removed, or edited, which changes invalidate a prior
 * approval (blocked rows), and how the batch totals moved. This module builds
 * that comparison as a single immutable snapshot value, or explains — with a
 * remediation hint — why a trustworthy comparison cannot be produced.
 *
 * The row-level diff itself is delegated to the existing, tested batch-diff
 * engine (`lib/payroll/batchDiff.ts`); this module adds revision bookkeeping,
 * staleness detection, and totals before/after/delta.
 *
 * Rules:
 *  - A missing current draft yields `{ ok: false, code: "draft_missing" }` —
 *    there is nothing to compare. A missing approved revision is *not* an
 *    error: it is treated as an empty baseline (every current row is an
 *    addition), which is the first-approval case.
 *  - A malformed current draft (rows not an array, or any row missing string
 *    `employeeId`/`walletAddress`/`assetCode`/`salaryCommitment`) yields
 *    `draft_invalid`, as does a payroll-run mismatch or a non-positive
 *    revision number.
 *  - Staleness: if the caller supplies `expectedRevisionNumber` and it differs
 *    from the current revision, or the approved revision is *ahead* of the
 *    current one, the result is `draft_stale` — the viewer is looking at an
 *    outdated draft and must reload.
 *  - Blocked rows (commitment mismatch on an edit, or removal of a previously
 *    approved recipient) mean `requiresReapproval: true`.
 *  - Totals are computed from `salaryAmount` where present and rounded to two
 *    decimals; `delta = currentTotal - approvedTotal`.
 *  - The snapshot embeds the raw diff entries (same privacy model as
 *    `batchDiff`: commitments are safe, salary amounts are private). Use
 *    {@link summarizeDraftComparisonForAudit} for a privacy-safe audit
 *    payload that contains counts and totals only — no wallet addresses, no
 *    per-employee amounts, no names.
 *
 * Privacy guarantees: audit summaries expose only aggregate counts, aggregate
 * totals, and the boolean re-approval flag; per-employee rows, wallet
 * addresses, and salary amounts never leave the snapshot itself.
 */

import {
  type BatchDiffEntry,
  type BatchDiffSummary,
  type BatchRow,
  computeBatchDiff,
  summarizeBatchDiff,
} from "../../lib/payroll/batchDiff";

/** Why a trustworthy comparison could not be produced. */
export type DraftComparisonErrorCode =
  | "draft_missing"
  | "draft_stale"
  | "draft_invalid";

/** A draft revision of a payroll batch. */
export interface DraftRevisionInput {
  /** Stable revision identifier. */
  readonly revisionId: string;
  /** Payroll run the revision belongs to. */
  readonly payrollRunId: string;
  /** Monotonic revision number; higher is newer. */
  readonly revisionNumber: number;
  /** Rows in this revision. */
  readonly rows: readonly BatchRow[];
  /** ISO timestamp of when the revision was saved. */
  readonly updatedAt?: string;
}

/** Input to the draft comparison. */
export interface DraftComparisonRequest {
  /** Payroll run both revisions must belong to. */
  readonly payrollRunId: string;
  /** The draft revision the viewer currently has loaded. */
  readonly current: DraftRevisionInput | null | undefined;
  /** The previously approved revision; null on first approval. */
  readonly approved?: DraftRevisionInput | null;
  /** Revision number the viewer believes is current (staleness check). */
  readonly expectedRevisionNumber?: number;
  /** Comparison time as an ISO timestamp. */
  readonly now?: string;
}

/** Aggregate totals for the batch before/after the draft edits. */
export interface DraftComparisonTotals {
  /** Sum of salary amounts in the approved revision. */
  readonly approvedTotal: number;
  /** Sum of salary amounts in the current revision. */
  readonly currentTotal: number;
  /** `currentTotal - approvedTotal`, rounded to two decimals. */
  readonly delta: number;
}

/** Immutable comparison snapshot for rendering and approval gating. */
export interface DraftComparisonSnapshot {
  /** Payroll run both revisions belong to. */
  readonly payrollRunId: string;
  /** Revision id of the current draft. */
  readonly currentRevisionId: string;
  /** Revision id of the approved baseline (null on first approval). */
  readonly approvedRevisionId: string | null;
  /** ISO timestamp of the comparison. */
  readonly comparedAt: string;
  /** Row-level diff entries from the batch-diff engine. */
  readonly entries: readonly BatchDiffEntry[];
  /** Aggregate diff counts. */
  readonly summary: BatchDiffSummary;
  /** Totals before/after/delta. */
  readonly totals: DraftComparisonTotals;
  /** Employee ids whose rows require re-approval. */
  readonly blockedEmployeeIds: readonly string[];
  /** Whether any change invalidates the prior approval. */
  readonly requiresReapproval: boolean;
}

/** Structured failure explaining why no snapshot could be built. */
export interface DraftComparisonFailure {
  /** Machine-readable failure code. */
  readonly code: DraftComparisonErrorCode;
  /** Operator-facing explanation; contains no personal data. */
  readonly message: string;
  /** Suggested next step for the operator. */
  readonly remediation: string;
}

/** Result union: a snapshot on success, a structured failure otherwise. */
export type DraftComparisonResult =
  | { readonly ok: true; readonly snapshot: DraftComparisonSnapshot }
  | { readonly ok: false; readonly error: DraftComparisonFailure };

/** Reference timestamp used when `now` is omitted (deterministic tests). */
export const DRAFT_COMPARISON_REFERENCE_NOW = "2026-01-01T00:00:00.000Z";

const CENTS_SCALE = 100;

function roundToCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * CENTS_SCALE) / CENTS_SCALE;
}

function sumRows(rows: readonly BatchRow[]): number {
  let total = 0;
  for (const row of rows) {
    if (typeof row.salaryAmount === "number" && Number.isFinite(row.salaryAmount)) {
      total += row.salaryAmount;
    }
  }
  return roundToCents(total);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateRows(rows: unknown): boolean {
  if (!Array.isArray(rows)) return false;
  return rows.every(
    (row) =>
      typeof row === "object" &&
      row !== null &&
      isNonEmptyString((row as BatchRow).employeeId) &&
      isNonEmptyString((row as BatchRow).walletAddress) &&
      isNonEmptyString((row as BatchRow).assetCode) &&
      isNonEmptyString((row as BatchRow).salaryCommitment),
  );
}

function failure(
  code: DraftComparisonErrorCode,
  message: string,
  remediation: string,
): DraftComparisonResult {
  return { ok: false, error: { code, message, remediation } };
}

/**
 * Build a comparison snapshot between the loaded draft and the approved
 * revision, or explain why it cannot be built.
 *
 * Pure and deterministic: identical inputs always produce the same result.
 */
export function compareDraftRevisions(
  request: DraftComparisonRequest,
): DraftComparisonResult {
  const current = request.current;

  if (current === null || current === undefined) {
    return failure(
      "draft_missing",
      "Comparison failed: the current draft revision is missing.",
      "Reload the payroll draft and try the comparison again.",
    );
  }

  if (
    !isNonEmptyString(current.revisionId) ||
    !isNonEmptyString(current.payrollRunId) ||
    !Number.isInteger(current.revisionNumber) ||
    current.revisionNumber <= 0 ||
    !validateRows(current.rows)
  ) {
    return failure(
      "draft_invalid",
      "Comparison failed: the current draft revision is malformed.",
      "Re-import or regenerate the draft, then compare again.",
    );
  }

  if (current.payrollRunId !== request.payrollRunId) {
    return failure(
      "draft_invalid",
      "Comparison failed: the draft revision belongs to a different payroll run.",
      "Open the correct payroll run and compare its draft.",
    );
  }

  if (
    typeof request.expectedRevisionNumber === "number" &&
    request.expectedRevisionNumber !== current.revisionNumber
  ) {
    return failure(
      "draft_stale",
      "Comparison failed: the loaded draft is no longer the latest revision.",
      "Reload the payroll draft to fetch the latest revision.",
    );
  }

  const approved = request.approved ?? null;
  if (approved !== null && approved.revisionNumber > current.revisionNumber) {
    return failure(
      "draft_stale",
      "Comparison failed: the approved revision is newer than the loaded draft.",
      "Reload the payroll draft to fetch the latest revision.",
    );
  }

  const approvedRows: readonly BatchRow[] = approved?.rows ?? [];
  const currentRows: readonly BatchRow[] = current.rows;

  const entries = computeBatchDiff(
    [...currentRows],
    [...approvedRows],
  );
  const summary = summarizeBatchDiff(entries);
  const totals: DraftComparisonTotals = {
    approvedTotal: sumRows(approvedRows),
    currentTotal: sumRows(currentRows),
    delta: roundToCents(sumRows(currentRows) - sumRows(approvedRows)),
  };
  const blockedEmployeeIds = entries
    .filter((entry) => entry.isBlocked)
    .map((entry) => entry.employeeId);

  const snapshot: DraftComparisonSnapshot = {
    payrollRunId: request.payrollRunId,
    currentRevisionId: current.revisionId,
    approvedRevisionId: approved?.revisionId ?? null,
    comparedAt: request.now ?? DRAFT_COMPARISON_REFERENCE_NOW,
    entries,
    summary,
    totals,
    blockedEmployeeIds,
    requiresReapproval: summary.blocked > 0,
  };

  return { ok: true, snapshot };
}

/**
 * Privacy-safe projection of a snapshot for audit logs and shareable
 * summaries: counts and aggregate totals only — no rows, wallets, names, or
 * per-employee amounts.
 */
export function summarizeDraftComparisonForAudit(
  snapshot: DraftComparisonSnapshot,
): {
  payrollRunId: string;
  currentRevisionId: string;
  approvedRevisionId: string | null;
  comparedAt: string;
  additions: number;
  removals: number;
  edits: number;
  unchanged: number;
  blocked: number;
  total: number;
  approvedTotal: number;
  currentTotal: number;
  delta: number;
  requiresReapproval: boolean;
} {
  return {
    payrollRunId: snapshot.payrollRunId,
    currentRevisionId: snapshot.currentRevisionId,
    approvedRevisionId: snapshot.approvedRevisionId,
    comparedAt: snapshot.comparedAt,
    additions: snapshot.summary.additions,
    removals: snapshot.summary.removals,
    edits: snapshot.summary.edits,
    unchanged: snapshot.summary.unchanged,
    blocked: snapshot.summary.blocked,
    total: snapshot.summary.total,
    approvedTotal: snapshot.totals.approvedTotal,
    currentTotal: snapshot.totals.currentTotal,
    delta: snapshot.totals.delta,
    requiresReapproval: snapshot.requiresReapproval,
  };
}

/** Structured error carrying the comparison failure for callers that throw. */
export class DraftComparisonError extends Error {
  /** Machine-readable failure code. */
  readonly code: DraftComparisonErrorCode;
  /** Suggested next step for the operator. */
  readonly remediation: string;

  constructor(failureDetail: DraftComparisonFailure) {
    super(failureDetail.message);
    this.name = "DraftComparisonError";
    this.code = failureDetail.code;
    this.remediation = failureDetail.remediation;
  }
}

/** Throw {@link DraftComparisonError} unless a snapshot could be built. */
export function assertDraftComparison(
  request: DraftComparisonRequest,
): DraftComparisonSnapshot {
  const result = compareDraftRevisions(request);
  if (!result.ok) {
    throw new DraftComparisonError(result.error);
  }
  return result.snapshot;
}
