import { create } from "zustand";
import { sanitize } from "@/lib/sanitize";

export type ProofLifecycleState =
  | "queued"
  | "generating"
  | "ready"
  | "submitted"
  | "verified"
  | "failed"
  | "expired";

export interface SafeProofStatusExplanation {
  title: string;
  description: string;
  nextStepGuidance?: string;
}

export interface ProofStatusState {
  status: ProofLifecycleState;
  payrollId: string | null;
  proofId: string | null;
  progress: number;
  failureReason: string | null;
  nextStepGuidance: string | null;
  submittedTxHash: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  executionReady: boolean;
}

interface ProofStatusActions {
  queueProof: (payrollId: string) => void;
  startGenerating: () => void;
  setProgress: (progress: number) => void;
  setReady: (proofId: string, expiresAt?: string) => void;
  markSubmitted: (txHash?: string) => void;
  markVerified: (verifiedAt?: string) => void;
  setFailed: (rawError: string, customGuidance?: string) => void;
  markExpired: () => void;
  reset: () => void;
}

export type ProofStatusStore = ProofStatusState & ProofStatusActions;

const initialState: ProofStatusState = {
  status: "queued",
  payrollId: null,
  proofId: null,
  progress: 0,
  failureReason: null,
  nextStepGuidance: null,
  submittedTxHash: null,
  verifiedAt: null,
  expiresAt: null,
  executionReady: false,
};

export const SAFE_STATUS_EXPLANATIONS: Record<
  ProofLifecycleState,
  (state: ProofStatusState) => SafeProofStatusExplanation
> = {
  queued: () => ({
    title: "Proof Queued",
    description: "Payroll batch is queued for zero-knowledge commitment calculation.",
    nextStepGuidance: "Please wait while the proof generator initializes.",
  }),
  generating: (s) => ({
    title: "Generating Zero-Knowledge Proof",
    description: `Computing zero-knowledge circuit constraints (${Math.round(s.progress)}%). Raw salary inputs remain strictly confidential.`,
    nextStepGuidance: "Do not close the page until proof generation finishes.",
  }),
  ready: (s) => ({
    title: "Proof Ready for Execution",
    description: `ZK-SNARK proof synthesized successfully. Validated locally with reference ID ${s.proofId || "zk-proof"}.`,
    nextStepGuidance: "Review batch details and proceed to submit the transaction.",
  }),
  submitted: (s) => ({
    title: "Proof Submitted On-Chain",
    description: `Proof payload submitted to Soroban verifier contract.${s.submittedTxHash ? ` Tx: ${s.submittedTxHash.slice(0, 10)}...` : ""}`,
    nextStepGuidance: "Awaiting ledger confirmation from Soroban consensus.",
  }),
  verified: (s) => ({
    title: "Proof On-Chain Verified",
    description: `Soroban verifier contract successfully verified validity proof.${s.verifiedAt ? ` Confirmed at ${s.verifiedAt}.` : ""}`,
    nextStepGuidance: "Payroll execution complete. Audit trail recorded.",
  }),
  failed: (s) => ({
    title: "Proof Generation Failed",
    description: s.failureReason || "An unhandled error occurred during circuit evaluation.",
    nextStepGuidance: s.nextStepGuidance || "Verify input constraints and re-attempt proof generation.",
  }),
  expired: () => ({
    title: "Proof Expired",
    description: "The proof validity period has expired prior to submission. On-chain verifier rejects stale proofs.",
    nextStepGuidance: "Re-generate zero-knowledge proof before executing payroll.",
  }),
};

/**
 * Redacts and sanitizes raw error strings into operator-safe failure messages
 * that never expose private keys, raw salary figures, SSNs, or internal circuit WASM dumps.
 */
export function formatSafeFailureReason(rawError: string): string {
  if (!rawError) return "Proof evaluation failed cleanly without exposing confidential data.";

  // Sanitize sensitive patterns first
  const sanitized = sanitize(rawError);

  // Additional cleanup for WASM/stack trace internals
  let clean = typeof sanitized === "string" ? sanitized : String(sanitized);
  clean = clean
    .replace(/at\s+async\s+.*$/gm, "")
    .replace(/at\s+.*:\d+:\d+/g, "")
    .replace(/0x[a-fA-F0-9]{32,}/g, "[REDACTED_HASH]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]")
    .replace(/RuntimeError: unreachable/i, "Circuit constraint unsatisfied during witness generation.")
    .trim();

  // If error contains explicit internal trace or raw numbers, wrap with safe message
  if (clean.length === 0 || clean.includes("[REDACTED]")) {
    return "Proof compilation halted due to invalid inputs or parameter constraint check. (Details redacted for privacy)";
  }

  return clean;
}

export const useProofStatusStore = create<ProofStatusStore>()((set) => ({
  ...initialState,

  queueProof: (payrollId: string) =>
    set({
      ...initialState,
      status: "queued",
      payrollId,
      progress: 0,
      executionReady: false,
    }),

  startGenerating: () =>
    set({
      status: "generating",
      progress: 10,
      failureReason: null,
      nextStepGuidance: null,
      executionReady: false,
    }),

  setProgress: (progress: number) =>
    set((state) => ({
      progress: Math.min(100, Math.max(state.progress, progress)),
    })),

  setReady: (proofId: string, expiresAt?: string) =>
    set({
      status: "ready",
      proofId,
      progress: 100,
      failureReason: null,
      nextStepGuidance: null,
      expiresAt: expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      executionReady: true,
    }),

  markSubmitted: (submittedTxHash?: string) =>
    set({
      status: "submitted",
      submittedTxHash: submittedTxHash || null,
      executionReady: false,
    }),

  markVerified: (verifiedAt?: string) =>
    set({
      status: "verified",
      verifiedAt: verifiedAt || new Date().toISOString(),
      executionReady: false,
    }),

  setFailed: (rawError: string, customGuidance?: string) => {
    const safeReason = formatSafeFailureReason(rawError);
    const safeGuidance =
      customGuidance ||
      "Check employee commitments, ensure treasury is funded, and try regenerating the proof.";
    set({
      status: "failed",
      failureReason: safeReason,
      nextStepGuidance: safeGuidance,
      executionReady: false,
    });
  },

  markExpired: () =>
    set({
      status: "expired",
      failureReason: "Proof TTL window elapsed.",
      nextStepGuidance: "Click 'Regenerate Proof' to compute a fresh ZK commitment.",
      executionReady: false,
    }),

  reset: () => set({ ...initialState }),
}));
