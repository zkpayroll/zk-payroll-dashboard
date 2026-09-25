/**
 * Signer role and signature-status vocabulary shared by the multi-signer
 * payroll approval surfaces (see `stores/signing.ts` and
 * `components/features/approvals/SignerQuorumTracker.tsx`).
 */

/** Roles that can participate in a payroll approval quorum. */
export type SignerRole =
  | "owner"
  | "finance"
  | "compliance"
  | "operations"
  | "auditor";

/** State of an individual signer's approval within a quorum. */
export type SignatureStatus =
  | "missing"
  | "signed"
  | "rejected"
  | "expired"
  | "unauthorized";

/** How a quorum is satisfied. */
export type QuorumMode = "threshold" | "unanimous";

/** Human-readable labels for each role. */
export const ROLE_LABELS: Record<SignerRole, string> = {
  owner: "Owner",
  finance: "Finance",
  compliance: "Compliance",
  operations: "Operations",
  auditor: "Auditor",
};

/** Human-readable labels for each signature status. */
export const STATUS_LABELS: Record<SignatureStatus, string> = {
  missing: "Awaiting",
  signed: "Signed",
  rejected: "Rejected",
  expired: "Expired",
  unauthorized: "Unauthorized",
};

/** Returns the display label for a role, falling back to the raw value. */
export function roleLabel(role: SignerRole): string {
  return ROLE_LABELS[role] ?? role;
}

/** Returns the display label for a signature status. */
export function statusLabel(status: SignatureStatus): string {
  return STATUS_LABELS[status] ?? status;
}
