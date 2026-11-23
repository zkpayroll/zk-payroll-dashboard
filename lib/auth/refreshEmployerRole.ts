import type { UserRole } from "@/types";

/**
 * Re-reads the signed-in employer's role from the server (#856).
 *
 * A role shown or cached in the UI can go stale: an admin may have demoted the
 * operator, or the session may have been revoked, since the page loaded. Run
 * this immediately before a payroll submission and decide with the result
 * instead of the cached role.
 *
 * Privacy rule: only the role name is read from the response. Nothing else in
 * the body (public keys, payroll or employee data a misbehaving endpoint might
 * echo) is returned, stored or put in a message.
 */

export const SESSION_ENDPOINT = "/api/auth/session";
export const DEFAULT_ROLE_REFRESH_TIMEOUT_MS = 5_000;

export type EmployerRoleRefresh =
  /** The server confirmed the current role. */
  | { status: "fresh"; role: UserRole }
  /** The session is missing, expired, revoked, or names no valid role. */
  | { status: "session_invalid" }
  /** The role could not be read (network error, timeout, server error, bad body). */
  | { status: "unavailable" };

export interface RefreshEmployerRoleOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "operator" || value === "auditor";
}

export async function refreshEmployerRole(
  options: RefreshEmployerRoleOptions = {},
): Promise<EmployerRoleRefresh> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_ROLE_REFRESH_TIMEOUT_MS;

  if (typeof fetchImpl !== "function") return { status: "unavailable" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(SESSION_ENDPOINT, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    // 5xx means the session service failed, not that the session is gone.
    if (!res.ok) {
      return { status: res.status >= 500 ? "unavailable" : "session_invalid" };
    }

    const body: unknown = await res.json();
    const role =
      typeof body === "object" && body !== null && "role" in body
        ? (body as { role: unknown }).role
        : null;

    return isUserRole(role) ? { status: "fresh", role } : { status: "session_invalid" };
  } catch {
    return { status: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

export type SubmissionRoleCheck =
  | {
      ok: true;
      role: UserRole;
      /** True when the fresh role differs from the one the page was using. */
      changed: boolean;
    }
  | {
      ok: false;
      reason: "session_invalid" | "unavailable";
      /** Whether trying again can help (no for a revoked session). */
      retryable: boolean;
      message: string;
    };

/**
 * Turns a refresh result into a go/no-go for submission. A role that cannot be
 * confirmed never counts as allowed: failing closed is the point of the check.
 *
 * When the role has changed since the page loaded, the message tells the user
 * to reload so the UI reflects their current permissions. No role names from
 * the server are echoed beyond the typed UserRole value.
 */
export function checkRoleForSubmission(
  refresh: EmployerRoleRefresh,
  previousRole?: UserRole | null,
): SubmissionRoleCheck {
  if (refresh.status === "fresh") {
    return {
      ok: true,
      role: refresh.role,
      changed: previousRole != null && previousRole !== refresh.role,
    };
  }

  if (refresh.status === "session_invalid") {
    return {
      ok: false,
      reason: "session_invalid",
      retryable: false,
      message:
        "Your session could not be verified, so your employer role could not be confirmed. Sign in again, then submit.",
    };
  }

  return {
    ok: false,
    reason: "unavailable",
    retryable: true,
    message:
      "Could not confirm your employer role right now. Nothing was submitted. Check your connection and try again.",
  };
}
