"use client";

import { useMemo } from "react";
import { useWalletStore } from "@/stores/walletStore";
import { useCompanyStore } from "@/stores/company";
import { useEnvironmentStore } from "@/stores/environment";
import { MOCK_COMPANIES, MOCK_TREASURY_BALANCE } from "@/lib/api/mockData";
import {
  computeTreasuryReadiness,
  type ReadinessSummary,
} from "@/lib/treasury/readiness";

export interface UseTreasuryReadinessOptions {
  /**
   * Override for the projected payroll amount (e.g. when the wizard has a
   * calculated total). Falls back to the mock forecast when omitted.
   */
  projectedPayroll?: number;
  /**
   * Override for the treasury balance. Useful when the wizard or admin
   * overview has a known value that should win over the mock.
   */
  balance?: number;
}

/**
 * Subscribe to wallet + company state and produce the current treasury
 * readiness summary. The result is memoised so consumers can rely on
 * referential stability for `overall` re-renders.
 */
export function useTreasuryReadiness(
  options: UseTreasuryReadinessOptions = {},
): ReadinessSummary {
  const isConnected = useWalletStore((s) => s.isConnected);
  const publicKey = useWalletStore((s) => s.publicKey);
  const network = useWalletStore((s) => s.network);
  const company = useCompanyStore((s) => s.company);
  const expectedNetwork = useEnvironmentStore((s) => s.getActiveProfileConfig().stellarNetwork);

  // The dashboard currently runs against the in-repo mock data set
  // (see `lib/api/mockData.ts` – used throughout the Treasury / Admin /
  // Payroll views), so we mirror that convention here: fall back to the
  // first mock company when the persisted store is empty so the checklist
  // has something to show during local development. When the company store
  // later carries real data it will override the mock automatically.
  const treasuryAddress = company?.treasury ?? MOCK_COMPANIES[0]?.treasury ?? null;
  const companyAdmin = company?.admin ?? MOCK_COMPANIES[0]?.admin ?? null;
  const balance = options.balance ?? MOCK_TREASURY_BALANCE.balance;
  const projectedPayroll =
    options.projectedPayroll ?? MOCK_TREASURY_BALANCE.projectedPayroll;

  return useMemo(
    () =>
      computeTreasuryReadiness({
        balance,
        projectedPayroll,
        treasuryAddress,
        expectedNetwork,
        currentNetwork: network,
        isWalletConnected: isConnected,
        companyAdmin,
        walletPublicKey: publicKey ?? null,
      }),
    [
      balance,
      projectedPayroll,
      treasuryAddress,
      expectedNetwork,
      network,
      isConnected,
      companyAdmin,
      publicKey,
    ],
  );
}
