"use client";

import { useState, useEffect, useCallback } from "react";
import { useCompanyWarningsStore } from "@/stores/companyWarnings";
import {
  canPerformMutation,
  type DashboardPayrollAction,
  type MutationGuardResult,
} from "@/src/payroll/contractPauseGuard";
import type { PauseCategory } from "@/lib/sdk/pauseStatus";

export interface ContractPauseGuardHook {
  isPaused: boolean;
  isMutationDisabled: boolean;
  pauseReason: string | null;
  categories: PauseCategory[];
  checkAction: (action: DashboardPayrollAction) => MutationGuardResult;
  remediationHref: string;
}

export function useContractPauseGuard(): ContractPauseGuardHook {
  const { companyState, getActiveWarnings } = useCompanyWarningsStore();
  const isPaused = Boolean(companyState?.isPaused);

  const [activeCategories, setActiveCategories] = useState<PauseCategory[]>([]);
  const [pauseReason, setPauseReason] = useState<string | null>(null);

  useEffect(() => {
    if (!isPaused) {
      setActiveCategories([]);
      setPauseReason(null);
      return;
    }

    const warnings = getActiveWarnings();
    const pausedWarning = warnings.find((w) => w.reason === "paused");
    setPauseReason(pausedWarning?.message ?? null);

    const cats: PauseCategory[] = [];
    if (pausedWarning?.blockedActions) {
      if (
        pausedWarning.blockedActions.includes("run_payroll") ||
        pausedWarning.blockedActions.includes("send_payments")
      ) {
        cats.push("payroll");
      }
      if (pausedWarning.blockedActions.includes("modify_treasury")) {
        cats.push("treasury");
      }
      if (pausedWarning.blockedActions.includes("approve_transactions")) {
        cats.push("admin");
      }
    }
    setActiveCategories(cats);
  }, [isPaused, getActiveWarnings]);

  // When paused and no categories are specified or category includes "payroll", mutations are disabled
  const isMutationDisabled =
    isPaused &&
    (activeCategories.length === 0 || activeCategories.includes("payroll"));

  const checkAction = useCallback(
    (action: DashboardPayrollAction): MutationGuardResult => {
      return canPerformMutation(action, {
        isPaused,
        pausedCategories: activeCategories,
        reason: pauseReason,
      });
    },
    [isPaused, activeCategories, pauseReason],
  );

  return {
    isPaused,
    isMutationDisabled,
    pauseReason,
    categories: activeCategories,
    checkAction,
    remediationHref: "/admin",
  };
}
