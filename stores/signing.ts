import { create } from "zustand";
import type {
  QuorumMode,
  SignatureStatus,
  SignerRole,
} from "@/types/roles";
import { roleLabel, statusLabel } from "@/types/roles";

/** A single signer participating in a payroll approval quorum. */
export interface Signer {
  id: string;
  /** Display name of the signer (person or wallet label). */
  name: string;
  role: SignerRole;
  status: SignatureStatus;
  /** ISO timestamp of when the signature was collected, if signed. */
  signedAt?: string;
  /** ISO timestamp after which a pending approval is considered expired. */
  expiresAt?: string;
}

/** Aggregate view of quorum progress derived from the current signers. */
export interface QuorumProgress {
  /** Number of approvals required to satisfy the quorum. */
  required: number;
  /** Number of valid `signed` approvals collected so far. */
  collected: number;
  /** Whether the required number of signatures has been reached. */
  thresholdMet: boolean;
  /** Signers whose approval was rejected. */
  rejected: Signer[];
  /** Signers whose approval window has expired. */
  expired: Signer[];
  /** Signers that acted without authorization for their role. */
  unauthorized: Signer[];
  /** Required roles that do not yet have a valid signature. */
  missingRoles: SignerRole[];
  /**
   * Whether submission is blocked. Blocked when the quorum is unmet, or when
   * any approval is rejected, expired, or unauthorized.
   */
  blocked: boolean;
}

interface SigningState {
  mode: QuorumMode;
  /** Signatures needed in `threshold` mode. Ignored in `unanimous` mode. */
  threshold: number;
  /** Roles whose approval the payroll run requires. */
  requiredRoles: SignerRole[];
  signers: Signer[];
  setMode: (mode: QuorumMode) => void;
  setThreshold: (threshold: number) => void;
  setRequiredRoles: (roles: SignerRole[]) => void;
  setSigners: (signers: Signer[]) => void;
  updateSignerStatus: (id: string, status: SignatureStatus) => void;
  reset: () => void;
  getProgress: () => QuorumProgress;
  getRequestSummary: () => string;
}

const initialState = {
  mode: "threshold" as QuorumMode,
  threshold: 2,
  requiredRoles: [] as SignerRole[],
  signers: [] as Signer[],
};

/**
 * Computes quorum progress from the current mode/threshold/signers. A role is
 * considered satisfied only by a signer with a `signed` status.
 */
function computeProgress(state: {
  mode: QuorumMode;
  threshold: number;
  requiredRoles: SignerRole[];
  signers: Signer[];
}): QuorumProgress {
  const { mode, threshold, requiredRoles, signers } = state;

  const signed = signers.filter((s) => s.status === "signed");
  const rejected = signers.filter((s) => s.status === "rejected");
  const expired = signers.filter((s) => s.status === "expired");
  const unauthorized = signers.filter((s) => s.status === "unauthorized");

  const signedRoles = new Set(signed.map((s) => s.role));
  const missingRoles = requiredRoles.filter((role) => !signedRoles.has(role));

  const required =
    mode === "unanimous" ? requiredRoles.length : Math.max(0, threshold);
  const collected = signed.length;
  const thresholdMet = required > 0 ? collected >= required : collected > 0;

  const blocked =
    !thresholdMet ||
    rejected.length > 0 ||
    expired.length > 0 ||
    unauthorized.length > 0 ||
    missingRoles.length > 0;

  return {
    required,
    collected,
    thresholdMet,
    rejected,
    expired,
    unauthorized,
    missingRoles,
    blocked,
  };
}

export const useSigningStore = create<SigningState>()((set, get) => ({
  ...initialState,
  setMode: (mode) => set({ mode }),
  setThreshold: (threshold) => set({ threshold: Math.max(0, threshold) }),
  setRequiredRoles: (requiredRoles) => set({ requiredRoles }),
  setSigners: (signers) => set({ signers }),
  updateSignerStatus: (id, status) =>
    set({
      signers: get().signers.map((s) =>
        s.id === id ? { ...s, status } : s,
      ),
    }),
  reset: () => set({ ...initialState }),
  getProgress: () => computeProgress(get()),
  getRequestSummary: () => {
    const { requiredRoles, signers, mode, threshold } = get();
    const progress = computeProgress(get());
    const lines: string[] = [];

    lines.push("Payroll approval request");
    lines.push(
      mode === "unanimous"
        ? `Quorum: unanimous (${requiredRoles.length} roles)`
        : `Quorum: ${progress.collected}/${progress.required} signatures (threshold ${threshold})`,
    );

    if (progress.missingRoles.length > 0) {
      const pending = progress.missingRoles.map(roleLabel).join(", ");
      lines.push(`Still needed from: ${pending}`);
    } else {
      lines.push("All required roles have signed.");
    }

    const flagged = signers.filter((s) =>
      ["rejected", "expired", "unauthorized"].includes(s.status),
    );
    if (flagged.length > 0) {
      lines.push("Blocking issues:");
      for (const s of flagged) {
        lines.push(`- ${s.name} (${roleLabel(s.role)}): ${statusLabel(s.status)}`);
      }
    }

    return lines.join("\n");
  },
}));

export { computeProgress };
