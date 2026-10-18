import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole } from "@/types";
import {
  trackConfiguration,
  validateConfigurationUpdate,
  type CompanyConfiguration,
  type ConfigurationTrackingState,
  type ConfigurationUpdateResult,
} from "@/lib/company/configurationRevision";
import {
  evaluateCompanySwitch,
  type CompanySwitchGuardResult,
} from "@/lib/company/companySwitchGuard";

interface CompanyState extends ConfigurationTrackingState {
  company: CompanyConfiguration | null;
  isLoading: boolean;
  setCompany: (company: CompanyConfiguration) => void;
  /** Local optimistic concurrency only; not server-side authorization. */
  updateConfiguration: (
    company: CompanyConfiguration,
    expectedRevision: number,
  ) => ConfigurationUpdateResult;
  clearCompany: () => void;
  /**
   * Attempt to switch the active company, validating the target company
   * and the caller's role/wallet against `evaluateCompanySwitch` first.
   * Returns the guard result; `company` is only updated when `allowed`.
   */
  switchCompany: (
    target: CompanyConfiguration,
    currentRole: UserRole,
    currentPublicKey?: string | null,
  ) => CompanySwitchGuardResult;
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set, get) => ({
      company: null,
      isLoading: false,
      configurationSnapshots: {},
      configurationRevisions: {},
      setCompany: (company) =>
        set((state) => ({ ...trackConfiguration(state, company), company })),
      updateConfiguration: (company, expectedRevision) => {
        const state = get();
        if (!company || state.company?.id !== company.id)
          return {
            ok: false,
            code: "conflict",
            message:
              "The active company changed. Reload its configuration before saving.",
          };
        const history = Object.hasOwn(state.configurationRevisions, company.id)
          ? state.configurationRevisions[company.id]
          : [];
        const version = history[0]?.version ?? 0;
        if (
          !Number.isSafeInteger(expectedRevision) ||
          expectedRevision !== version
        )
          return {
            ok: false,
            code: "conflict",
            message: `Configuration is now at revision ${version}. Reload and review your changes before saving.`,
          };
        const validation = validateConfigurationUpdate(company);
        if (!validation.success)
          return {
            ok: false,
            code: "invalid",
            message: validation.error.issues
              .map(
                (issue) =>
                  `${issue.path.join(".") || "configuration"}: ${issue.message}`,
              )
              .join(" "),
          };
        const next = trackConfiguration(state, validation.data);
        set({
          ...next,
          company: {
            ...validation.data,
            employeeCount: state.company.employeeCount,
          },
        });
        return {
          ok: true,
          version: next.configurationRevisions[company.id][0].version,
        };
      },
      clearCompany: () => set({ company: null }),
      switchCompany: (target, currentRole, currentPublicKey) => {
        const result = evaluateCompanySwitch(
          target,
          currentRole,
          currentPublicKey,
        );
        if (result.allowed) {
          set((state) => ({
            ...(Object.hasOwn(state.configurationSnapshots, target.id)
              ? {}
              : trackConfiguration(state, target)),
            company: target,
          }));
        }
        return result;
      },
    }),
    { name: "zk-payroll-company" },
  ),
);
