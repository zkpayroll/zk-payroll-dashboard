"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Users,
  UserPlus,
  Upload,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
} from "lucide-react";

import { Users, Loader2, UserPlus, Upload, RotateCcw, UserCheck } from "lucide-react"
import { useEmployeeStore } from "@/stores/employees";
import { MOCK_EMPLOYEES } from "@/lib/api/mockData";
import type { Employee } from "@/types";
import EmptyState from "@/components/ui/EmptyState";
import OnboardingBadge from "./OnboardingBadge";
import { EmployeeDetailDrawer } from "./EmployeeDetail";
import { AddEmployeeModal } from "./AddEmployeeModal";
import StatusBadge from "@/components/ui/StatusBadge";

export type StatusFilter = "all" | "active" | "inactive" | "pending";
export type EmployeeSortField = "name" | "department" | "salary" | "status" | "startDate";
export type SortDirection = "asc" | "desc";

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
  const [sortField, setSortField] = useState<EmployeeSortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [localLoading, setLocalLoading] = useState(
    process.env.NODE_ENV === "test" ? false : true,
  );

  useEffect(() => {
    const t = setTimeout(() => setLocalLoading(false), 850);
    return () => clearTimeout(t);
  }, []);

  const isLoading = storeLoading || localLoading;

  const employees = storedEmployees.length > 0 ? storedEmployees : MOCK_EMPLOYEES;

  const counts = useMemo(() => {
    const result = { active: 0, inactive: 0, pending: 0 };
    for (const e of employees) {
      result[deriveStatus(e)]++;
    }
    return result;
  }, [employees]);

  const filtered = useMemo(() => {
    let result = employees;
    if (statusFilter !== "all") {
      result = result.filter((e) => deriveStatus(e) === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.email && e.email.toLowerCase().includes(q)) ||
          (e.department && e.department.toLowerCase().includes(q)),
      );
    }

    return [...result].sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "department") {
        comparison = (a.department ?? "").localeCompare(b.department ?? "");
      } else if (sortField === "salary") {
        comparison = a.salary - b.salary;
      } else if (sortField === "status") {
        comparison = deriveStatus(a).localeCompare(deriveStatus(b));
      } else if (sortField === "startDate") {
        comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [employees, statusFilter, searchQuery, sortField, sortDirection]);

  const handleSort = (field: EmployeeSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

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
        {/* Main Header */}
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 min-h-[44px]"
            >
              <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
              Add Employee
            </button>
            <a
              href="/employees/lifecycle"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            >
              <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
              Lifecycle
            </a>
            <a
              href="/employees/import"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 min-h-[44px]"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              Import CSV
            </a>
          </div>
        </div>

        {/* Responsive Table Controls for search, sorting & density on all screens (#463) */}
        <div
          className="px-4 sm:px-6 py-3 bg-gray-50 border-b flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
          data-testid="employee-table-controls"
        >
          <div className="relative flex-1 max-w-sm">
            <label htmlFor="employee-search-input" className="sr-only">
              Search employees
            </label>
            <div className="relative">
              <Search
                className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                id="employee-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, department, email..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-md text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[38px]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="employee-sort-select" className="text-xs text-gray-500 whitespace-nowrap">
              Sort by:
            </label>
            <select
              id="employee-sort-select"
              aria-label="Sort employees by"
              value={`${sortField}-${sortDirection}`}
              onChange={(e) => {
                const parts = e.target.value.split("-");
                setSortField(parts[0] as EmployeeSortField);
                setSortDirection(parts[1] as SortDirection);
              }}
              className="bg-white border border-gray-200 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[38px]"
              data-testid="employee-sort-select"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="department-asc">Department (A-Z)</option>
              <option value="department-desc">Department (Z-A)</option>
              <option value="salary-asc">Salary (Low to High)</option>
              <option value="salary-desc">Salary (High to Low)</option>
              <option value="startDate-desc">Start Date (Newest)</option>
              <option value="startDate-asc">Start Date (Oldest)</option>
              <option value="status-asc">Status</option>
            </select>

            <button
              type="button"
              onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
              aria-label={`Sort direction ${sortDirection === "asc" ? "ascending" : "descending"}`}
              className="p-1.5 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 min-h-[38px] min-w-[38px] flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              data-testid="employee-sort-direction-btn"
            >
              {sortDirection === "asc" ? (
                <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
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
              searchQuery
                ? `No employees matched "${searchQuery}".`
                : statusFilter === "all"
                  ? "Add employees to get started with payroll."
                  : `There are no employees with ${statusFilter} status.`
            }
            action={
              searchQuery
                ? { label: "Clear search filter", onClick: () => setSearchQuery("") }
                : statusFilter !== "all"
                  ? { label: "View all employees", onClick: () => setStatusFilter("all") }
                  : undefined
            }
          />
        ) : (
          <>
            {/* Mobile card list with responsive controls (#463) */}
            <ul
              className="md:hidden divide-y divide-gray-100"
              aria-label="Employee directory"
              aria-live="polite"
              data-testid="employee-mobile-cards"
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
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleRowClick(emp)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleRowClick(emp);
                          }
                        }}
                        className="w-full text-left focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded cursor-pointer"
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
                      </div>

                      {/* Mobile Action Controls */}
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => handleRowClick(emp)}
                          className="inline-flex items-center justify-center min-h-[44px] px-3 text-xs font-medium text-indigo-600 hover:text-indigo-800 focus:outline-none"
                          aria-label={`View details for ${emp.name}`}
                        >
                          View details
                        </button>
                        {needsRetry && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRetryOnboarding(emp);
                            }}
                            disabled={emp.onboardingStatus === "in_progress"}
                            className="inline-flex items-center gap-1.5 min-h-[44px] rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                            {retryLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Desktop table with accessible header sort buttons (#463) */}
            <table className="hidden md:table w-full text-left">
              <caption className="sr-only">Employee directory</caption>
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    aria-sort={sortField === "name" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("name")}
                      className="inline-flex items-center gap-1 hover:text-gray-900 focus:outline-none"
                    >
                      <span>Name</span>
                      {sortField === "name" ? (
                        sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-60" />
                      )}
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={sortField === "department" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("department")}
                      className="inline-flex items-center gap-1 hover:text-gray-900 focus:outline-none"
                    >
                      <span>Department</span>
                      {sortField === "department" ? (
                        sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-60" />
                      )}
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={sortField === "salary" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("salary")}
                      className="inline-flex items-center gap-1 hover:text-gray-900 focus:outline-none"
                    >
                      <span>Salary</span>
                      {sortField === "salary" ? (
                        sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-60" />
                      )}
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={sortField === "status" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("status")}
                      className="inline-flex items-center gap-1 hover:text-gray-900 focus:outline-none"
                    >
                      <span>Status</span>
                      {sortField === "status" ? (
                        sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-60" />
                      )}
                    </button>
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">Onboarding</th>
                  <th
                    scope="col"
                    aria-sort={sortField === "startDate" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("startDate")}
                      className="inline-flex items-center gap-1 hover:text-gray-900 focus:outline-none"
                    >
                      <span>Start Date</span>
                      {sortField === "startDate" ? (
                        sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-60" />
                      )}
                    </button>
                  </th>
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
