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

