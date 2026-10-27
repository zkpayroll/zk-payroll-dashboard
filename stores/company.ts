import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Company, UserRole } from '@/types';
import { evaluateCompanySwitch, type CompanySwitchGuardResult } from '@/lib/company/companySwitchGuard';
import {
  refreshEmployerRoleBeforeSubmission,
  type EmployerRoleRefreshResult,
  type EmployerRoleSnapshot,
} from '@/lib/company/employerRoleRefresh';

interface CompanyState {
  company: Company | null;
  lastRoleSnapshot: EmployerRoleSnapshot | null;
  isLoading: boolean;
  setCompany: (company: Company) => void;
  clearCompany: () => void;
  /**
   * Attempt to switch the active company, validating the target company
   * and the caller's role/wallet against `evaluateCompanySwitch` first.
   * Returns the guard result; `company` is only updated when `allowed`.
   */
  switchCompany: (
    target: Company,
    currentRole: UserRole,
    currentPublicKey?: string | null,
  ) => CompanySwitchGuardResult;
  /**
   * Refresh live employer role and company admin ownership before payroll
   * submission (#856). Updates the active company when valid or clears stale
   * state when permissions were revoked.
   */
  refreshRoleBeforeSubmission: (options: {
    cachedRole: UserRole | null;
    currentPublicKey?: string | null;
    fetchLatestState: () => Promise<{
      company: Company | null;
      role: UserRole | null;
      refreshedAt?: string;
    }>;
  }) => Promise<EmployerRoleRefreshResult>;
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set, get) => ({
      company: null,
      lastRoleSnapshot: null,
      isLoading: false,
      setCompany: (company) => set({ company }),
      clearCompany: () => set({ company: null, lastRoleSnapshot: null }),
      switchCompany: (target, currentRole, currentPublicKey) => {
        const result = evaluateCompanySwitch(target, currentRole, currentPublicKey);
        if (result.allowed) {
          set({
            company: target,
            lastRoleSnapshot: {
              company: target,
              role: currentRole,
              refreshedAt: new Date().toISOString(),
            },
          });
        }
        return result;
      },
      refreshRoleBeforeSubmission: async ({
        cachedRole,
        currentPublicKey,
        fetchLatestState,
      }) => {
        set({ isLoading: true });
        try {
          const result = await refreshEmployerRoleBeforeSubmission({
            cachedCompany: get().company,
            cachedRole,
            currentPublicKey,
            fetchLatestState,
          });
          if (result.snapshot) {
            set({
              company: result.snapshot.company,
              lastRoleSnapshot: result.snapshot,
            });
          }
          return result;
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    { name: 'zk-payroll-company' }
  )
);
