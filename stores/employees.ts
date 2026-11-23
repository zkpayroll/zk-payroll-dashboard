import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Employee } from '@/types';
import type { CommitmentChangeKind } from '@/lib/employees/commitmentReplacementReview';
import {
  buildCommitmentVersionHistory,
  reviewCommitmentVersionRecovery,
} from '@/lib/employees/salaryCommitmentVersionRecovery';
import type { CommitmentRecoveryResult } from '@/lib/employees/salaryCommitmentVersionRecovery';

/**
 * Audit record for a confirmed employee commitment replacement or recovery (#757, #900, #962).
 * Never stores the raw salary number — only hash/address previews, already
 * truncated by `reviewCommitmentReplacement` or `reviewCommitmentVersionRecovery`.
 */
export interface CommitmentReplacementLogEntry {
  id: string;
  employeeId: string;
  changeKind: CommitmentChangeKind;
  previousCommitmentPreview: string;
  nextCommitmentPreview: string;
  confirmedAt: string;
  confirmedBy?: string;
  version?: number;
  previousCommitment?: string;
  nextCommitment?: string;
  previousAddress?: string;
  nextAddress?: string;
  isRecovery?: boolean;
  restoredFromVersion?: number;
  recoveryReason?: string;
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
  /**
   * Recovers/restores a superseded salary commitment version for an employee
   * through the review gate, updating the employee record and appending an
   * immutable audit event.
   */
  recoverCommitmentVersion: (
    employeeId: string,
    targetVersion: number,
    confirmedBy?: string,
    recoveryReason?: string,
  ) => CommitmentRecoveryResult;
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
    (set, get) => ({
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
        set((state) => {
          const currentEmployee = state.employees.find((e) => e.id === entry.employeeId);
          const employeeLogs = state.commitmentReplacementLog.filter((e) => e.employeeId === entry.employeeId);
          const calculatedVersion = entry.version ?? employeeLogs.length + 2;

          const updatedEmployees = state.employees.map((e) =>
            e.id === entry.employeeId ? { ...e, ...updates } : e
          );

          const newEntry: CommitmentReplacementLogEntry = {
            ...entry,
            id: generateLogId(),
            confirmedAt: new Date().toISOString(),
            version: calculatedVersion,
            previousCommitment: entry.previousCommitment ?? currentEmployee?.salaryCommitment,
            nextCommitment: updates.salaryCommitment ?? entry.nextCommitment ?? currentEmployee?.salaryCommitment,
            previousAddress: entry.previousAddress ?? currentEmployee?.address,
            nextAddress: updates.address ?? entry.nextAddress ?? currentEmployee?.address,
          };

          return {
            employees: updatedEmployees,
            commitmentReplacementLog: [...state.commitmentReplacementLog, newEntry],
          };
        }),

      recoverCommitmentVersion: (employeeId, targetVersion, confirmedBy, recoveryReason) => {
        const state = get();
        const employee = state.employees.find((e) => e.id === employeeId);

        if (!employee) {
          return {
            ok: false,
            error: {
              code: "EMPLOYEE_NOT_FOUND",
              message: "The employee record could not be found. Refresh and try again.",
              suggestedAction: "Select an employee from the employee directory.",
            },
          };
        }

        const history = buildCommitmentVersionHistory(employee, state.commitmentReplacementLog);
        const result = reviewCommitmentVersionRecovery({
          employee,
          targetVersion,
          versionHistory: history,
          confirmedBy,
          recoveryReason,
        });

        if (!result.ok) {
          return result;
        }

        const review = result.review;

        set((s) => ({
          employees: s.employees.map((e) =>
            e.id === employeeId
              ? {
                  ...e,
                  salaryCommitment: review.targetCommitment,
                  ...(review.walletChanged && review.targetAddress ? { address: review.targetAddress } : {}),
                }
              : e
          ),
          commitmentReplacementLog: [
            ...s.commitmentReplacementLog,
            {
              id: generateLogId(),
              employeeId,
              changeKind: review.walletChanged ? "commitment_and_wallet" : "commitment_only",
              previousCommitmentPreview: review.currentCommitmentPreview,
              nextCommitmentPreview: review.recoveredCommitmentPreview,
              previousCommitment: employee.salaryCommitment,
              nextCommitment: review.targetCommitment,
              previousAddress: employee.address,
              nextAddress: review.walletChanged ? review.targetAddress : employee.address,
              confirmedAt: new Date().toISOString(),
              confirmedBy: confirmedBy || "Operator",
              version: review.nextVersion,
              isRecovery: true,
              restoredFromVersion: targetVersion,
              recoveryReason,
            },
          ],
        }));

        return result;
      },

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
