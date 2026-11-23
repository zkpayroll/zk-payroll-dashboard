import type { AuditRetentionPolicy } from "@/types/policy";

/**
 * Audit record retention safeguards (#619, #859).
 *
 * Guards dashboard actions that would delete or prune audit records before
 * the configured retention window has elapsed or while payroll settlement is
 * still pending. Enforcement is fail-closed: records inside the window, tied
 * to pending or unverified settlements, or flagged immutable under an
 * append-only log are protected, and every refusal carries an actionable,
 * privacy-safe reason.
 */

export type AuditSettlementState =
  | "settled"
  | "finalized"
  | "verified"
  | "completed"
  | "pending"
  | "in_progress"
  | "submitting"
  | "executing"
  | "awaiting_confirmation"
  | "unconfirmed"
  | "paused"
  | "failed"
  | "disputed"
  | "unknown";

export type RecordSettlementClassification =
  | "settled"
  | "pending"
  | "unverified"
  | "unspecified";

export interface AuditRecordMeta {
  id: string;
  /** ISO timestamp when the audit record was written. */
  createdAt: string;
  category?: string;
  /** Marks records that must never be pruned (e.g. cryptographic evidence). */
  immutable?: boolean;
  /** True when the associated payroll run or batch still has a pending settlement (#859). */
  settlementPending?: boolean;
  /** Lifecycle finality state of the associated payroll settlement (#859). */
  settlementStatus?: AuditSettlementState | (string & {}) | null;
}

export interface RetentionGuardDecision {
  recordId: string;
  allowed: boolean;
  /** Actionable, privacy-safe reasons (never salary or employee data). */
  reasons: string[];
}

export interface RetentionEvaluation {
  /** True when the policy itself is usable for enforcement. */
  policyValid: boolean;
  policyErrors: string[];
  decisions: RetentionGuardDecision[];
  protectedCount: number;
  prunableCount: number;
  /** True when every record is protected from deletion. */
  allProtected: boolean;
}

export type RetentionPurgeBlockerCode =
  | "INVALID_POLICY"
  | "SETTLEMENT_PENDING"
  | "SETTLEMENT_UNVERIFIED"
  | "IMMUTABLE_AUDIT_LOG"
  | "NO_EXPIRED_RECORDS";

export interface RetentionPurgeGuardOptions {
  /** External signal indicating at least one payroll settlement is currently pending. */
  hasPendingSettlement?: boolean;
  /** Explicit count of pending settlements across active or archived runs. */
  pendingSettlementCount?: number;
  /** When true, records without an explicit finalized settlement status fail closed. */
  requireExplicitSettlementState?: boolean;
}

export interface RetentionPurgeGuardResult {
  /** True only when retention purge may proceed safely right now. */
  purgeAllowed: boolean;
  blockerCode: RetentionPurgeBlockerCode | null;
  /** Primary actionable, privacy-safe explanation for operator UI and rejections. */
  primaryReason: string;
  /** Complete list of active blocking reasons (never hides secondary policy holds). */
  reasons: string[];
  pendingSettlementCount: number;
  unverifiedSettlementCount: number;
  purgableRecordIds: string[];
  evaluation: RetentionEvaluation;
}

const MIN_RETENTION_DAYS = 30;
const MAX_RETENTION_DAYS = 3650;

const DAY_MS = 24 * 60 * 60 * 1000;

const FINALIZED_SETTLEMENT_STATUSES = new Set<string>([
  "settled",
  "finalized",
  "verified",
  "completed",
]);

const PENDING_SETTLEMENT_LABELS: Record<string, string> = {
  pending: "pending",
  in_progress: "in progress",
  submitting: "submitting",
  executing: "in progress",
  awaiting_confirmation: "awaiting confirmation",
  unconfirmed: "unconfirmed",
  paused: "paused",
};

/**
 * Classifies settlement finality for retention enforcement without echoing
 * arbitrary caller strings into messages.
 */
export function classifyRecordSettlementState(
  record: Pick<AuditRecordMeta, "settlementPending" | "settlementStatus">,
  requireExplicitSettled: boolean = false,
): RecordSettlementClassification {
  if (record.settlementPending === true) {
    return "pending";
  }

  if (record.settlementStatus === undefined) {
    return requireExplicitSettled ? "unverified" : "unspecified";
  }

  if (
    record.settlementStatus === null ||
    typeof record.settlementStatus !== "string"
  ) {
    return "unverified";
  }

  const normalized = record.settlementStatus.trim().toLowerCase();
  if (!normalized) {
    return "unverified";
  }

  if (FINALIZED_SETTLEMENT_STATUSES.has(normalized)) {
    return "settled";
  }

  if (
    Object.prototype.hasOwnProperty.call(PENDING_SETTLEMENT_LABELS, normalized)
  ) {
    return "pending";
  }

  return "unverified";
}

export function isSettlementPendingForRetention(
  record: Pick<AuditRecordMeta, "settlementPending" | "settlementStatus">,
): boolean {
  return classifyRecordSettlementState(record, false) === "pending";
}

