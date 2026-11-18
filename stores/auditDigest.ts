import { create } from "zustand";
import type {
  AttestationDigest,
  AttestationDigestEvaluation,
} from "@/types/audit";

/** Attestation schema versions this dashboard knows how to read. */
export const SUPPORTED_ATTESTATION_SCHEMA_VERSIONS = ["1.0", "1.1"] as const;

const DIGEST_HEX_LENGTH = 64;

/** Lower-cases a digest reference and strips whitespace and any `0x` prefix. */
export function normalizeDigest(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/^0x/, "");
}

export function isWellFormedDigest(value: string | null | undefined): boolean {
  const normalized = normalizeDigest(value);
  return normalized.length === DIGEST_HEX_LENGTH && /^[0-9a-f]+$/.test(normalized);
}

/** Compares two digest references, ignoring case, whitespace and `0x`. */
export function digestsMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const left = normalizeDigest(a);
  return left.length > 0 && left === normalizeDigest(b);
}

/**
 * Checks digest metadata and returns what the viewer should flag. Missing
 * fields make a digest incomplete; an unknown schema version or a malformed
 * digest makes it incompatible; a recorded digest that differs from the
 * current one is a mismatch.
 */
export function evaluateAttestationDigest(
  digest: AttestationDigest
): AttestationDigestEvaluation {
  const warnings: string[] = [];

  if (!digest.digest) warnings.push("Digest value is missing.");
  if (!digest.schemaVersion) warnings.push("Schema version is missing.");
  if (!digest.period?.start || !digest.period?.end) {
    warnings.push("Attestation period is missing.");
  }
  if (!digest.scope?.companyId || !digest.scope.payrollRunIds?.length) {
    warnings.push("Attestation scope is missing.");
  }
  if (warnings.length > 0) return { state: "incomplete", warnings };

  if (
    !SUPPORTED_ATTESTATION_SCHEMA_VERSIONS.includes(
      digest.schemaVersion as (typeof SUPPORTED_ATTESTATION_SCHEMA_VERSIONS)[number]
    )
  ) {
    warnings.push(
      `Schema version ${digest.schemaVersion} is not supported (expected ${SUPPORTED_ATTESTATION_SCHEMA_VERSIONS.join(
        " or "
      )}).`
    );
  }
  if (!isWellFormedDigest(digest.digest)) {
    warnings.push("Digest is not a 32-byte hex value.");
  }
  if (warnings.length > 0) return { state: "incompatible", warnings };

  if (
    digest.verificationStatus === "mismatch" ||
    (digest.expectedDigest && !digestsMatch(digest.digest, digest.expectedDigest))
  ) {
    return {
      state: "mismatch",
      warnings: ["Digest does not match the value recorded at attestation."],
    };
  }

  if (digest.verificationStatus === "verified") return { state: "verified", warnings };
  return { state: "pending", warnings: ["Digest has not been verified yet."] };
}

interface AuditDigestStore {
  digests: AttestationDigest[];
  selectedDigestId: string | null;
  setDigests: (digests: AttestationDigest[]) => void;
  selectDigest: (id: string | null) => void;
  getSelectedDigest: () => AttestationDigest | undefined;
}

export const useAuditDigestStore = create<AuditDigestStore>((set, get) => ({
  digests: [],
  selectedDigestId: null,

  setDigests: (digests) => set({ digests }),

  selectDigest: (id) => set({ selectedDigestId: id }),

  getSelectedDigest: () => {
    const { digests, selectedDigestId } = get();
    return digests.find((d) => d.id === selectedDigestId);
  },
}));
