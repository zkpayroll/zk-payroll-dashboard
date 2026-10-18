import type { AuditRetentionPolicy } from "@/types/policy";

/**
 * Audit record retention safeguards (#619).
 *
 * Guards dashboard actions that would delete or prune audit records before
 * the configured retention window has elapsed. Enforcement is fail-closed:
 * records inside the window (or flagged immutable under an append-only log)
 * are protected, and every refusal carries an actionable reason.
 */

export interface AuditRecordMeta {
  id: string;
  /** ISO timestamp when the audit record was written. */
  createdAt: string;
  category?: string;
  /** Marks records that must never be pruned (e.g. cryptographic evidence). */
  immutable?: boolean;
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

const MIN_RETENTION_DAYS = 30;
const MAX_RETENTION_DAYS = 3650;

const DAY_MS = 24 * 60 * 60 * 1000;

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
