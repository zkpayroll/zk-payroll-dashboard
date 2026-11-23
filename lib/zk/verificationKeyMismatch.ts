/**
 * Proof verification key mismatch details (#763).
 *
 * When a proof is checked against a different verification key than the one it
 * was generated for, operators need enough to act on (which circuit, which key
 * fingerprints) without seeing proof bodies, witnesses or anything payroll
 * related. Only identifier-shaped values are shown, and only as shortened
 * fingerprints; anything else is reported as unavailable.
 */

export const VERIFICATION_KEY_MISMATCH_CODE = "PROOF_VERIFICATION_KEY_MISMATCH";

export interface VerificationKeyMismatch {
  code: typeof VERIFICATION_KEY_MISMATCH_CODE;
  /** Key id the verifier is configured with. */
  expectedKeyId?: string | null;
  /** Key id the proof was generated for. */
  reportedKeyId?: string | null;
  circuitVersion?: string | null;
  detectedAt?: string | null;
}

/** Identifier-shaped values only: no spaces, no punctuation beyond `_ . : -`. */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{3,127}$/;

/** Shortens a key id to `first6…last4`; short ids are shown whole. Unsafe values give `null`. */
export function fingerprintKeyId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!SAFE_ID.test(trimmed)) return null;
  return trimmed.length <= 14 ? trimmed : `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

export interface VerificationKeyMismatchView {
  expected: string | null;
  reported: string | null;
  circuitVersion: string | null;
  detectedAt: string | null;
  /** True when both fingerprints are known and are visibly the same string. */
  fingerprintsLookEqual: boolean;
  summary: string;
  nextSteps: string[];
}

export function isVerificationKeyMismatch(value: unknown): value is VerificationKeyMismatch {
  return (
    !!value &&
    typeof value === "object" &&
    (value as { code?: unknown }).code === VERIFICATION_KEY_MISMATCH_CODE
  );
}

export function describeVerificationKeyMismatch(
  mismatch: VerificationKeyMismatch
): VerificationKeyMismatchView {
  const expected = fingerprintKeyId(mismatch.expectedKeyId);
  const reported = fingerprintKeyId(mismatch.reportedKeyId);
  const circuit = typeof mismatch.circuitVersion === "string" && SAFE_ID.test(mismatch.circuitVersion.trim())
    ? mismatch.circuitVersion.trim()
    : null;
  const detectedAt =
    typeof mismatch.detectedAt === "string" && !Number.isNaN(Date.parse(mismatch.detectedAt))
      ? mismatch.detectedAt
      : null;

  const nextSteps = [
    "Do not retry the same proof — it will fail again against this key.",
    "Confirm the verifier is configured with the verification key for the circuit version used to generate the proof.",
    "If the circuit was upgraded, generate a new proof with the current circuit and resubmit.",
    "If the key looks correct, contact your platform administrator before changing key configuration.",
  ];

  return {
    expected,
    reported,
    circuitVersion: circuit,
    detectedAt,
    fingerprintsLookEqual: expected !== null && expected === reported,
    summary:
      "The proof was checked against a different verification key than the one it was generated for. The proof itself may be valid.",
    nextSteps,
  };
}
