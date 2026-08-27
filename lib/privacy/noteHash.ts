/**
 * Note Hash Utilities for Privacy-Preserving Payroll References (#375).
 *
 * Allows users and auditors to attach and verify cryptographic note references
 * on-chain while keeping the underlying human-readable note text private off-chain.
 */

const HASH_REGEX = /^(0x)?[0-9a-fA-F]{64}$/;

export interface NoteHashValidationResult {
  isValid: boolean;
  error?: string;
  normalizedHash?: string;
}

/**
 * Generate a SHA-256 hash for a given payroll note string.
 * Resulting hash is prefixed with `0x`.
 */
export async function generateNoteHash(noteText: string): Promise<string> {
  const trimmed = noteText.trim();
  if (!trimmed) {
    throw new Error("Cannot generate hash for empty note");
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(trimmed);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}`;
}

/**
 * Validate a note hash to ensure it is a valid 32-byte hex hash.
 */
export function validateNoteHash(hash: string): NoteHashValidationResult {
  if (!hash || typeof hash !== "string") {
    return {
      isValid: false,
      error: "Note hash is required.",
    };
  }

  const trimmed = hash.trim();

  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: "Note hash cannot be empty.",
    };
  }

  if (!HASH_REGEX.test(trimmed)) {
    if (trimmed.startsWith("0x") && trimmed.length !== 66) {
      return {
        isValid: false,
        error: `Invalid hash length: expected 66 characters (0x + 64 hex), got ${trimmed.length}.`,
      };
    }
    if (!trimmed.startsWith("0x") && trimmed.length !== 64) {
      return {
        isValid: false,
        error: `Invalid hash length: expected 64 hex characters, got ${trimmed.length}.`,
      };
    }
    return {
      isValid: false,
      error: "Invalid characters in note hash. Only hexadecimal characters (0-9, a-f) are permitted.",
    };
  }

  const normalizedHash = trimmed.startsWith("0x") ? trimmed.toLowerCase() : `0x${trimmed.toLowerCase()}`;

  return {
    isValid: true,
    normalizedHash,
  };
}

/**
 * Format a hash for compact display (`0x1234…5678`).
 */
export function formatCompactHash(hash: string): string {
  if (!hash) return "—";
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

/**
 * Redacted placeholder returned once a note has been converted to a hash.
 */
export const REDACTED_NOTE_PLACEHOLDER = "[NOTE CONTENT REDACTED — HASH ATTACHED]";
