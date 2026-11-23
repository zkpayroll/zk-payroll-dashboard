import type { ProofReference } from "@/types/models";

/**
 * Proof freshness states:
 * - `missing`  – no proof reference is attached to the run.
 * - `fresh`    – proof valid with comfortable time before expiry.
 * - `expiring` – proof still valid but close to expiry; replace soon.
 * - `expired`  – proof past its expiry (or explicitly marked expired);
 *                execution must be blocked.
 */
export type ProofFreshnessState = "missing" | "fresh" | "expiring" | "expired";

/** Proofs within this window of expiring are flagged as expiring. */
export const PROOF_EXPIRING_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ProofFreshnessInput {
  /** Proof metadata attached to the payroll run, if any. */
  reference?: Pick<ProofReference, "expiresAt" | "proofStatus"> | null;
}

export interface ProofFreshnessEvaluation {
  state: ProofFreshnessState;
  /** Short badge label. */
  label: string;
  /** Operator-facing message explaining what to do next. */
  message: string;
  /** Milliseconds remaining before expiry, or null when not applicable. */
  remainingMs: number | null;
  /** Expired proofs always block execution actions. */
  blocksExecution: boolean;
}

/** Evaluate proof freshness from metadata against a point in time. */
export function evaluateProofFreshness(
  input: ProofFreshnessInput,
  now: number = Date.now(),
): ProofFreshnessEvaluation {
  const { reference } = input;

  if (!reference || (!reference.expiresAt && reference.proofStatus !== "expired")) {
    return {
      state: "missing",
      label: "No proof",
      message: "No proof is attached yet. Generate a payroll proof before executing.",
      remainingMs: null,
      blocksExecution: false,
    };
  }

  if (reference.proofStatus === "expired") {
    return {
      state: "expired",
      label: "Proof expired",
      message: "This proof was marked expired on-chain and can no longer be used. Replace the proof before executing.",
      remainingMs: null,
      blocksExecution: true,
    };
  }

  const expiresAtMs = reference.expiresAt ? Date.parse(reference.expiresAt) : NaN;
  if (Number.isNaN(expiresAtMs)) {
    return {
      state: "missing",
      label: "Unknown expiry",
      message: "Proof metadata has no usable expiry date. Regenerate the proof to be safe.",
      remainingMs: null,
      blocksExecution: false,
    };
  }

  if (expiresAtMs <= now) {
    return {
      state: "expired",
      label: "Proof expired",
      message: "The proof has expired. Execution will fail until a fresh proof replaces it.",
      remainingMs: 0,
      blocksExecution: true,
    };
  }

  const remainingMs = expiresAtMs - now;
  if (remainingMs <= PROOF_EXPIRING_WINDOW_MS) {
    return {
      state: "expiring",
      label: "Expiring soon",
      message: "The proof expires soon. If execution may be delayed, replace it first.",
      remainingMs,
      blocksExecution: false,
    };
  }

  return {
    state: "fresh",
    label: "Proof fresh",
    message: "The proof is valid and comfortably ahead of its expiry window.",
    remainingMs,
    blocksExecution: false,
  };
}

/** Format remaining time as a compact countdown, e.g. `23h 59m` or `45s`. */
export function formatProofCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