export function isSettlementFinalizedForRetention(
  record: Pick<AuditRecordMeta, "settlementPending" | "settlementStatus">,
): boolean {
  return classifyRecordSettlementState(record, true) === "settled";
}

function validatePolicy(policy: AuditRetentionPolicy): string[] {
  const errors: string[] = [];
  const days = policy.retentionPeriodDays;
  if (!Number.isFinite(days) || !Number.isInteger(days)) {
    errors.push(
      "Retention period must be a whole number of days (e.g. 365).",
    );
  } else if (days < MIN_RETENTION_DAYS) {
    errors.push(
      `Retention period must be at least ${MIN_RETENTION_DAYS} days for audit compliance.`,
    );
  } else if (days > MAX_RETENTION_DAYS) {
    errors.push(
      `Retention period cannot exceed ${MAX_RETENTION_DAYS} days.`,
    );
  }
  return errors;
}

function formatDays(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Evaluates whether each audit record may be deleted/pruned under the given
 * policy, as of `now`.
 */
export function evaluateAuditRetention(
  records: AuditRecordMeta[],
  policy: AuditRetentionPolicy,
  now: number = Date.now(),
): RetentionEvaluation {
  const policyErrors = validatePolicy(policy);

  if (policyErrors.length > 0) {
    return {
      policyValid: false,
      policyErrors,
      decisions: records.map((record) => ({
        recordId: record.id,
        allowed: false,
        reasons: [
          "Deletion blocked: the retention policy is invalid. Fix the policy before pruning audit records.",
        ],
      })),
      protectedCount: records.length,
      prunableCount: 0,
      allProtected: records.length > 0,
    };
  }

  const retentionMs = policy.retentionPeriodDays * DAY_MS;
  const decisions = records.map<RetentionGuardDecision>((record) => {
    const reasons: string[] = [];
    const createdMs = new Date(record.createdAt).getTime();

    if (!Number.isFinite(createdMs)) {
      reasons.push(
        "Record has an unparseable creation timestamp. Repair the record before any deletion.",
      );
    } else if (now - createdMs < retentionMs) {
      const daysLeft = Math.ceil(
        (createdMs + retentionMs - now) / DAY_MS,
      );
      reasons.push(
        `Within the ${formatDays(policy.retentionPeriodDays)} retention window — ${formatDays(Math.max(daysLeft, 1))} remain before this record is prunable.`,
      );
    }

    const settlementState = classifyRecordSettlementState(record, false);
    if (settlementState === "pending") {
      const normalizedKey =
        typeof record.settlementStatus === "string"
          ? record.settlementStatus.trim().toLowerCase()
          : "";
      const stateDetail = Object.prototype.hasOwnProperty.call(
        PENDING_SETTLEMENT_LABELS,
        normalizedKey,
      )
        ? ` (${PENDING_SETTLEMENT_LABELS[normalizedKey]})`
        : "";
      reasons.push(
        `Retention purge blocked: settlement is still pending${stateDetail}. Wait until on-chain settlement is finalized before pruning.`,
      );
    } else if (settlementState === "unverified") {
      reasons.push(
        "Retention purge blocked: settlement finality is unverified. Confirm completed settlement before pruning.",
      );
    }

    if (record.immutable) {
      reasons.push(
        "Record is flagged immutable and cannot be pruned while the append-only audit log is active.",
      );
    } else if (policy.immutableAuditLog) {
      reasons.push(
        `Deletion blocked: the audit log is append-only under the current policy. Disable append-only logging via policy settings before pruning.`,
      );
    }

    return {
      recordId: record.id,
      allowed: reasons.length === 0,
      reasons,
    };
  });

  const protectedCount = decisions.filter((d) => !d.allowed).length;
  return {
    policyValid: true,
    policyErrors: [],
    decisions,
    protectedCount,
    prunableCount: decisions.length - protectedCount,
    allProtected: protectedCount === decisions.length && records.length > 0,
  };
}

/**
 * Convenience filter: the subset of records that may be pruned right now.
 */
export function filterPrunableAuditRecords(
  records: AuditRecordMeta[],
  policy: AuditRetentionPolicy,
  now: number = Date.now(),
): AuditRecordMeta[] {
  const evaluation = evaluateAuditRetention(records, policy, now);
  const prunableIds = new Set(
    evaluation.decisions.filter((d) => d.allowed).map((d) => d.recordId),
  );
  return records.filter((r) => prunableIds.has(r.id));
}

/**
 * Batch/dashboard-level retention purge safeguard (#859).
 *
 * Disables retention purge entirely while any settlement is pending or
 * unverified, preventing premature removal of historical payroll commitments,
 * receipts, or reconciliation context during an active settlement window.
 */
export function evaluateRetentionPurgeGuard(
  records: AuditRecordMeta[],
  policy: AuditRetentionPolicy,
  now: number = Date.now(),
  options: RetentionPurgeGuardOptions = {},
): RetentionPurgeGuardResult {
  const requireExplicit = Boolean(options.requireExplicitSettlementState);
  const externalPendingCount =
    typeof options.pendingSettlementCount === "number" &&
    Number.isFinite(options.pendingSettlementCount) &&
    options.pendingSettlementCount > 0
      ? Math.floor(options.pendingSettlementCount)
      : options.hasPendingSettlement
        ? 1
        : 0;

  let recordPendingCount = 0;
  let unverifiedSettlementCount = 0;

  const normalizedRecords = records.map<AuditRecordMeta>((record) => {
    const state = classifyRecordSettlementState(record, requireExplicit);
    if (state === "pending") {
      recordPendingCount += 1;
    } else if (state === "unverified") {
      unverifiedSettlementCount += 1;
    }

    if (externalPendingCount > 0 && state !== "pending") {
      return {
        ...record,
        settlementPending: true,
      };
    }

    if (
      requireExplicit &&
      record.settlementStatus === undefined &&
      record.settlementPending !== true
    ) {
      return {
        ...record,
        settlementStatus: "unknown",
      };
    }

    return record;
  });

  const pendingSettlementCount = Math.max(
    recordPendingCount,
    externalPendingCount,
  );
  const evaluation = evaluateAuditRetention(normalizedRecords, policy, now);

  if (!evaluation.policyValid) {
    const primaryReason =
      evaluation.policyErrors[0] ??
      "Retention purge is disabled because the retention policy is invalid.";
    return {
      purgeAllowed: false,
      blockerCode: "INVALID_POLICY",
      primaryReason,
      reasons: [...evaluation.policyErrors],
      pendingSettlementCount,
      unverifiedSettlementCount,
      purgableRecordIds: [],
      evaluation,
    };
  }

  if (pendingSettlementCount > 0) {
    const subject =
      pendingSettlementCount === 1
        ? "1 payroll settlement is"
        : `${pendingSettlementCount} payroll settlements are`;
    const primaryReason = `Retention purge is disabled while ${subject} pending confirmation. Finalize on-chain settlement in Reconciliation or Transaction History before purging expired records.`;
    const reasons = [primaryReason];
    if (policy.immutableAuditLog) {
      reasons.push(
        "Append-only audit logging is also active under the current retention policy.",
      );
    }
    return {
      purgeAllowed: false,
      blockerCode: "SETTLEMENT_PENDING",
      primaryReason,
      reasons,
      pendingSettlementCount,
      unverifiedSettlementCount,
      purgableRecordIds: [],
      evaluation,
    };
  }

  if (unverifiedSettlementCount > 0) {
    const subject =
      unverifiedSettlementCount === 1
        ? "1 record has"
        : `${unverifiedSettlementCount} records have`;
    const primaryReason = `Retention purge is disabled because ${subject} an unverified settlement state. Confirm completed settlement before purging expired records.`;
    const reasons = [primaryReason];
    if (policy.immutableAuditLog) {
      reasons.push(
        "Append-only audit logging is also active under the current retention policy.",
      );
    }
    return {
      purgeAllowed: false,
      blockerCode: "SETTLEMENT_UNVERIFIED",
      primaryReason,
      reasons,
      pendingSettlementCount: 0,
      unverifiedSettlementCount,
      purgableRecordIds: [],
      evaluation,
    };
  }

  if (policy.immutableAuditLog) {
    const primaryReason =
      "Retention purge is disabled while append-only audit logging is active. Update Audit & Retention policy settings if pruning is authorized.";
    return {
      purgeAllowed: false,
      blockerCode: "IMMUTABLE_AUDIT_LOG",
      primaryReason,
      reasons: [primaryReason],
      pendingSettlementCount: 0,
      unverifiedSettlementCount: 0,
      purgableRecordIds: [],
      evaluation,
    };
  }

  const purgableRecordIds = evaluation.decisions
    .filter((decision) => decision.allowed)
    .map((decision) => decision.recordId);

  if (purgableRecordIds.length === 0) {
    const primaryReason = `No settled records have passed the ${formatDays(policy.retentionPeriodDays)} retention window yet.`;
    return {
      purgeAllowed: false,
      blockerCode: "NO_EXPIRED_RECORDS",
      primaryReason,
      reasons: [primaryReason],
      pendingSettlementCount: 0,
      unverifiedSettlementCount: 0,
      purgableRecordIds: [],
      evaluation,
    };
  }

  const eligibleLabel =
    purgableRecordIds.length === 1
      ? "1 settled record is"
      : `${purgableRecordIds.length} settled records are`;
  return {
    purgeAllowed: true,
    blockerCode: null,
    primaryReason: `${eligibleLabel} past the ${formatDays(policy.retentionPeriodDays)} retention window and eligible for purge.`,
    reasons: [],
    pendingSettlementCount: 0,
    unverifiedSettlementCount: 0,
    purgableRecordIds,
    evaluation,
  };
}

