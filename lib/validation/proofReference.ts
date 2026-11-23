/**
 * Proof reference IDs follow the format emitted by the ZK proof pipeline,
 * e.g. `zkp_ref_20250228_001`: a `zkp_ref_` prefix, an 8-digit date segment,
 * and a numeric sequence suffix.
 */
const PROOF_REFERENCE_PATTERN = /^zkp_ref_\d{8}_\d{3,}$/;

export const PROOF_REFERENCE_FORMAT_HINT =
  "Expected format: zkp_ref_YYYYMMDD_NNN (e.g. zkp_ref_20250228_001)";
export const PROOF_REFERENCE_RECOVERY_HINT =
  "Re-copy the full reference from the proof receipt and paste it again, or clear the field to start over.";

/**
 * Guidance shown next to the proof reference field before and after entry.
 * It describes the reference shape and the recovery step only; it never
 * includes user-entered values, amounts, or employee details.
 */
export const PROOF_REFERENCE_GUIDANCE =
  `${PROOF_REFERENCE_FORMAT_HINT}. A valid reference has a zkp_ref_ prefix, an 8-digit date, ` +
  "and at least 3 digits after the second underscore. " +
  "Enter only the proof reference, not payroll amounts or employee details. " +
  PROOF_REFERENCE_RECOVERY_HINT;

export type ProofReferenceFailureReason = "empty" | "malformed";

export interface ProofReferenceValidationResult {
  isValid: boolean;
  normalized: string;
  message: string | null;
  reason: ProofReferenceFailureReason | null;
}

/**
 * Normalize a pasted or typed proof reference value: trims surrounding
 * whitespace, strips embedded whitespace/newlines from clipboard paste
 * artifacts, and lowercases it (proof reference IDs are lowercase).
 */
export function normalizeProofReference(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toLowerCase();
}

export function validateProofReference(raw: string): ProofReferenceValidationResult {
  const normalized = normalizeProofReference(raw);

  if (normalized.length === 0) {
    return {
      isValid: false,
      normalized,
      message: "Proof reference is required. Paste the reference from your proof receipt.",
      reason: "empty",
    };
  }

  if (!PROOF_REFERENCE_PATTERN.test(normalized)) {
    return {
      isValid: false,
      normalized,
      message: `Invalid proof reference. ${PROOF_REFERENCE_FORMAT_HINT} ${PROOF_REFERENCE_RECOVERY_HINT}`,
      reason: "malformed",
    };
  }

  return { isValid: true, normalized, message: null, reason: null };
}
