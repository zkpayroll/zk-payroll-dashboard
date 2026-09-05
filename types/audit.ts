export interface AttestationDigestMetadata {
  digest: string;
  schemaVersion: string;
  period: string;
  scope: {
    included: string[];
    excluded: string[];
  };
  verificationState: "verified" | "mismatch" | "missing" | "incomplete";
  createdAt: string;
  verifiedAt?: string;
  referencedBy?: string;
}

export interface AttestationDigestValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

export function validateDigestMetadata(
  metadata: AttestationDigestMetadata | null
): AttestationDigestValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!metadata) {
    return { isValid: false, warnings: [], errors: ["No digest data provided."] };
  }

  if (!metadata.digest || metadata.digest.trim().length === 0) {
    errors.push("Digest reference is empty or missing.");
  }

  if (!metadata.schemaVersion || metadata.schemaVersion.trim().length === 0) {
    errors.push("Schema version is missing.");
  }

  if (!metadata.period || metadata.period.trim().length === 0) {
    warnings.push("Audit period is not specified.");
  }

  if (metadata.scope.included.length === 0) {
    warnings.push("No scope items are included in the attestation.");
  }

  if (metadata.verificationState === "mismatch") {
    errors.push("Verification state mismatch detected — digest does not match on-chain record.");
  }

  if (metadata.verificationState === "missing") {
    errors.push("Verification state is missing — attestation could not be confirmed.");
  }

  if (metadata.verificationState === "incomplete") {
    warnings.push("Verification state is incomplete — metadata may be partial.");
  }

  const knownSchemaVersions = ["1.0", "1.1", "2.0"];
  if (
    metadata.schemaVersion &&
    !knownSchemaVersions.includes(metadata.schemaVersion)
  ) {
    warnings.push(
      `Schema version "${metadata.schemaVersion}" is not a recognized version. Compatibility cannot be guaranteed.`
    );
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}
