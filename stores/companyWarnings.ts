import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CompanyBlockReason =
  | "paused"
  | "archived"
  | "incomplete_setup"
  | "missing_contracts"
  | "treasury_insufficient"
  | "compliance_hold";

export type WarningSeverity = "info" | "warning" | "critical";

export interface CompanyWarning {
  id: string;
  reason: CompanyBlockReason;
  severity: WarningSeverity;
  title: string;
  message: string;
  nextSteps: string[];
  blockedActions: string[];
  createdAt: string;
  dismissed: boolean;
}

interface CompanyWarningsStore {
  warnings: CompanyWarning[];
  companyState: {
    isActive: boolean;
    isPaused: boolean;
    isArchived: boolean;
    setupComplete: boolean;
    contractsConfigured: boolean;
    treasuryFunded: boolean;
    complianceClear: boolean;
  };
  lastChecked: string | null;

  setCompanyState: (state: Partial<CompanyWarningsStore["companyState"]>) => void;
  evaluateWarnings: () => void;
  dismissWarning: (id: string) => void;
  dismissAllWarnings: () => void;
  getActiveWarnings: () => CompanyWarning[];
  getCriticalWarnings: () => CompanyWarning[];
  hasBlockingWarnings: () => boolean;
  getBlockedActions: () => string[];
  reset: () => void;
}

const defaultCompanyState = {
  isActive: true,
  isPaused: false,
  isArchived: false,
  setupComplete: true,
  contractsConfigured: true,
  treasuryFunded: true,
  complianceClear: true,
};

function generateWarnings(state: CompanyWarningsStore["companyState"]): CompanyWarning[] {
  const now = new Date().toISOString();
  const warnings: CompanyWarning[] = [];

  if (state.isPaused) {
    warnings.push({
      id: `warn_paused_${Date.now()}`,
      reason: "paused",
      severity: "critical",
      title: "Company is paused",
      message: "Payroll actions are suspended while the company is paused. Resume the company to proceed.",
      nextSteps: ["Go to Company Settings", "Click Resume Company", "Contact admin if needed"],
      blockedActions: ["run_payroll", "send_payments", "approve_transactions", "modify_treasury"],
      createdAt: now,
      dismissed: false,
    });
  }

  if (state.isArchived) {
    warnings.push({
      id: `warn_archived_${Date.now()}`,
      reason: "archived",
      severity: "critical",
      title: "Company is archived",
      message: "This company has been archived. No payroll actions can be performed on archived companies.",
      nextSteps: ["Contact support to restore the company", "Export data before permanent deletion"],
      blockedActions: ["run_payroll", "send_payments", "approve_transactions", "modify_treasury", "edit_employees"],
      createdAt: now,
      dismissed: false,
    });
  }

  if (!state.setupComplete) {
    warnings.push({
      id: `warn_setup_${Date.now()}`,
      reason: "incomplete_setup",
      severity: "warning",
      title: "Company setup incomplete",
      message: "Some required setup steps have not been completed. Complete setup before running payroll.",
      nextSteps: ["Complete company profile", "Verify admin credentials", "Set up department structure"],
      blockedActions: ["run_payroll"],
      createdAt: now,
      dismissed: false,
    });
  }

  if (!state.contractsConfigured) {
    warnings.push({
      id: `warn_contracts_${Date.now()}`,
      reason: "missing_contracts",
      severity: "critical",
      title: "Smart contracts not configured",
      message: "On-chain payroll contracts have not been deployed or configured. Deploy contracts to enable payroll.",
      nextSteps: ["Go to Contract Setup", "Deploy payroll contracts", "Verify contract addresses"],
      blockedActions: ["run_payroll", "send_payments"],
      createdAt: now,
      dismissed: false,
    });
  }

  if (!state.treasuryFunded) {
    warnings.push({
      id: `warn_treasury_${Date.now()}`,
      reason: "treasury_insufficient",
      severity: "warning",
      title: "Treasury has insufficient funds",
      message: "The payroll treasury does not have enough balance to cover the next scheduled payroll.",
      nextSteps: ["Check treasury balance", "Fund the treasury wallet", "Adjust payroll amounts"],
      blockedActions: ["run_payroll"],
      createdAt: now,
      dismissed: false,
    });
  }

  if (!state.complianceClear) {
    warnings.push({
      id: `warn_compliance_${Date.now()}`,
      reason: "compliance_hold",
      severity: "warning",
      title: "Compliance hold active",
      message: "A compliance review is in progress. Payroll actions are temporarily restricted.",
      nextSteps: ["Review compliance requirements", "Submit required documents", "Wait for compliance approval"],
      blockedActions: ["run_payroll", "send_payments"],
      createdAt: now,
      dismissed: false,
    });
  }

  return warnings;
}

const initialState = {
  warnings: [] as CompanyWarning[],
  companyState: { ...defaultCompanyState },
  lastChecked: null as string | null,
};

export const useCompanyWarningsStore = create<CompanyWarningsStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      setCompanyState: (newState) => {
        set((state) => ({
          companyState: { ...state.companyState, ...newState },
        }));
        get().evaluateWarnings();
      },
      evaluateWarnings: () => {
        const { companyState, warnings } = get();
        const newWarnings = generateWarnings(companyState);
        const dismissedIds = new Set(warnings.filter((w) => w.dismissed).map((w) => w.id));
        const merged = newWarnings.map((w) => ({
          ...w,
          dismissed: dismissedIds.has(w.id),
        }));
        set({ warnings: merged, lastChecked: new Date().toISOString() });
      },
      dismissWarning: (id) =>
        set((state) => ({
          warnings: state.warnings.map((w) =>
            w.id === id ? { ...w, dismissed: true } : w
          ),
        })),
      dismissAllWarnings: () =>
        set((state) => ({
          warnings: state.warnings.map((w) => ({ ...w, dismissed: true })),
        })),
      getActiveWarnings: () => get().warnings.filter((w) => !w.dismissed),
      getCriticalWarnings: () =>
        get().warnings.filter((w) => !w.dismissed && w.severity === "critical"),
      hasBlockingWarnings: () => {
        const { companyState } = get();
        return companyState.isPaused || companyState.isArchived || !companyState.contractsConfigured;
      },
      getBlockedActions: () => {
        const active = get().getActiveWarnings();
        const blocked = new Set<string>();
        for (const w of active) {
          for (const action of w.blockedActions) {
            blocked.add(action);
          }
        }
        return Array.from(blocked);
      },
      reset: () => set(initialState),
    }),
    { name: "zk-payroll-company-warnings" }
  )
);
