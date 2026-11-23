import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  PayrollPolicy,
  SettlementWindowPolicy,
  ReserveRulesPolicy,
  ApprovalRequirementsPolicy,
  CapacityLimitsPolicy,
  AuditRetentionPolicy,
  CompiledPolicyResult,
} from "@/types/policy";
import { compilePayrollPolicy } from "@/lib/sdk/payrollPolicyCompiler";

export const DEFAULT_PAYROLL_POLICY: PayrollPolicy = {
  id: "policy_default",
  companyId: "comp_active",
  version: 1,
  updatedAt: "2026-08-20T10:00:00.000Z",
  updatedBy: "System Default",
  timing: {
    settlementWindowHours: 24,
    cutoffLeadTimeHours: 4,
    executionGracePeriodHours: 12,
    autoSettle: false,
  },
  reserves: {
    minReservePercentage: 20,
    minReserveFixedAmount: 25000,
    replenishThresholdPercentage: 15,
    shortfallPolicy: "block",
  },
  approvals: {
    requiredApprovalsCount: 2,
    requireDualApproval: true,
    dualApprovalThreshold: 50000,
    allowSelfApproval: false,
    requireAuditorApproval: true,
  },
  capacity: {
    maxBatchSize: 500,
    maxTotalDisbursement: 500000,
    dailyDisbursementLimit: 1000000,
    maxConsecutiveBatches: 4,
  },
  auditRetention: {
    retentionPeriodDays: 365,
    immutableAuditLog: true,
    requireAuditorExportSignoff: true,
    detailedTelemetry: true,
  },
};

export type PolicySectionTab =
  | "all"
  | "timing"
  | "reserves"
  | "approvals"
  | "capacity"
  | "auditRetention";

interface PayrollPolicyStore {
  policy: PayrollPolicy;
  savedPolicy: PayrollPolicy;
  compilationResult: CompiledPolicyResult;
  isSaving: boolean;
  saveSuccess: boolean;
  saveError: string | null;
  activeTab: PolicySectionTab;

  setPolicy: (policy: PayrollPolicy) => void;
  updateTiming: (updates: Partial<SettlementWindowPolicy>) => void;
  updateReserves: (updates: Partial<ReserveRulesPolicy>) => void;
  updateApprovals: (updates: Partial<ApprovalRequirementsPolicy>) => void;
  updateCapacity: (updates: Partial<CapacityLimitsPolicy>) => void;
  updateAuditRetention: (updates: Partial<AuditRetentionPolicy>) => void;
  setActiveTab: (tab: PolicySectionTab) => void;
  compile: () => CompiledPolicyResult;
  savePolicy: (savedBy?: string) => Promise<boolean>;
  resetToSaved: () => void;
  resetToDefaults: () => void;
  clearSaveStatus: () => void;
}

const initialSaved = { ...DEFAULT_PAYROLL_POLICY };
const initialPolicy = { ...DEFAULT_PAYROLL_POLICY };
const initialCompilation = compilePayrollPolicy(initialPolicy);

export const usePayrollPolicyStore = create<PayrollPolicyStore>()(
  persist(
    (set, get) => ({
      policy: initialPolicy,
      savedPolicy: initialSaved,
      compilationResult: initialCompilation,
      isSaving: false,
      saveSuccess: false,
      saveError: null,
      activeTab: "all",

      setPolicy: (newPolicy) => {
        const compilation = compilePayrollPolicy(newPolicy);
        set({
          policy: newPolicy,
          compilationResult: compilation,
          saveSuccess: false,
          saveError: null,
        });
      },

      updateTiming: (updates) => {
        const current = get().policy;
        const updated: PayrollPolicy = {
          ...current,
          timing: { ...current.timing, ...updates },
        };
        const compilation = compilePayrollPolicy(updated);
        set({
          policy: updated,
          compilationResult: compilation,
          saveSuccess: false,
          saveError: null,
        });
      },

      updateReserves: (updates) => {
        const current = get().policy;
        const updated: PayrollPolicy = {
          ...current,
          reserves: { ...current.reserves, ...updates },
        };
        const compilation = compilePayrollPolicy(updated);
        set({
          policy: updated,
          compilationResult: compilation,
          saveSuccess: false,
          saveError: null,
        });
      },

      updateApprovals: (updates) => {
        const current = get().policy;
        const updated: PayrollPolicy = {
          ...current,
          approvals: { ...current.approvals, ...updates },
        };
        const compilation = compilePayrollPolicy(updated);
        set({
          policy: updated,
          compilationResult: compilation,
          saveSuccess: false,
          saveError: null,
        });
      },

      updateCapacity: (updates) => {
        const current = get().policy;
        const updated: PayrollPolicy = {
          ...current,
          capacity: { ...current.capacity, ...updates },
        };
        const compilation = compilePayrollPolicy(updated);
        set({
          policy: updated,
          compilationResult: compilation,
          saveSuccess: false,
          saveError: null,
        });
      },

      updateAuditRetention: (updates) => {
        const current = get().policy;
        const updated: PayrollPolicy = {
          ...current,
          auditRetention: { ...current.auditRetention, ...updates },
        };
        const compilation = compilePayrollPolicy(updated);
        set({
          policy: updated,
          compilationResult: compilation,
          saveSuccess: false,
          saveError: null,
        });
      },

      setActiveTab: (tab) => set({ activeTab: tab }),

      compile: () => {
        const compilation = compilePayrollPolicy(get().policy);
        set({ compilationResult: compilation });
        return compilation;
      },

      savePolicy: async (savedBy = "Admin") => {
        set({ isSaving: true, saveError: null, saveSuccess: false });
        const compilation = compilePayrollPolicy(get().policy);
        set({ compilationResult: compilation });

        // Enforce Acceptance Criteria: Invalid policy cannot be submitted.
        if (!compilation.isValid) {
          const errorCount = compilation.summary.errorsCount;
          set({
            isSaving: false,
            saveSuccess: false,
            saveError: `Cannot save policy: ${errorCount} critical validation error${errorCount !== 1 ? "s" : ""} must be resolved first.`,
          });
          return false;
        }

        // Simulate save delay
        await new Promise((resolve) => setTimeout(resolve, 300));

        const updatedSaved: PayrollPolicy = {
          ...get().policy,
          version: get().savedPolicy.version + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: savedBy,
        };

        const recompiled = compilePayrollPolicy(updatedSaved);

        set({
          policy: updatedSaved,
          savedPolicy: updatedSaved,
          compilationResult: recompiled,
          isSaving: false,
          saveSuccess: true,
          saveError: null,
        });
        return true;
      },

      resetToSaved: () => {
        const saved = get().savedPolicy;
        const recompiled = compilePayrollPolicy(saved);
        set({
          policy: { ...saved },
          compilationResult: recompiled,
          saveSuccess: false,
          saveError: null,
        });
      },

      resetToDefaults: () => {
        const def = JSON.parse(JSON.stringify(DEFAULT_PAYROLL_POLICY));
        const recompiled = compilePayrollPolicy(def);
        set({
          policy: def,
          savedPolicy: JSON.parse(JSON.stringify(DEFAULT_PAYROLL_POLICY)),
          compilationResult: recompiled,
          saveSuccess: false,
          saveError: null,
        });
      },


      clearSaveStatus: () => set({ saveSuccess: false, saveError: null }),
    }),
    {
      name: "zk-payroll-policy",
      partialize: (state) => ({
        policy: state.policy,
        savedPolicy: state.savedPolicy,
      }),
    }
  )
);
