/**
 * Asset symbol normalization utilities.
 * Normalizes user-entered asset symbols before validation/submission
 * for consistency (trim, uppercase, remove inner whitespace).
 * Privacy-safe: only symbol strings handled, no amounts or private data.
 */

export interface NormalizeResult {
  /** Normalized symbol (uppercase, trimmed, no whitespace) */
  normalized: string;
  /** Original raw input */
  raw: string;
  /** Whether normalization changed the input */
  wasNormalized: boolean;
  /** Human-readable diff for UI warning (null when not normalized) */
  warningMessage: string | null;
  /** Whether the normalized symbol is syntactically valid */
  isValid: boolean;
  /** Validation error message, if any */
  validationError: string | null;
}

// Stellar asset code rules: 1-12 chars, alphanumeric, typically uppercase
const ASSET_CODE_PATTERN = /^[A-Z0-9]{1,12}$/;

/**
 * Normalize an asset symbol: trim whitespace, remove inner spaces, uppercase.
 * Returns both normalized value and whether a change occurred for UI warning.
 */
export function normalizeAssetSymbol(raw: string): NormalizeResult {
  const normalized = raw.trim().replace(/\s+/g, "").toUpperCase();
  const wasNormalized = normalized !== raw;

  let warningMessage: string | null = null;
  if (wasNormalized) {
    if (raw.trim() !== raw) warningMessage = `Symbol was trimmed from "${raw}" to "${normalized}" for consistency.`;
    else if (raw.replace(/\s+/g, "") !== raw) warningMessage = `Spaces were removed: "${raw}" → "${normalized}"`;
    else if (raw.toUpperCase() !== raw) warningMessage = `Symbol was normalized to uppercase: "${raw}" → "${normalized}"`;
    else warningMessage = `Symbol normalized: "${raw}" → "${normalized}"`;
    // Generic fallback if specific branch not hit
    if (!warningMessage) warningMessage = `Asset symbol normalized from "${raw}" to "${normalized}" for consistency.`;
  }

  // Validation on normalized form
  let isValid = true;
  let validationError: string | null = null;
  if (normalized.length === 0) {
    isValid = false;
    validationError = "Asset symbol is required.";
  } else if (!ASSET_CODE_PATTERN.test(normalized)) {
    isValid = false;
    validationError = "Asset symbol must be 1-12 alphanumeric characters (A-Z, 0-9).";
  }

  return {
    normalized,
    raw,
    wasNormalized,
    warningMessage: wasNormalized ? warningMessage : null,
    isValid,
    validationError,
  };
}

/**
 * Validate without normalizing (strict). Used to detect if user needs normalization warning.
 */
export function validateAssetSymbolStrict(raw: string): { isValid: boolean; error: string | null } {
  if (raw.length === 0) return { isValid: false, error: "Asset symbol is required." };
  if (!ASSET_CODE_PATTERN.test(raw)) return { isValid: false, error: "Asset symbol must be 1-12 alphanumeric characters (A-Z, 0-9)." };
  return { isValid: true, error: null };
}
