import { create } from 'zustand';
import type {
  Employee,
  EmployeeLifecycleEvent,
  EmployeeLifecycleStatus,
  UserRole,
} from '@/types';
import {
  validateLifecycleTransition,
  deriveLifecycleStatus,
  type LifecycleAction,
} from '@/src/lib/employees/lifecycleValidation';
import { evaluateActivationPrerequisites } from '@/src/payroll/employeeActivationPrerequisites';
import { useEmployeeStore } from './employees';

export interface LifecycleTransitionResult {
  success: boolean;
  error?: string;
}

interface EmployeeLifecycleState {
  /** Audit trail of lifecycle transitions — privacy-safe, no salary data. */
  events: EmployeeLifecycleEvent[];
  isProcessing: boolean;
  lastError: string | null;

  /**
   * Execute a lifecycle transition with full validation.
   * Updates the employee store and records an audit event.
   */
  transitionEmployee: (
    employeeId: string,
    action: LifecycleAction,
    performedBy: string,
    role: UserRole,
    note?: string,
  ) => LifecycleTransitionResult;

  /** Clear the last error. */
  clearError: () => void;
}

function lifecycleStatusFromAction(action: LifecycleAction): EmployeeLifecycleStatus {
  switch (action) {
    case 'activate':
      return 'active';
    case 'suspend':
      return 'suspended';
    case 'offboard':
      return 'offboarded';
    case 'archive':
      return 'archived';
    case 'restore':
      return 'suspended';
  }
}

export const useEmployeeLifecycleStore = create<EmployeeLifecycleState>()(
  (set, get) => ({
    events: [],
    isProcessing: false,
    lastError: null,

    transitionEmployee(employeeId, action, performedBy, role, note) {
      const employeeStore = useEmployeeStore.getState();
      const employee = employeeStore.employees.find((e) => e.id === employeeId);

      if (!employee) {
        const error = 'Employee not found.';
        set({ lastError: error });
        return { success: false, error };
      }

      // Activation has extra prerequisites (#627): the admin must not be able
      // to bring a non-suspended or partially-onboarded employee back onto
      // payroll without resolving the blockers first.
      if (action === 'activate') {
        const activationError = evaluateActivationPrerequisites(employee, role);
        if (activationError) {
          set({ lastError: activationError.message });
          return { success: false, error: activationError.message };
        }
      }

      const validationError = validateLifecycleTransition(employee, action, role);
      if (validationError) {
        set({ lastError: validationError.message });
        return { success: false, error: validationError.message };
      }

      const newStatus = lifecycleStatusFromAction(action);
      const now = new Date().toISOString();

      // Update the employee in the shared store
      const updates: Partial<Employee> = {
        lifecycleStatus: newStatus,
        isActive: newStatus === 'active',
        status: newStatus === 'active' ? 'active' : 'inactive',
        lifecycleNote: note ?? null,
      };

      if (action === 'suspend') {
        updates.suspendedAt = now;
      } else if (action === 'offboard') {
        updates.offboardedAt = now;
        updates.suspendedAt = null;
      } else if (action === 'activate') {
        updates.suspendedAt = null;
      }

      employeeStore.updateEmployee(employeeId, updates);

      // Record the audit event
      const event: EmployeeLifecycleEvent = {
        id: `lce_${Date.now()}_${employeeId}`,
        employeeId,
        action,
        performedBy,
        performedAt: now,
        note,
      };

      set((state) => ({
        events: [event, ...state.events],
        lastError: null,
      }));

      return { success: true };
    },

    clearError() {
      set({ lastError: null });
    },
  }),
);
