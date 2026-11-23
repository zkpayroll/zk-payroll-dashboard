/**
 * Payroll exception resolution audit trail (#696).
 *
 * Records every operator action taken to resolve a payroll exception so
 * compliance teams can reconstruct the full resolution history. Each entry
 * is immutable once written and is assigned a monotonically increasing
 * sequence number within its exception's trail.
 *
 * Privacy guarantees: entries track operational decisions only — who acted,
 * when, and what outcome was recorded. No salary amount, wallet address, or
 * raw employee personal data is stored in the trail.
 */

export type ExceptionResolutionAction =
  | "acknowledged"
  | "investigation_started"
  | "remediation_applied"
  | "escalated"
  | "approved"
  | "rejected"
  | "closed"
  | "reopened";

export interface ExceptionResolutionEntry {
  /** Monotonically increasing index within this exception's trail (1-based). */
  sequence: number;
  exceptionId: string;
  action: ExceptionResolutionAction;
  /** Operator identifier; never a raw email or legal name in exported trails. */
  operatorId: string;
  /** ISO timestamp when this entry was recorded. */
  recordedAt: string;
  /** Optional operator-supplied note (sanitised; must not contain PII). */
  note?: string;
  /** Outcome classification attached to the action, if applicable. */
  outcome?: "resolved" | "unresolved" | "escalated" | "pending";
}

export interface ExceptionResolutionTrail {
  exceptionId: string;
  entries: ExceptionResolutionEntry[];
  /** True once a `closed` entry exists and no subsequent `reopened` entry follows. */
  isClosed: boolean;
  /** True when the trail has at least one entry. */
  hasActivity: boolean;
  latestEntry: ExceptionResolutionEntry | null;
  entryCount: number;
}

export interface AppendEntryInput {
  exceptionId: string;
  action: ExceptionResolutionAction;
  operatorId: string;
  note?: string;
  outcome?: ExceptionResolutionEntry["outcome"];
  /** Override the recorded timestamp (defaults to now). */
  recordedAt?: string;
}

export type AuditTrailStore = Map<string, ExceptionResolutionEntry[]>;

export function createAuditTrailStore(): AuditTrailStore {
  return new Map();
}

export function appendResolutionEntry(
  store: AuditTrailStore,
  input: AppendEntryInput,
): ExceptionResolutionEntry {
  const existing = store.get(input.exceptionId) ?? [];

  const entry: ExceptionResolutionEntry = {
    sequence: existing.length + 1,
    exceptionId: input.exceptionId,
    action: input.action,
    operatorId: input.operatorId,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    note: input.note,
    outcome: input.outcome,
  };

  store.set(input.exceptionId, [...existing, entry]);
  return entry;
}

export function getResolutionTrail(
  store: AuditTrailStore,
  exceptionId: string,
): ExceptionResolutionTrail {
  const entries = store.get(exceptionId) ?? [];
  const latestEntry = entries[entries.length - 1] ?? null;

  const lastClosedIndex = entries.reduce(
    (idx, entry, i) => (entry.action === "closed" ? i : idx),
    -1,
  );
  const lastReopenedIndex = entries.reduce(
    (idx, entry, i) => (entry.action === "reopened" ? i : idx),
    -1,
  );
  const isClosed = lastClosedIndex > -1 && lastClosedIndex > lastReopenedIndex;

  return {
    exceptionId,
    entries,
    isClosed,
    hasActivity: entries.length > 0,
    latestEntry,
    entryCount: entries.length,
  };
}

export function formatTrailSummary(trail: ExceptionResolutionTrail): string {
  if (!trail.hasActivity) {
    return `Exception ${trail.exceptionId}: no resolution activity recorded.`;
  }
  const status = trail.isClosed ? "closed" : "open";
  const latest = trail.latestEntry!;
  return (
    `Exception ${trail.exceptionId} (${status}): ` +
    `${trail.entryCount} entr${trail.entryCount === 1 ? "y" : "ies"}, ` +
    `latest action "${latest.action}" by ${latest.operatorId} at ${latest.recordedAt}.`
  );
}

export function filterTrailByAction(
  trail: ExceptionResolutionTrail,
  actions: ExceptionResolutionAction[],
): ExceptionResolutionEntry[] {
  return trail.entries.filter((e) => actions.includes(e.action));
}

export class ExceptionAlreadyClosedError extends Error {
  exceptionId: string;

  constructor(exceptionId: string) {
    super(
      `Exception ${exceptionId} is already closed. Reopen it before recording further resolution actions.`,
    );
    this.name = "ExceptionAlreadyClosedError";
    this.exceptionId = exceptionId;
  }
}

export function appendOrReject(
  store: AuditTrailStore,
  input: AppendEntryInput,
): ExceptionResolutionEntry {
  const trail = getResolutionTrail(store, input.exceptionId);
  if (trail.isClosed && input.action !== "reopened") {
    throw new ExceptionAlreadyClosedError(input.exceptionId);
  }
  return appendResolutionEntry(store, input);
}
