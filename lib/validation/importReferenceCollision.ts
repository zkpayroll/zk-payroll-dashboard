/**
 * External import reference collision validation.
 *
 * Import references are external batch or job identifiers provided during
 * employee CSV imports or batch imports (e.g. IMP-2025-001). Guidance
 * prevents duplicate imports before they create duplicate payroll work.
 *
 * Privacy-safe: only the reference string is checked and reported in messages.
 * No salary values, employee PII, or commitment hashes are exposed.
 */

export interface ImportReferenceCollisionResult {
  isCollision: boolean;
  normalized: string;
  warningMessage: string | null;
}

/**
 * Normalize an import reference by trimming whitespace and collapsing internal spaces.
 */
export function normalizeImportReference(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

/**
 * Check if a given import reference collides with existing imported reference identifiers.
 * Case-insensitive comparison prevents near-duplicates (e.g. "IMP-001" vs "imp-001").
 */
export function checkImportReferenceCollision(
  raw: string,
  existingReferences: string[] = []
): ImportReferenceCollisionResult {
  const normalized = normalizeImportReference(raw);
  if (!normalized) {
    return {
      isCollision: false,
      normalized: "",
      warningMessage: null,
    };
  }

  const normalizedLower = normalized.toLowerCase();
  const isDuplicate = existingReferences.some(
    (ref) => normalizeImportReference(ref).toLowerCase() === normalizedLower
  );

  if (isDuplicate) {
    return {
      isCollision: true,
      normalized,
      warningMessage: `Import reference '${normalized}' has already been processed. Using duplicate references may create redundant payroll work.`,
    };
  }

  return {
    isCollision: false,
    normalized,
    warningMessage: null,
  };
}
