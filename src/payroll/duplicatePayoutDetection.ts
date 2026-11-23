/**
 * Duplicate payout instruction detection (#682).
 *
 * Guards the "send payouts" step against paying recipients twice. The
 * intra-batch engine from #633 (lib/duplicateDetection) already catches
 * duplicate instructions inside a single draft; this module closes the
 * cross-run gap: it compares the payout batch about to be sent against the
 * history of payouts that were already sent, queued, or reserved, and
 * produces privacy-safe findings with clear remediation.
 *
 * Rules:
 * 1. An instruction id that already appears in an active (sent or queued)
 *    payout is a blocker — re-sending it would execute a duplicate transfer.
 * 2. A batch reference that matches an active payout's reference is a
 *    blocker — the ledger already recorded this reference.
 * 3. Recipients that overlap with an active payout in the same payroll
 *    period are a blocker by default (warning when the policy allows).
 * 4. A candidate whose recipient set is identical to an active payout in the
 *    same period is reported as an identical batch (blocker).
 * 5. Intra-batch duplicates detected by the #633 engine (including id and
 *    reference collisions derived from payout history) are merged into the
 *    same report so operators see every duplicate signal in one place.
 *
 * Failed or cancelled payouts never block a retry unless the policy says
 * otherwise, so a recovery flow is not locked out by its own history.
 *
 * Privacy guarantees: Stellar addresses are masked (`GDQP2K…4W37`); raw
 * salary amounts never appear in findings, messages, or the summary.
 */

import {
  findPaymentInstructionDuplicates,
  getInstructionRecipientId,
  maskPaymentAddress,
  type PaymentInstruction,
} from "@/lib/duplicateDetection";

/** Statuses a historical payout can hold. */
export type PayoutHistoryStatus =
  | "draft"
  | "pending"
  | "verified"
  | "failed"
  | "cancelled";

/** Minimal history record describing a payout that was already sent or queued. */
export interface PayoutHistoryEntry {
  runId: string;
  status: PayoutHistoryStatus;
  /** Payroll period the payout belongs to (e.g. `2026-10`); optional. */
  periodKey?: string | null;
  /** Batch/reference already recorded for the payout, when known. */
  batchReference?: string | null;
  /** Instruction ids already executed or reserved by the payout. */
  instructionIds?: string[];
  /** Recipients the payout covered. */
  employeeIds?: string[];
  /** ISO timestamp the payout was executed; present once confirmed. */
  executedAt?: string | null;
}

/** The payout batch that is about to be sent. */
export interface CandidatePayout {
  runId?: string | null;
  periodKey?: string | null;
  batchReference?: string | null;
  instructions: PaymentInstruction[];
}

export interface DuplicatePayoutPolicy {
  /** Treat queued/pending payouts as already sent (they reserve the funds). */
  treatQueuedAsSent: boolean;
  /** Failed and cancelled payouts do not block a fresh attempt. */
  allowRetryAfterFailure: boolean;
  /** Recipient overlap with an active payout blocks instead of warning. */
  blockOnRecipientOverlap: boolean;
}

export const DEFAULT_DUPLICATE_PAYOUT_POLICY: DuplicatePayoutPolicy = {
  treatQueuedAsSent: true,
  allowRetryAfterFailure: true,
  blockOnRecipientOverlap: true,
};

export type PayoutDuplicateKind =
  | "instruction_id_collision"
  | "reference_collision"
  | "recipient_overlap"
  | "identical_batch"
  | "batch_duplicate";

export type PayoutDuplicateSeverity = "blocker" | "warning";

export interface DuplicatePayoutFinding {
  kind: PayoutDuplicateKind;
  severity: PayoutDuplicateSeverity;
  /** Privacy-safe identifying value (masked address or reference label). */
  value: string;
  /** Operator-facing explanation; never contains raw amounts. */
  message: string;
  actionableRemediation: string;
  /** Historical payouts related to this finding. */
  relatedRunIds: string[];
}

export interface DuplicatePayoutReport {
  /** True when any duplicate signal was found. */
  isDuplicate: boolean;
  /** False when at least one blocker prevents sending. */
  canSend: boolean;
  findings: DuplicatePayoutFinding[];
  blockers: DuplicatePayoutFinding[];
  warnings: DuplicatePayoutFinding[];
  summary: string;
}

