"use client";

import { useState, useMemo, useEffect } from "react";

import { Users, Loader2, UserPlus, Upload, RotateCcw } from "lucide-react"
import { useEmployeeStore } from "@/stores/employees";
import { MOCK_EMPLOYEES } from "@/lib/api/mockData";
import type { Employee } from "@/types";
import EmptyState from "@/components/ui/EmptyState";
import OnboardingBadge from "./OnboardingBadge";
import { EmployeeDetailDrawer } from "./EmployeeDetail";
import { AddEmployeeModal } from "./AddEmployeeModal";
import StatusBadge from "@/components/ui/StatusBadge";

type StatusFilter = "all" | "active" | "inactive" | "pending";

function deriveStatus(e: Employee): "active" | "inactive" | "pending" {
  // `isActive` determines payroll eligibility. Prefer it over a potentially
  // stale display status so an ineligible employee is never shown as active.
  if (!e.isActive || e.status === "inactive") return "inactive";
  if (e.status === "pending") return "pending";
  if (!e.lastPayment) return "pending";
  return "active";
}



function EmployeeDirectory() {
  const { employees: storedEmployees, isLoading: storeLoading } = useEmployeeStore();
  const retryOnboarding = useEmployeeStore((s) => s.retryOnboarding);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [localLoading, setLocalLoading] = useState(
    process.env.NODE_ENV === 'test' ? false : true
  );

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

  const handleRowClick = (emp: Employee) => {
    setSelectedEmployee(emp);
    setIsDetailOpen(true);
  };

  const handleRetryOnboarding = (emp: Employee) => {
    retryOnboarding(emp.id);
    setSelectedEmployee({ ...emp, onboardingStatus: "in_progress" });
    setIsDetailOpen(true);
  };

  return (
    <section aria-labelledby="employee-directory-heading">
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
                  className={`px-3 py-1 min-h-[44px] rounded-full text-xs font-medium transition-colors ${
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
            <a
              href="/employees/import"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              Import CSV
            </a>
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
                  <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">Onboarding</th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-400 uppercase">Start Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100" aria-hidden="true">
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
                      <div className="h-6 bg-gray-200 rounded-full w-20"></div>
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
                const needsRetry = emp.onboardingStatus !== "completed";
                const retryLabel =
                  emp.onboardingStatus === "in_progress"
                    ? "Retry scheduled"
                    : "Retry onboarding";
                return (
                  <li 
                    key={emp.id} 
                    className="hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    <div className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => handleRowClick(emp)}
                        className="w-full text-left focus:outline-none"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                            {emp.email && (
                              <p className="text-xs text-gray-500 truncate mt-0.5">{emp.email}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {emp.department ?? "—"} · ${emp.salary.toLocaleString()}
                            </p>
                            <div className="mt-2 flex gap-2 flex-wrap">
                              <StatusBadge status={status} showIcon={false} className="px-2 py-0.5 text-[10px]" />
                              <OnboardingBadge status={emp.onboardingStatus} showIcon={false} />
                            </div>
                            {emp.onboardingError && (
                              <p className="mt-2 text-[11px] text-amber-700">
                                Last onboarding failure: {emp.onboardingError}
                              </p>
                            )}
                            <p className="text-[10px] text-gray-400 mt-2">
                              Since {new Date(emp.startDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </button>
                      {needsRetry && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRetryOnboarding(emp);
                          }}
                          disabled={emp.onboardingStatus === "in_progress"}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
                        >
                          <RotateCcw className="w-3 h-3" aria-hidden="true" />
                          {retryLabel}
                        </button>
                      )}
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
                  <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">Onboarding</th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">Start Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100" aria-live="polite">
                {filtered.map((emp) => {
                  const status = deriveStatus(emp);
                  return (
                    <tr 
                      key={emp.id} 
                      className="hover:bg-gray-50 cursor-pointer transition-colors group"
                      onClick={() => handleRowClick(emp)}
                    >
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
                         <StatusBadge status={status} showIcon={false} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <OnboardingBadge status={emp.onboardingStatus} />
                          {emp.onboardingError && (
                            <p className="text-xs text-amber-700">
                              {emp.onboardingError}
                            </p>
                          )}
                          {emp.onboardingStatus !== "completed" && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRetryOnboarding(emp);
                              }}
                              disabled={emp.onboardingStatus === "in_progress"}
                              className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
                            >
                              <RotateCcw className="w-3 h-3" aria-hidden="true" />
                              {emp.onboardingStatus === "in_progress"
                                ? "Retry scheduled"
                                : "Retry onboarding"}
                            </button>
                          )}
                        </div>
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

      <EmployeeDetailDrawer 
        employee={selectedEmployee} 
        isOpen={isDetailOpen} 
        onClose={() => setIsDetailOpen(false)} 
      />
      <AddEmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </section>
  );
}

export default EmployeeDirectory;
