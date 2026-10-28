import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Employee } from '@/types';
import type { CommitmentChangeKind } from '@/lib/employees/commitmentReplacementReview';

/**
 * Audit record for a confirmed employee commitment replacement (#757).
 * Never stores the raw salary number — only hash/address previews, already
 * truncated by `reviewCommitmentReplacement`.
 */
export interface CommitmentReplacementLogEntry {
  id: string;
  employeeId: string;
  changeKind: CommitmentChangeKind;
  previousCommitmentPreview: string;
  nextCommitmentPreview: string;
  confirmedAt: string;
  confirmedBy?: string;
}

interface EmployeeState {
  employees: Employee[];
  isLoading: boolean;
  commitmentReplacementLog: CommitmentReplacementLogEntry[];
  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  /**
   * Apply a reviewed and confirmed commitment/wallet replacement and record
   * it in `commitmentReplacementLog`. Callers must obtain a successful
   * `reviewCommitmentReplacement()` result first — this method does not
   * re-validate, it only applies and logs an already-confirmed change.
   */
  confirmCommitmentReplacement: (
    entry: Omit<CommitmentReplacementLogEntry, "id" | "confirmedAt">,
    updates: Partial<Pick<Employee, "salaryCommitment" | "address">>,
  ) => void;
  removeEmployee: (id: string) => void;
  retryOnboarding: (id: string, reason?: string) => void;
  setEmployees: (employees: Employee[]) => void;
  setLoading: (loading: boolean) => void;
}

let logCounter = 0;
function generateLogId(): string {
  logCounter += 1;
  return `cre_${Date.now()}_${logCounter}`;
}

export const useEmployeeStore = create<EmployeeState>()(
  persist(
    (set) => ({
      employees: [],
      isLoading: false,
      commitmentReplacementLog: [],

      addEmployee: (employee) =>
        set((state) => ({
          employees: [...state.employees, employee],
        })),

      updateEmployee: (id, updates) =>
        set((state) => ({
          employees: state.employees.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        })),

      confirmCommitmentReplacement: (entry, updates) =>
        set((state) => ({
          employees: state.employees.map((e) =>
            e.id === entry.employeeId ? { ...e, ...updates } : e
          ),
          commitmentReplacementLog: [
            ...state.commitmentReplacementLog,
            {
              ...entry,
              id: generateLogId(),
              confirmedAt: new Date().toISOString(),
            },
          ],
        })),

      removeEmployee: (id) =>
        set((state) => ({
          employees: state.employees.filter((e) => e.id !== id),
        })),

      retryOnboarding: (id, reason) =>
        set((state) => ({
          employees: state.employees.map((employee) =>
            employee.id === id
              ? {
                  ...employee,
                  onboardingStatus: "in_progress" as const,
                  onboardingRetryCount: (employee.onboardingRetryCount ?? 0) + 1,
                  onboardingError: reason ?? null,
                  lastOnboardingAttemptAt: new Date().toISOString(),
                }
              : employee,
          ),
        })),

      setEmployees: (employees) => set({ employees }),
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    { name: 'zk-payroll-employees' }
  )
);