function isActiveForReplay(
  entry: PayoutHistoryEntry,
  policy: DuplicatePayoutPolicy,
): boolean {
  if (entry.status === "verified" || entry.status === "draft") return true;
  if (entry.status === "pending") return policy.treatQueuedAsSent;
  // failed / cancelled
  return !policy.allowRetryAfterFailure;
}

function samePeriod(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function recipientSetOf(entry: PayoutHistoryEntry): Set<string> {
  return new Set(
    (entry.employeeIds ?? []).map((id) => id.trim().toLowerCase()).filter(Boolean),
  );
}

/**
 * Detects whether sending `candidate` would duplicate a payout that was
 * already sent, queued, or reserved, based on the supplied payout history.
 *
 * Pure: never reads the clock, never mutates its arguments.
 */
export function detectDuplicatePayout(
  candidate: CandidatePayout,
  history: PayoutHistoryEntry[],
  policy: DuplicatePayoutPolicy = DEFAULT_DUPLICATE_PAYOUT_POLICY,
): DuplicatePayoutReport {
  const findings: DuplicatePayoutFinding[] = [];

  const instructions = Array.isArray(candidate?.instructions)
    ? candidate.instructions.filter((inst) => inst && typeof inst === "object")
    : [];

  const activeEntries = (Array.isArray(history) ? history : []).filter((entry) =>
    entry && typeof entry === "object" && isActiveForReplay(entry, policy),
  );

  const candidateInstructionIds = instructions
    .map((inst) => (inst.id ?? "").trim())
    .filter(Boolean);
  const candidateReferences = new Set(
    instructions
      .map((inst) => (inst.reference ?? "").trim())
      .filter(Boolean)
      .map((ref) => ref.toLowerCase()),
  );
  const candidateRecipients = new Set(
    instructions
      .map((inst) => getInstructionRecipientId(inst).trim().toLowerCase())
      .filter(Boolean),
  );

  // 1. Instruction id collision against already-executed/reserved payouts.
  if (candidateInstructionIds.length > 0) {
    const seen = new Map<string, string[]>();
    for (const entry of activeEntries) {
      for (const rawId of entry.instructionIds ?? []) {
        const id = rawId.trim();
        if (!id) continue;
        const key = id.toLowerCase();
        if (candidateInstructionIds.some((cid) => cid.toLowerCase() === key)) {
          const existing = seen.get(key) ?? [];
          existing.push(entry.runId);
          seen.set(key, existing);
        }
      }
    }

    for (const [, runIds] of Array.from(seen.entries())) {
      findings.push({
        kind: "instruction_id_collision",
        severity: "blocker",
        value: "instruction",
        message: `This payout reuses a payment instruction identifier that payout ${runIds.join(", ")} already executed or reserved.`,
        actionableRemediation:
          "Assign fresh instruction identifiers before sending, or void the prior payout first to avoid executing a duplicate transfer.",
        relatedRunIds: runIds,
      });
    }
  }

  // 2. Batch reference collision.
  if (candidate.batchReference && candidateReferences.size > 0) {
    const ref = candidate.batchReference.trim();
    const refLower = ref.toLowerCase();
    const matchingRuns = activeEntries
      .filter((entry) => (entry.batchReference ?? "").trim().toLowerCase() === refLower)
      .map((entry) => entry.runId);

    if (matchingRuns.length > 0) {
      findings.push({
        kind: "reference_collision",
        severity: "blocker",
        value: maskPaymentAddress(ref),
        message: `Batch reference '${ref}' is already recorded on payout ${matchingRuns.join(", ")}.`,
        actionableRemediation:
          "Generate a unique batch reference before sending so ledger reconciliation stays one-to-one.",
        relatedRunIds: matchingRuns,
      });
    }
  }

  // 3./4. Recipient overlap with active payouts in the same period.
  if (candidateRecipients.size > 0) {
    for (const entry of activeEntries) {
      if (!samePeriod(candidate.periodKey, entry.periodKey)) continue;

      const overlap = Array.from(recipientSetOf(entry)).filter((id) =>
        candidateRecipients.has(id),
      );
      if (overlap.length === 0) continue;

      const entrySet = recipientSetOf(entry);
      const identical =
        entrySet.size === candidateRecipients.size &&
        overlap.length === candidateRecipients.size;

      if (identical) {
        findings.push({
          kind: "identical_batch",
          severity: "blocker",
          value: entry.periodKey ?? "",
          message: `Payout ${entry.runId} already covers the same ${overlap.length} recipient(s) for period ${entry.periodKey}.`,
          actionableRemediation:
            "Cancel or settle the earlier payout before sending this batch, or exclude the already-paid recipients.",
          relatedRunIds: [entry.runId],
        });
        continue;
      }

      findings.push({
        kind: "recipient_overlap",
        severity: policy.blockOnRecipientOverlap ? "blocker" : "warning",
        value: `${overlap.length} recipient(s)`,
        message: `${overlap.length} recipient(s) in this payout were already paid or queued by payout ${entry.runId} for period ${entry.periodKey}.`,
        actionableRemediation:
          "Remove the overlapping recipients from this batch or cancel the earlier payout to prevent a double payout.",
        relatedRunIds: [entry.runId],
      });
    }
  }

  // 5. Intra-batch duplicates (engine from #633), including collisions
  // derived from the payout history identifiers above.
  const intraBatchGroups = findPaymentInstructionDuplicates(instructions, {
    existingInstructionIds: candidateInstructionIds.filter((id) =>
      activeEntries.some((entry) =>
        (entry.instructionIds ?? []).some(
          (raw) => raw.trim().toLowerCase() === id.toLowerCase(),
        ),
      ),
    ),
    existingReferences: Array.from(candidateReferences).filter((ref) =>
      activeEntries.some(
        (entry) => (entry.batchReference ?? "").trim().toLowerCase() === ref,
      ),
    ),
  });

  for (const group of intraBatchGroups) {
    findings.push({
      kind: "batch_duplicate",
      severity: group.isBlocking ? "blocker" : "warning",
      value: group.value,
      message: group.message,
      actionableRemediation: group.actionableRemediation,
      relatedRunIds: [],
    });
  }

  const blockers = findings.filter((f) => f.severity === "blocker");
  const warnings = findings.filter((f) => f.severity === "warning");
  const canSend = blockers.length === 0;

  let summary: string;
  if (findings.length === 0) {
    summary = "No duplicate payouts detected. This batch is safe to send.";
  } else if (blockers.length > 0) {
    summary = `${blockers.length} duplicate payout blocker${
      blockers.length === 1 ? "" : "s"
    }${warnings.length > 0 ? ` and ${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : ""} must be resolved before sending.`;
  } else {
    summary = `${warnings.length} duplicate payout warning${
      warnings.length === 1 ? "" : "s"
    } detected. Review the details before sending.`;
  }

  return {
    isDuplicate: findings.length > 0,
    canSend,
    findings,
    blockers,
    warnings,
    summary,
  };
}

/** Convenience predicate: would sending this candidate duplicate a payout? */
export function isDuplicatePayout(
  candidate: CandidatePayout,
  history: PayoutHistoryEntry[],
  policy: DuplicatePayoutPolicy = DEFAULT_DUPLICATE_PAYOUT_POLICY,
): boolean {
  return detectDuplicatePayout(candidate, history, policy).isDuplicate;
}

export class DuplicatePayoutError extends Error {
  report: DuplicatePayoutReport;

  constructor(report: DuplicatePayoutReport) {
    super(report.summary);
    this.name = "DuplicatePayoutError";
    this.report = report;
  }
}

/**
 * Throws a typed error when the payout batch duplicates an existing payout.
 */
export function assertNoDuplicatePayout(
  candidate: CandidatePayout,
  history: PayoutHistoryEntry[],
  policy: DuplicatePayoutPolicy = DEFAULT_DUPLICATE_PAYOUT_POLICY,
): DuplicatePayoutReport {
  const report = detectDuplicatePayout(candidate, history, policy);
  if (!report.canSend) {
    throw new DuplicatePayoutError(report);
  }
  return report;
}
