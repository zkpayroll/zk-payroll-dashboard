"use client";

import { useState, useMemo, useCallback } from "react";
import {
  UserCheck,
  UserX,
  UserMinus,
  AlertTriangle,
  Shield,
  Search,
} from "lucide-react";
import { useEmployeeStore } from "@/stores/employees";
import { useEmployeeLifecycleStore } from "@/stores/employeeLifecycle";
import { MOCK_EMPLOYEES } from "@/lib/api/mockData";
import type { Employee, EmployeeLifecycleStatus, UserRole } from "@/types";
import {
  deriveLifecycleStatus,
  availableLifecycleActions,
  type LifecycleAction,
} from "@/src/lib/employees/lifecycleValidation";
import StatusBadge from "@/components/ui/StatusBadge";

const ACTION_CONFIG: Record<LifecycleAction, { label: string; icon: typeof UserCheck; variant: string; confirm: string }> = {
  activate: {
    label: "Activate",
    icon: UserCheck,
    variant: "bg-green-600 hover:bg-green-700 text-white",
    confirm: "This will make the employee eligible for payroll runs.",
  },
  suspend: {
    label: "Suspend",
    icon: UserMinus,
    variant: "bg-amber-600 hover:bg-amber-700 text-white",
    confirm: "This will temporarily exclude the employee from payroll. They can be reactivated later.",
  },
  offboard: {
    label: "Offboard",
    icon: UserX,
    variant: "bg-red-600 hover:bg-red-700 text-white",
    confirm: "This will permanently remove the employee from payroll. This action cannot be undone.",
  },
};

const LIFECYCLE_BADGE_MAP: Record<EmployeeLifecycleStatus, string> = {
  active: "active",
  suspended: "pending",
  offboarded: "inactive",
};

type FilterStatus = "all" | EmployeeLifecycleStatus;

interface ConfirmationState {
  employee: Employee;
  action: LifecycleAction;
}

