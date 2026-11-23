import type { EvidencePointerType } from "@/types/models";

/**
 * IPFS CIDs: base58btc CIDv0 (`Qm...`, 46 chars) or base32 CIDv1
 * (`b...`, lowercase alphanumeric).
 */
const IPFS_CIDV0_PATTERN = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
const IPFS_CIDV1_PATTERN = /^b[a-z2-7]{20,}$/;

/** A hex-encoded document/content hash, optionally 0x-prefixed. */
const DOCUMENT_HASH_PATTERN = /^(0x)?[0-9a-f]{16,}$/i;

/** A free-form external case reference — must be non-trivial, no raw content. */
const CASE_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/;

export interface EvidencePointerValidationResult {
  isValid: boolean;
  normalized: string;
  message: string | null;
}

/**
 * Normalize a pasted or typed evidence pointer reference: trims surrounding
 * whitespace and strips embedded whitespace/newlines from clipboard paste
 * artifacts. URLs and case references keep their original casing;
 * document hashes and IPFS CIDs are left as-is since case is significant
 * for base58/base32 CIDs and mixed-case hex hashes.
 */
export function normalizeEvidencePointerReference(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validates an evidence pointer's reference against the shape expected for
 * its declared type. This checks only the pointer's format — it never
 * fetches or inspects the referenced content, preserving the "pointer, not
 * payload" guarantee this feature exists for.
 */
export function validateEvidencePointerReference(
  pointerType: EvidencePointerType,
  raw: string,
): EvidencePointerValidationResult {
  const normalized = normalizeEvidencePointerReference(raw);

  if (normalized.length === 0) {
    return { isValid: false, normalized, message: "A reference is required." };
  }

  switch (pointerType) {
    case "url":
      if (!isValidUrl(normalized)) {
        return {
          isValid: false,
          normalized,
          message: "Reference is not a valid URL.",
        };
      }
      break;
    case "ipfs":
      if (!IPFS_CIDV0_PATTERN.test(normalized) && !IPFS_CIDV1_PATTERN.test(normalized)) {
        return {
          isValid: false,
          normalized,
          message: "Reference is not a valid IPFS CID (expected Qm... or b...).",
        };
      }
      break;
    case "document-hash":
      if (!DOCUMENT_HASH_PATTERN.test(normalized)) {
        return {
          isValid: false,
          normalized,
          message: "Reference is not a valid document hash (expected hex, optionally 0x-prefixed).",
        };
      }
      break;
    case "case-reference":
      if (!CASE_REFERENCE_PATTERN.test(normalized)) {
        return {
          isValid: false,
          normalized,
          message: "Reference must be 3-64 characters: letters, numbers, dots, dashes, or underscores.",
        };
      }
      break;
  }

  return { isValid: true, normalized, message: null };
}
