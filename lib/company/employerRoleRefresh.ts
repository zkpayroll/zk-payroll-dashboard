import type { Company, UserRole } from "@/types";

export const DEFAULT_ROLE_SNAPSHOT_TTL_MS = 30_000;

export type EmployerRoleRefreshErrorCode =
  | "refresh_failed"
  | "company_inactive"
  | "invalid_admin_address"
  | "employer_role_revoked"
  | "admin_transferred"
  | "stale_role_snapshot";

export interface EmployerRoleSnapshot {
  company: Company;
  role: UserRole;
  refreshedAt: string;
}

export interface EmployerRoleRefreshResult {
  allowed: boolean;
  reason: EmployerRoleRefreshErrorCode | null;
  message: string | null;
  roleChanged: boolean;
  adminTransferred: boolean;
  snapshot: EmployerRoleSnapshot | null;
}

export interface ValidateEmployerRoleSnapshotOptions {
  snapshot: EmployerRoleSnapshot | null | undefined;
  cachedCompany?: Company | null;
  cachedRole?: UserRole | null;
  currentPublicKey?: string | null;
  now?: Date;
  maxStalenessMs?: number;
}

export interface RefreshEmployerRoleBeforeSubmissionOptions {
  cachedCompany: Company | null;
  cachedRole: UserRole | null;
  currentPublicKey?: string | null;
  fetchLatestState: () => Promise<{
    company: Company | null;
    role: UserRole | null;
    refreshedAt?: string;
  }>;
  now?: Date;
  maxStalenessMs?: number;
}

function isStellarPublicKey(value: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(value);
}

export function maskStellarAddress(address: string | null | undefined): string {
  const trimmed = (address ?? "").trim();
  if (trimmed.length <= 12) {
    return trimmed || "unconfigured";
  }
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

/**
 * Validates a refreshed employer role snapshot before payroll submission (#856).
 * Prevents submitting payroll when employer permissions were revoked, transferred
 * to another admin wallet, or left stale prior to execution.
 */
export function validateEmployerRoleSnapshot(
  options: ValidateEmployerRoleSnapshotOptions,
): EmployerRoleRefreshResult {
  const {
    snapshot,
    cachedCompany,
    cachedRole,
    currentPublicKey,
    now = new Date(),
    maxStalenessMs = DEFAULT_ROLE_SNAPSHOT_TTL_MS,
  } = options;

  if (!snapshot || !snapshot.company) {
    return {
      allowed: false,
      reason: "refresh_failed",
      message:
        "Unable to verify live employer role permissions. Refresh your session before submitting payroll.",
      roleChanged: false,
      adminTransferred: false,
      snapshot: null,
    };
  }

  const { company, role, refreshedAt } = snapshot;
  const roleChanged = Boolean(cachedRole && cachedRole !== role);
  const adminTransferred = Boolean(
    cachedCompany?.admin && cachedCompany.admin !== company.admin,
  );

  const refreshedMs = Date.parse(refreshedAt);
  if (
    Number.isNaN(refreshedMs) ||
    now.getTime() - refreshedMs > Math.max(0, maxStalenessMs)
  ) {
    return {
      allowed: false,
      reason: "stale_role_snapshot",
      message: `Employer role verification for ${company.name} is older than ${Math.round(maxStalenessMs / 1000)}s. Re-verify permissions before submitting payroll.`,
      roleChanged,
      adminTransferred,
      snapshot,
    };
  }

  if (role !== "admin") {
    return {
      allowed: false,
      reason: "employer_role_revoked",
      message: `Employer admin role is no longer active for ${company.name} (current role: ${role}). Payroll submission has been blocked.`,
      roleChanged,
      adminTransferred,
      snapshot,
    };
  }

  if (!company.isActive) {
    return {
      allowed: false,
      reason: "company_inactive",
      message: `${company.name} was deactivated before payroll submission could start.`,
      roleChanged,
      adminTransferred,
      snapshot,
    };
  }

  if (!company.admin || !isStellarPublicKey(company.admin)) {
    return {
      allowed: false,
      reason: "invalid_admin_address",
      message: `${company.name} has an invalid employer admin address (${maskStellarAddress(company.admin)}). Update company settings before submitting payroll.`,
      roleChanged,
      adminTransferred,
      snapshot,
    };
  }

  if (
    (currentPublicKey && currentPublicKey !== company.admin) ||
    (adminTransferred && currentPublicKey !== company.admin)
  ) {
    return {
      allowed: false,
      reason: "admin_transferred",
      message: `Employer admin authority for ${company.name} is assigned to ${maskStellarAddress(company.admin)}. Reconnect with the active admin wallet before submitting payroll.`,
      roleChanged,
      adminTransferred: true,
      snapshot,
    };
  }

  return {
    allowed: true,
    reason: null,
    message: null,
    roleChanged,
    adminTransferred,
    snapshot,
  };
}

/**
 * Fetches live company and role details immediately prior to payroll submission
 * and validates that the caller still holds active employer admin authority (#856).
 */
export async function refreshEmployerRoleBeforeSubmission(
  options: RefreshEmployerRoleBeforeSubmissionOptions,
): Promise<EmployerRoleRefreshResult> {
  const {
    cachedCompany,
    cachedRole,
    currentPublicKey,
    fetchLatestState,
    now = new Date(),
    maxStalenessMs = DEFAULT_ROLE_SNAPSHOT_TTL_MS,
  } = options;

  try {
    const latest = await fetchLatestState();
    if (!latest.company || !latest.role) {
      return {
        allowed: false,
        reason: "refresh_failed",
        message:
          "Live employer role check returned incomplete company or session permissions. Retry before submitting payroll.",
        roleChanged: false,
        adminTransferred: false,
        snapshot: null,
      };
    }

    const snapshot: EmployerRoleSnapshot = {
      company: latest.company,
      role: latest.role,
      refreshedAt: latest.refreshedAt ?? now.toISOString(),
    };

    return validateEmployerRoleSnapshot({
      snapshot,
      cachedCompany,
      cachedRole,
      currentPublicKey,
      now,
      maxStalenessMs,
    });
  } catch {
    return {
      allowed: false,
      reason: "refresh_failed",
      message:
        "Could not refresh employer role details before payroll submission. Verify connectivity and retry.",
      roleChanged: false,
      adminTransferred: false,
      snapshot: null,
    };
  }
}
