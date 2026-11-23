// Payroll draft lock ownership display (#553).
//
// The draft store has always carried `lastSavedBy` (stores/payrollDrafts.ts:17)
// and it has always been written — but it was never rendered anywhere, so the
// screen that offers "Recover" on someone else's draft gave no indication of
// who last touched it. Two admins working the same pay period could silently
// overwrite each other with no way to tell whose work it was.
//
// The repo already has the right convention for showing an owner identity:
// `shortAddress()` in components/features/payroll/PayrollLockReasonViewer.tsx
// truncates to `GXXXXX...XXXX` and maps the "system" sentinel to "System".
// That helper is local to that component, so it is reproduced here as a pure,
// tested function rather than imported from a UI file.
//
// PRIVACY: an owner identity is an internal address or email, never payroll
// data. `lib/privacy/redact.ts:282-283` already lists `lockedBy`/`locked_by`
// as redactable fields, so this display must never widen what is shown — it
// shows *who*, never what was paid.

/** Sentinel used for non-human actors (system, scheduler, migration). */
const SYSTEM_OWNERS = new Set(["system", "scheduler", "migration", "api"]);

/**
 * Stellar strkeys are 56-char base32 and always start with a type prefix.
 * These are the identifiers that need truncating; an email or a username is
 * already short and human-readable, and slicing one to `financ...l.io` is
 * pure noise that hides which account it refers to.
 */
const STRKEY_PREFIXES = ["G", "S", "C"];
const STRKEY_MIN_LENGTH = 40;

/** Anything longer than this is treated as an opaque token and truncated. */
const MAX_IDENTITY_LENGTH = 64;

/**
 * Truncates an owner identity for display.
 *
 * Long opaque addresses (Stellar strkeys) follow the existing
 * `shortAddress()` convention in components/features/payroll/PayrollLockReasonViewer.tsx
 * so the two owner surfaces in the app cannot drift apart. Short
 * human-readable identities are shown in full, because the account is
 * already known to whoever is looking at the screen and truncating it
 * removes information without adding privacy.
 *
 * @param value Raw owner identity as stored on the draft.
 * @returns A display-safe label. Never echoes an empty or malformed value.
 */
export function formatDraftOwner(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "Unknown";

  const lower = trimmed.toLowerCase();
  if (SYSTEM_OWNERS.has(lower)) {
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  const isStrkey =
    trimmed.length >= STRKEY_MIN_LENGTH && STRKEY_PREFIXES.includes(trimmed.charAt(0));
  if (isStrkey || trimmed.length > MAX_IDENTITY_LENGTH) {
    return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
  }
  return trimmed;
}

/**
 * How long ago the draft was last saved, relative to `now`.
 *
 * Injected rather than read from the clock so the result is deterministic in
 * tests; the component passes `Date.now()`.
 */
export function describeDraftOwnershipAge(updatedAt: string, now: number): string {
  const updated = Date.parse(updatedAt);
  // An unparseable timestamp is the draft's problem, not the UI's — showing
  // "just now" would be a lie, so say nothing was knowable.
  if (!Number.isFinite(updated)) return "";

  const elapsedMs = now - updated;
  if (elapsedMs < 0) return "just now";
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export interface DraftOwnership {
  /** Display-safe owner label. */
  owner: string;
  /** Relative age of the last save, or "" when the timestamp is unusable. */
  age: string;
  /** True when the draft has no recorded owner at all. */
  isUnknown: boolean;
}

/**
 * Resolves everything needed to render a draft's ownership line.
 *
 * @param draft The draft as stored — only the two identity fields are read.
 * @param now Injected clock, defaults to the current time.
 */
export function resolveDraftOwnership(
  draft: { lastSavedBy?: string; updatedAt: string },
  now: number = Date.now(),
): DraftOwnership {
  const raw = (draft.lastSavedBy ?? "").trim();
  return {
    owner: formatDraftOwner(raw),
    age: describeDraftOwnershipAge(draft.updatedAt, now),
    isUnknown: raw === "",
  };
}
