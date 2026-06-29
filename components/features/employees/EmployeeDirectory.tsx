"use client";

import { useState, useMemo, useEffect } from "react";

import { Users, Loader2, UserPlus } from "lucide-react";
import { useEmployeeStore } from "@/stores/employees";
import { MOCK_EMPLOYEES } from "@/lib/api/mockData";
import type { Employee } from "@/types";
import EmptyState from "@/components/ui/EmptyState";
import { AddEmployeeModal } from "./AddEmployeeModal";
import { EditEmployeeModal } from "./EditEmployeeModal";
import { OnboardingChecklist } from "./OnboardingChecklist";

type StatusFilter = "all" | "active" | "inactive" | "pending";

function deriveStatus(e: Employee): "active" | "inactive" | "pending" {
  if (e.status) return e.status;
  if (!e.isActive) return "inactive";
  if (!e.lastPayment) return "pending";
  return "active";
}

const STATUS_BADGE: Record<"active" | "inactive" | "pending", string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-800",
};

function EmployeeDirectory() {
  const { employees: storedEmployees, isLoading: storeLoading } = useEmployeeStore();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fixingEmployeeId, setFixingEmployeeId] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLocalLoading(false), 850);
    return () => clearTimeout(t);
  }, []);

  const isLoading = storeLoading || localLoading;

  const employees = storedEmployees.length > 0 ? storedEmployees : MOCK_EMPLOYEES;

  const filtered = useMemo(() => {
    if (statusFilter === "all") return employees;
    return employees.filter((e) => deriveStatus(e) === statusFilter);
  }, [employees, statusFilter]);

  const counts = useMemo(() => {
    const result = { active: 0, inactive: 0, pending: 0 };
    for (const e of employees) {
      result[deriveStatus(e)]++;
    }
    return result;
  }, [employees]);

  return (
    <section aria-labelledby="employee-directory-heading" className="space-y-6">
      <OnboardingChecklist onFixEmployee={(id) => setFixingEmployeeId(id)} />
      
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3
            id="employee-directory-heading"
            className="text-lg font-medium text-gray-900"
          >
            Employee Directory
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {(["all", "active", "inactive", "pending"] as StatusFilter[]).map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s === "all"
                    ? `All (${employees.length})`
                    : `${s.charAt(0).toUpperCase() + s.slice(1)} (${counts[s]})`}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            >
              <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
              Add Employee
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="animate-pulse" role="status" aria-label="Loading employees">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">Name</th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">Department</th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">Salary</th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">Start Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[1, 2, 3, 4, 5].map((idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-28 mb-2"></div>
                      <div className="h-3 bg-gray-100 rounded w-36"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-20"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 bg-gray-200 rounded-full w-14"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            screen={statusFilter === "all" ? "employees" : "employees-filtered"}
            icon={Users}
            title={statusFilter === "all" ? "No employees yet" : `No ${statusFilter} employees`}
            description={
              statusFilter === "all"
                ? "Add employees to get started with payroll."
                : `There are no employees with ${statusFilter} status.`
            }
            action={
              statusFilter !== "all"
                ? { label: "View all employees", onClick: () => setStatusFilter("all") }
                : undefined
            }
          />
        ) : (
          <>
            {/* Mobile card list */}
            <ul
              className="md:hidden divide-y divide-gray-100"
              aria-label="Employee directory"
              aria-live="polite"
            >
              {filtered.map((emp) => {
                const status = deriveStatus(emp);
                return (
                  <li key={emp.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                        {emp.email && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{emp.email}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {emp.department ?? "—"} · ${emp.salary.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Since {new Date(emp.startDate).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 px-2 py-1 text-xs font-medium rounded-full ${STATUS_BADGE[status]}`}
                      >
                        {status}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Desktop table */}
            <table className="hidden md:table w-full text-left">
              <caption className="sr-only">Employee directory</caption>
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">Name</th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">Department</th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">Salary</th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">Status</th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">Start Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100" aria-live="polite">
                {filtered.map((emp) => {
                  const status = deriveStatus(emp);
                  return (
                    <tr key={emp.id}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                        {emp.email && (
                          <div className="text-xs text-gray-500">{emp.email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{emp.department ?? "—"}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        ${emp.salary.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_BADGE[status]}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(emp.startDate).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="px-4 sm:px-6 py-3 border-t text-xs text-gray-500">
            Showing {filtered.length} of {employees.length} employees
          </div>
        )}
      </div>

      <AddEmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <EditEmployeeModal
        isOpen={fixingEmployeeId !== null}
        onClose={() => setFixingEmployeeId(null)}
        employeeId={fixingEmployeeId}
      />
    </section>
  );
}

export default EmployeeDirectory;
