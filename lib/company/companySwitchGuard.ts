import type { Company, UserRole } from "@/types";

export type CompanySwitchBlockReason =
  | "not-admin"
  | "company-inactive"
  | "invalid-admin-address"
  | "unauthorized-admin";

export interface CompanySwitchGuardResult {
  allowed: boolean;
  reason: CompanySwitchBlockReason | null;
  message: string | null;
}

function isStellarAddress(value: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(value);
}

/**
 * Guard evaluated before an admin is allowed to switch the active company
 * context (#223). Prevents switching into a company that is inactive,
 * misconfigured, or that the connected wallet is not authorized to
 * administer.
 *
 * @param target The company being switched into.
 * @param currentRole The role of the user attempting the switch.
 * @param currentPublicKey The connected wallet's public key, when known.
 *   When omitted, the admin-address authorization check is skipped (the
 *   caller is expected to enforce it separately, e.g. no wallet connected
 *   yet).
 */
export function evaluateCompanySwitch(
  target: Company,
  currentRole: UserRole,
  currentPublicKey?: string | null,
): CompanySwitchGuardResult {
  if (currentRole !== "admin") {
    return {
      allowed: false,
      reason: "not-admin",
      message: "Only admins can switch the active company context.",
    };
  }

  if (!target.isActive) {
    return {
      allowed: false,
      reason: "company-inactive",
      message: `${target.name} is inactive and cannot be switched into.`,
    };
  }

  if (!target.admin || !isStellarAddress(target.admin)) {
    return {
      allowed: false,
      reason: "invalid-admin-address",
      message: `${target.name} has an invalid or missing admin address. Fix its configuration before switching.`,
    };
  }

  if (currentPublicKey && currentPublicKey !== target.admin) {
    return {
      allowed: false,
      reason: "unauthorized-admin",
      message: `Your connected wallet is not the configured admin for ${target.name}.`,
    };
  }

  return { allowed: true, reason: null, message: null };
}
