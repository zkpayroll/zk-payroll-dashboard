"use client";

import { useEffect, useState } from "react";
import { useWalletStore } from "@/stores/walletStore";
import { fetchRoleDirectory } from "@/lib/auth/roleDirectory";
import type { UserRole } from "@/types";

export interface PayrollOperatorState {
  /** Wallet address of the resolved operator, when one is available. */
  operatorAddress: string | null;
  /** Role group the address belongs to, null while loading or when unknown. */
  role: UserRole | null;
  /** True when the address holds the payroll operator role. */
  isOperator: boolean;
  /** True while the role lookup is in flight. */
  isLoading: boolean;
}

/**
 * Resolve whether a wallet address holds the payroll operator role.
 *
 * Used by the dashboard's Quick Actions to gate the "Execute Payroll" action:
 * the caller passes an explicit `operatorAddress` when it knows the active
 * operator, otherwise the connected wallet's public key is used. Role
 * membership is resolved against the role directory (see
 * `lib/auth/roleDirectory.ts`), which mirrors the mock data set the rest of
 * the dashboard runs against. No salary, balance, or payout data is read —
 * only role membership for the given address.
 */
export function usePayrollOperator(
  operatorAddress?: string,
): PayrollOperatorState {
  const walletAddress = useWalletStore((state) => state.publicKey);
  const address = operatorAddress ?? walletAddress ?? null;

  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(address !== null);

  useEffect(() => {
    if (!address) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchRoleDirectory()
      .then(({ groups }) => {
        if (cancelled) return;
        const match = groups.find(
          (group) =>
            group.key !== "complianceReviewer" &&
            group.members.some((member) => member.walletAddress === address),
        );
        setRole(match ? (match.key as UserRole) : null);
      })
      .catch(() => {
        // A failed lookup must never block the dashboard; treat it as
        // "role unknown" so the caller falls back to its own gating.
        if (!cancelled) setRole(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return {
    operatorAddress: address,
    role,
    isOperator: role === "operator",
    isLoading,
  };
}
