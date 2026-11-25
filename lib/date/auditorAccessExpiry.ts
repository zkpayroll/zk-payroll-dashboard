export type AuditorAccessExpiryState =
  | "active"
  | "expiring_soon"
  | "expired"
  | "unknown";

export const AUDITOR_ACCESS_EXPIRING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuditorAccessExpiryInput {
  expiresAt?: string | null;
  isActive?: boolean;
  revokedAt?: string | null;
}

export interface AuditorAccessExpiryEvaluation {
  state: AuditorAccessExpiryState;
  label: string;
  message: string;
  remainingMs: number | null;
}

export function evaluateAuditorAccessExpiry(
  input: AuditorAccessExpiryInput,
  now: number = Date.now(),
  warningWindowMs: number = AUDITOR_ACCESS_EXPIRING_WINDOW_MS,
): AuditorAccessExpiryEvaluation {
  if (input.isActive === false || input.revokedAt) {
    return {
      state: "expired",
      label: "Expired",
      message: "Auditor access is no longer active.",
      remainingMs: null,
    };
  }

  if (!input.expiresAt) {
    return {
      state: "unknown",
      label: "Unknown",
      message: "Auditor access expiry is unavailable.",
      remainingMs: null,
    };
  }

  const expiresAtMs = Date.parse(input.expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return {
      state: "unknown",
      label: "Unknown",
      message: "Auditor access expiry could not be verified.",
      remainingMs: null,
    };
  }

  if (expiresAtMs <= now) {
    return {
      state: "expired",
      label: "Expired",
      message: "Auditor access has expired.",
      remainingMs: 0,
    };
  }

  const remainingMs = expiresAtMs - now;
  if (remainingMs <= warningWindowMs) {
    return {
      state: "expiring_soon",
      label: "Expiring soon",
      message: "Auditor access expires soon.",
      remainingMs,
    };
  }

  return {
    state: "active",
    label: "Active",
    message: "Auditor access is active.",
    remainingMs,
  };
}

// #796 — Compact, per-row warning helper for audit-grant tables. Returns
// `null` when the grant is not in a warning state (either plenty of time
// remaining, already expired, or expiry unknown — those are handled by the
// page-level banner and the status badge).
export interface AuditGrantExpiryWarning {
  label: string;
  message: string;
  remainingDays: number;
}

export function formatAuditGrantExpiryWarning(
  input: AuditorAccessExpiryInput,
  now: number = Date.now(),
  warningWindowMs: number = AUDITOR_ACCESS_EXPIRING_WINDOW_MS,
): AuditGrantExpiryWarning | null {
  const evaluation = evaluateAuditorAccessExpiry(input, now, warningWindowMs);
  if (evaluation.state !== "expiring_soon" || evaluation.remainingMs === null) {
    return null;
  }
  // Ceiling the remainder so "<23h 59m" still reads "1 day" rather than "0",
  // which would collapse into the expired state visually.
  const remainingDays = Math.max(
    1,
    Math.ceil(evaluation.remainingMs / (24 * 60 * 60 * 1000)),
  );
  return {
    label: `Expires in ${remainingDays} day${remainingDays === 1 ? "" : "s"}`,
    message: `Audit grant expires in ${remainingDays} day${remainingDays === 1 ? "" : "s"}. Extend or re-issue it before the deadline to avoid interrupting access.`,
    remainingDays,
  };
}

