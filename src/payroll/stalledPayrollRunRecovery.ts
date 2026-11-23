/**
 * Stalled payroll run recovery guidance module (#669).
 *
 * Classifies a stalled run's root cause and surfaces operator-actionable
 * recovery steps. No private payroll data (amounts, addresses, proofs)
 * is read or emitted — only structural run metadata is evaluated.
 */

export type StalledRunCause =
  | "proof_timeout"
  | "network_congestion"
  | "treasury_shortfall"
  | "approval_gap"
  | "unknown";

export type RecoveryAction =
  | "retry_proof_generation"
  | "wait_and_retry"
  | "top_up_treasury"
  | "request_missing_approvals"
  | "contact_support";

export interface StalledRunContext {
  readonly runId: string;
  readonly stalledForMs: number;
  readonly lastKnownStage: string;
  readonly proofTimedOut?: boolean;
  readonly networkCongested?: boolean;
  readonly treasuryShortfall?: boolean;
  readonly pendingApprovals?: number;
}

export interface StalledRunRecoveryGuidance {
  readonly runId: string;
  readonly cause: StalledRunCause;
  readonly primaryAction: RecoveryAction;
  readonly message: string;
  readonly canAutoRetry: boolean;
}

function classifyCause(ctx: StalledRunContext): StalledRunCause {
  if (ctx.proofTimedOut) return "proof_timeout";
  if (ctx.networkCongested) return "network_congestion";
  if (ctx.treasuryShortfall) return "treasury_shortfall";
  if (ctx.pendingApprovals && ctx.pendingApprovals > 0) return "approval_gap";
  return "unknown";
}

const GUIDANCE: Record<StalledRunCause, { action: RecoveryAction; message: string; canAutoRetry: boolean }> = {
  proof_timeout: {
    action: "retry_proof_generation",
    message: "ZK proof generation timed out. Retry proof generation to resume the run.",
    canAutoRetry: true,
  },
  network_congestion: {
    action: "wait_and_retry",
    message: "Network congestion detected. Wait for congestion to clear before retrying submission.",
    canAutoRetry: true,
  },
  treasury_shortfall: {
    action: "top_up_treasury",
    message: "Treasury balance is insufficient to cover the payroll run. Top up before retrying.",
    canAutoRetry: false,
  },
  approval_gap: {
    action: "request_missing_approvals",
    message: "One or more required approvals are outstanding. Request approvals to unblock the run.",
    canAutoRetry: false,
  },
  unknown: {
    action: "contact_support",
    message: "Run stalled for an unknown reason. Review the run log or contact support.",
    canAutoRetry: false,
  },
};

/** Returns actionable recovery guidance for a stalled payroll run. */
export function getStalledRunRecoveryGuidance(
  ctx: StalledRunContext,
): StalledRunRecoveryGuidance {
  const cause = classifyCause(ctx);
  const { action, message, canAutoRetry } = GUIDANCE[cause];
  return { runId: ctx.runId, cause, primaryAction: action, message, canAutoRetry };
}
