/**
 * External payroll batch reference validation.
 *
 * Batch references are external, human-assigned identifiers for a payroll batch
 * (e.g. HR system ID, accounting reference). Guidance prevents duplicate or
 * malformed identifiers while keeping the value opaque — no salary or PII.
 *
 * Privacy-safe: only the reference string is validated/logged (trimmed). No
 * payroll amounts, commitments, or employee data are involved.
 */

export const BATCH_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/;

export const BATCH_REFERENCE_FORMAT_HINT =
  "Use 3–32 characters: letters, numbers, hyphens, dots, or underscores (e.g. BATCH-2025-001, payroll_q1_2025). Must start with a letter or number.";

export const BATCH_REFERENCE_EXAMPLES = ["BATCH-2025-001", "payroll_q1_2025", "EXT-REF.2025.03"] as const;

export interface BatchReferenceValidationResult {
  isValid: boolean;
  normalized: string;
  message: string | null;
  /** True when the reference is already in use elsewhere (duplicate). */
  isDuplicate?: boolean;
}

/**
 * Normalize a batch reference: trim surrounding whitespace and strip
 * embedded whitespace/newlines from paste artifacts. Preserves casing
 * because batch refs may be case-sensitive in external systems.
 */
export function normalizeBatchReference(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

/**
 * Validate a batch reference's format (length, character set).
 * Does not check duplicates — use `isDuplicateBatchReference` for that.
 */
export function validateBatchReference(raw: string): BatchReferenceValidationResult {
  const normalized = normalizeBatchReference(raw);

  if (normalized.length === 0) {
    return { isValid: false, normalized, message: "Batch reference is required." };
  }

  if (normalized.length < 3) {
    return { isValid: false, normalized, message: "Batch reference must be at least 3 characters." };
  }

  if (normalized.length > 32) {
    return { isValid: false, normalized, message: "Batch reference must be 32 characters or fewer." };
  }

  if (!BATCH_REFERENCE_PATTERN.test(normalized)) {
    return {
      isValid: false,
      normalized,
      message: `Invalid batch reference. ${BATCH_REFERENCE_FORMAT_HINT}`,
    };
  }

  return { isValid: true, normalized, message: null };
}

/**
 * Whether a normalized reference already exists in the provided list.
 * Comparison is case-insensitive after normalization, because most external
 * systems treat batch IDs case-insensitively and the helper copy should
 * steer users away from near-duplicates like "BATCH-001" vs "batch-001".
 */
export function isDuplicateBatchReference(
  raw: string,
  existingReferences: string[],
): boolean {
  const normalized = normalizeBatchReference(raw).toLowerCase();
  if (!normalized) return false;
  return existingReferences.some((r) => normalizeBatchReference(r).toLowerCase() === normalized);
}

/**
 * Full validation including duplicate check. Pass the list of already-known
 * batch references (e.g. from API, mock data, or local store) to surface
 * the duplicate message instead of a generic “invalid” error.
 */
export function validateBatchReferenceWithDuplicateCheck(
  raw: string,
  existingReferences: string[] = [],
): BatchReferenceValidationResult {
  const base = validateBatchReference(raw);
  if (!base.isValid) return base;

  if (isDuplicateBatchReference(base.normalized, existingReferences)) {
    return {
      isValid: false,
      normalized: base.normalized,
      message: "This batch reference is already in use. Choose a unique identifier to avoid duplicate payroll batches.",
      isDuplicate: true,
    };
  }

  return { ...base, isDuplicate: false };
}
