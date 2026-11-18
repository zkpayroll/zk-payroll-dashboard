/**
 * Audit attestation digest metadata (#320).
 *
 * An attestation digest is a hash commitment over a payroll evidence bundle.
 * Auditors verify the digest reference against the on-chain or exported
 * value; they never need the underlying salary rows, so these types carry
 * metadata only.
 */

export type AttestationDigestAlgorithm = "sha256" | "poseidon";

/** Verification result reported for a digest. */
export type AttestationVerificationStatus = "verified" | "mismatch" | "pending" | "unverified";

/** What the viewer flags after checking the digest metadata. */
export type AttestationDigestState =
  | "verified"
  | "mismatch"
  | "pending"
  | "incomplete"
  | "incompatible";

export interface AttestationPeriod {
  start: string;
  end: string;
}

/** Which evidence the digest covers, by reference only. */
export interface AttestationScope {
  companyId: string;
  payrollRunIds: string[];
  employeeCount?: number;
}

export interface AttestationDigest {
  id: string;
  /** Hex-encoded digest, with or without a `0x` prefix. */
  digest?: string | null;
  algorithm?: AttestationDigestAlgorithm | null;
  schemaVersion?: string | null;
  period?: AttestationPeriod | null;
  scope?: AttestationScope | null;
  /** Digest recorded at attestation time, used to detect mismatches. */
  expectedDigest?: string | null;
  verificationStatus: AttestationVerificationStatus;
  verifiedAt?: string | null;
}

export interface AttestationDigestEvaluation {
  state: AttestationDigestState;
  warnings: string[];
}
