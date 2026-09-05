import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Company, UserRole } from '@/types';
import { evaluateCompanySwitch, type CompanySwitchGuardResult } from '@/lib/company/companySwitchGuard';

interface CompanyState {
  company: Company | null;
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
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set) => ({
      company: null,
      isLoading: false,
      setCompany: (company) => set({ company }),
      clearCompany: () => set({ company: null }),
      switchCompany: (target, currentRole, currentPublicKey) => {
        const result = evaluateCompanySwitch(target, currentRole, currentPublicKey);
        if (result.allowed) {
          set({ company: target });
        }
        return result;
      },
    }),
    { name: 'zk-payroll-company' }
  )
);
