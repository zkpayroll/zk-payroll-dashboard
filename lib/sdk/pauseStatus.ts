import { useCompanyWarningsStore } from "@/stores/companyWarnings";

export type PauseCategory = "payroll" | "treasury" | "audit" | "admin";

export interface PauseStatus {
  paused: boolean;
  categories: PauseCategory[];
  reason?: string;
}

const BLOCKED_ACTION_TO_CATEGORY: Record<string, PauseCategory> = {
  run_payroll: "payroll",
  send_payments: "payroll",
  approve_transactions: "admin",
  modify_treasury: "treasury",
  edit_employees: "admin",
};

export function fetchPauseStatus(): PauseStatus {
  const { companyState, getActiveWarnings } =
    useCompanyWarningsStore.getState();

  if (!companyState.isPaused) {
    return { paused: false, categories: [] };
  }

  const pausedWarning = getActiveWarnings().find(
    (w) => w.reason === "paused",
  );

  const categories: PauseCategory[] = [];
  if (pausedWarning) {
    for (const action of pausedWarning.blockedActions) {
      const cat = BLOCKED_ACTION_TO_CATEGORY[action];
      if (cat && !categories.includes(cat)) {
        categories.push(cat);
      }
    }
  }

  return {
    paused: true,
    categories,
    reason: pausedWarning?.message,
  };
}