export default function EmployeeLifecycleManager() {
  const { employees: stored } = useEmployeeStore();
  const employees = stored.length > 0 ? stored : MOCK_EMPLOYEES;
  const { transitionEmployee, lastError, clearError, events } = useEmployeeLifecycleStore();

  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [note, setNote] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // For demo purposes, admin role is assumed.
  const currentRole: UserRole = "admin";
  const currentUser = "admin@zkpayroll.io";

  const filtered = useMemo(() => {
    let result = employees;
    if (filterStatus !== "all") {
      result = result.filter((e) => deriveLifecycleStatus(e) === filterStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.department ?? "").toLowerCase().includes(q) ||
          (e.email ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [employees, filterStatus, searchQuery]);

  const counts = useMemo(() => {
    const result: Record<FilterStatus, number> = { all: employees.length, active: 0, suspended: 0, offboarded: 0 };
    for (const e of employees) {
      result[deriveLifecycleStatus(e)]++;
    }
    return result;
  }, [employees]);

  const handleAction = useCallback(
    (employee: Employee, action: LifecycleAction) => {
      clearError();
      setSuccessMessage(null);
      setNote("");
      setConfirmation({ employee, action });
    },
    [clearError],
  );

  const handleConfirm = useCallback(() => {
    if (!confirmation) return;
    const result = transitionEmployee(
      confirmation.employee.id,
      confirmation.action,
      currentUser,
      currentRole,
      note || undefined,
    );
    if (result.success) {
      setSuccessMessage(
        `${confirmation.employee.name} has been ${confirmation.action === "activate" ? "activated" : confirmation.action === "suspend" ? "suspended" : "offboarded"} successfully.`,
      );
      setConfirmation(null);
      setNote("");
    }
  }, [confirmation, note, transitionEmployee, currentRole, currentUser]);

  const handleCancel = useCallback(() => {
    setConfirmation(null);
    setNote("");
    clearError();
  }, [clearError]);

  return (
    <section aria-labelledby="lifecycle-heading" className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 id="lifecycle-heading" className="text-lg font-semibold text-gray-900">
              Employee Lifecycle Management
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Activate, suspend, or offboard employees. Changes take effect immediately for payroll eligibility.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-500" aria-hidden="true" />
            <span className="text-xs text-gray-500">Admin only</span>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search by name, department, or email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Search employees"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {(["all", "active", "suspended", "offboarded"] as FilterStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterStatus === s
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s]})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Success / Error messages */}
      {successMessage && (
        <div
          className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          role="status"
          aria-live="polite"
        >
          {successMessage}
        </div>
      )}
      {lastError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            {lastError}
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmation && (
        <div
          className="rounded-lg border-2 border-amber-300 bg-amber-50 p-6 shadow-sm"
          role="alertdialog"
          aria-labelledby="confirm-heading"
          aria-describedby="confirm-desc"
        >
          <h3 id="confirm-heading" className="text-base font-semibold text-gray-900">
            Confirm {ACTION_CONFIG[confirmation.action].label}
          </h3>
          <p id="confirm-desc" className="mt-2 text-sm text-gray-700">
            You are about to <strong>{confirmation.action}</strong>{" "}
            <strong>{confirmation.employee.name}</strong>.{" "}
            {ACTION_CONFIG[confirmation.action].confirm}
          </p>
          <div className="mt-4">
            <label htmlFor="lifecycle-note" className="block text-sm font-medium text-gray-700">
              Note (optional)
            </label>
            <input
              id="lifecycle-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for this change…"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={`rounded-md px-4 py-2 text-sm font-medium ${ACTION_CONFIG[confirmation.action].variant}`}
            >
              {ACTION_CONFIG[confirmation.action].label}
            </button>
          </div>
        </div>
      )}

      {/* Employee list */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No employees match the current filters.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Employee lifecycle management</caption>
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th scope="col" className="px-6 py-3">Employee</th>
                <th scope="col" className="px-6 py-3">Department</th>
                <th scope="col" className="px-6 py-3">Status</th>
                <th scope="col" className="px-6 py-3">Start Date</th>
                <th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((emp) => {
                const lifecycleStatus = deriveLifecycleStatus(emp);
                const actions = availableLifecycleActions(emp, currentRole);
                return (
                  <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{emp.name}</div>
                      {emp.email && <div className="text-xs text-gray-500">{emp.email}</div>}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{emp.department ?? "—"}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={LIFECYCLE_BADGE_MAP[lifecycleStatus]} showIcon={false} />
                      <span className="ml-2 text-xs text-gray-400 capitalize">{lifecycleStatus}</span>
                      {emp.lifecycleNote && (
                        <p className="mt-1 text-[11px] text-gray-400 italic">{emp.lifecycleNote}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(emp.startDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {actions.length === 0 ? (
                          <span className="text-xs text-gray-400">No actions available</span>
                        ) : (
                          actions.map((action) => {
                            const cfg = ACTION_CONFIG[action];
                            const Icon = cfg.icon;
                            return (
                              <button
                                key={action}
                                type="button"
                                onClick={() => handleAction(emp, action)}
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${cfg.variant}`}
                                aria-label={`${cfg.label} ${emp.name}`}
                              >
                                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                                {cfg.label}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t text-xs text-gray-500">
            Showing {filtered.length} of {employees.length} employees
          </div>
        )}
      </div>

      {/* Recent lifecycle events */}
      {events.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-sm font-medium text-gray-900">Recent Lifecycle Changes</h3>
          </div>
          <ul className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
            {events.slice(0, 20).map((evt) => (
              <li key={evt.id} className="px-6 py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="capitalize font-medium text-gray-900">{evt.action}</span>{" "}
                  <span className="text-gray-500">employee {evt.employeeId}</span>
                  {evt.note && <span className="text-gray-400 ml-2">— {evt.note}</span>}
                </div>
                <time className="text-xs text-gray-400" dateTime={evt.performedAt}>
                  {new Date(evt.performedAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
