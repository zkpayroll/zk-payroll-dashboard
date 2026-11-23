/**
 * Payroll readiness scoring signals (#693).
 *
 * Aggregates operational signals into a single readiness score so the
 * dashboard can surface the payroll run's health at a glance and guide
 * operators to the most critical blockers before submission.
 *
 * Privacy guarantees: no salary amount, employee identity, wallet address,
 * or proof material is read or emitted. Scores reflect structural readiness
 * only.
 */

export type ReadinessSignalId =
  | "treasury_funded"
  | "employee_roster_clean"
  | "approvals_met"
  | "reconciliation_clear"
  | "duplicate_check_passed"
  | "network_ready"
  | "proof_valid";

export type ReadinessSignalStatus = "pass" | "fail" | "warn" | "pending";

export interface ReadinessSignal {
  id: ReadinessSignalId;
  label: string;
  status: ReadinessSignalStatus;
  /** Operator-facing hint when status is fail or warn. */
  hint?: string;
  /** Weight contribution to the total score (0–100 scale, weights sum to 100). */
  weight: number;
}

export interface ReadinessScoreInput {
  treasuryFunded?: boolean | null;
  employeeRosterClean?: boolean | null;
  approvalsMet?: boolean | null;
  reconciliationClear?: boolean | null;
  duplicateCheckPassed?: boolean | null;
  networkReady?: boolean | null;
  proofValid?: boolean | null;
}

export interface PayrollReadinessScore {
  /** 0–100 weighted score; 100 means all signals pass. */
  score: number;
  /** True when score === 100 and no signal is in fail or warn state. */
  ready: boolean;
  signals: ReadinessSignal[];
  blockers: ReadinessSignal[];
  warnings: ReadinessSignal[];
  pending: ReadinessSignal[];
  /** Human-readable summary of the current readiness state. */
  summary: string;
  evaluatedAt: string;
}

const SIGNAL_DEFINITIONS: Array<{
  id: ReadinessSignalId;
  label: string;
  weight: number;
  failHint: string;
  warnHint: string;
}> = [
  {
    id: "treasury_funded",
    label: "Treasury balance covers run total",
    weight: 25,
    failHint: "Replenish the treasury before submitting this run.",
    warnHint: "Treasury balance is close to the run total; verify reservations.",
  },
  {
    id: "employee_roster_clean",
    label: "Employee roster validated",
    weight: 20,
    failHint: "Resolve ineligible or missing employee records before proceeding.",
    warnHint: "Some employee records have warnings; review before submitting.",
  },
  {
    id: "approvals_met",
    label: "Required approvals obtained",
    weight: 20,
    failHint: "Obtain all required approvals before submitting this run.",
    warnHint: "Approval count is at the minimum threshold; request additional sign-offs.",
  },
  {
    id: "reconciliation_clear",
    label: "Reconciliation checkpoint passed",
    weight: 15,
    failHint: "Complete the reconciliation checkpoint before closing this period.",
    warnHint: "Reconciliation has minor discrepancies; verify before proceeding.",
  },
  {
    id: "duplicate_check_passed",
    label: "No duplicate payment instructions",
    weight: 10,
    failHint: "Remove or deduplicate conflicting payment instructions.",
    warnHint: "Potential duplicate instructions detected; confirm before submitting.",
  },
  {
    id: "network_ready",
    label: "Network connectivity confirmed",
    weight: 5,
    failHint: "Resolve network connectivity issues before submitting.",
    warnHint: "Network latency is elevated; submission may be slower than usual.",
  },
  {
    id: "proof_valid",
    label: "Zero-knowledge proof valid",
    weight: 5,
    failHint: "Regenerate the proof — the current proof is expired or invalid.",
    warnHint: "Proof is approaching its expiry window; regenerate if submission is delayed.",
  },
];

function statusFromBoolean(value: boolean | null | undefined): ReadinessSignalStatus {
  if (value === null || value === undefined) return "pending";
  return value ? "pass" : "fail";
}

function buildSignal(
  def: (typeof SIGNAL_DEFINITIONS)[number],
  status: ReadinessSignalStatus,
): ReadinessSignal {
  let hint: string | undefined;
  if (status === "fail") hint = def.failHint;
  else if (status === "warn") hint = def.warnHint;
  return { id: def.id, label: def.label, status, weight: def.weight, hint };
}

export function scorePayrollReadiness(
  input: ReadinessScoreInput,
): PayrollReadinessScore {
  const inputMap: Record<ReadinessSignalId, boolean | null | undefined> = {
    treasury_funded: input.treasuryFunded,
    employee_roster_clean: input.employeeRosterClean,
    approvals_met: input.approvalsMet,
    reconciliation_clear: input.reconciliationClear,
    duplicate_check_passed: input.duplicateCheckPassed,
    network_ready: input.networkReady,
    proof_valid: input.proofValid,
  };

  const signals: ReadinessSignal[] = SIGNAL_DEFINITIONS.map((def) =>
    buildSignal(def, statusFromBoolean(inputMap[def.id])),
  );

  const blockers = signals.filter((s) => s.status === "fail");
  const warnings = signals.filter((s) => s.status === "warn");
  const pending = signals.filter((s) => s.status === "pending");

  const score = signals.reduce(
    (acc, s) => acc + (s.status === "pass" ? s.weight : 0),
    0,
  );

  const ready = score === 100 && blockers.length === 0 && warnings.length === 0;

  let summary: string;
  if (ready) {
    summary = "All readiness signals pass — this run is ready to submit.";
  } else if (blockers.length > 0) {
    summary = `${blockers.length} blocker${blockers.length === 1 ? "" : "s"} must be resolved before submission. Score: ${score}/100.`;
  } else if (pending.length > 0) {
    summary = `${pending.length} signal${pending.length === 1 ? "" : "s"} still pending evaluation. Score: ${score}/100.`;
  } else {
    summary = `${warnings.length} warning${warnings.length === 1 ? "" : "s"} noted — review before submitting. Score: ${score}/100.`;
  }

  return {
    score,
    ready,
    signals,
    blockers,
    warnings,
    pending,
    summary,
    evaluatedAt: new Date().toISOString(),
  };
}

export function getReadinessSignalLabel(id: ReadinessSignalId): string {
  return SIGNAL_DEFINITIONS.find((d) => d.id === id)?.label ?? id;
}
