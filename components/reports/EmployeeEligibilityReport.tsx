"use client";

import { useMemo, useState } from "react";
import { Users, Filter, FileSpreadsheet } from "lucide-react";
import type { Employee } from "@/types/models";
import {
  buildEmployeeEligibilityReport,
  ELIGIBILITY_STATE_LABELS,
  BLOCKER_TYPE_LABELS,
  type PayrollEligibilityState,
  type EligibilityBlockerType,
} from "@/src/reports/employeeEligibilityReport";

const STATE_BADGE_STYLES: Record<PayrollEligibilityState, string> = {
  eligible: "bg-green-50 text-green-700 border-green-200",
  ineligible: "bg-red-50 text-red-700 border-red-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  blocked: "bg-purple-50 text-purple-700 border-purple-200",
};

export interface EmployeeEligibilityReportProps {
  employees: Employee[];
}

export function EmployeeEligibilityReport({
  employees,
}: EmployeeEligibilityReportProps) {
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [stateFilter, setStateFilter] = useState<PayrollEligibilityState | "">("");
  const [blockerFilter, setBlockerFilter] = useState<EligibilityBlockerType | "">("");

  const report = useMemo(
    () =>
      buildEmployeeEligibilityReport(employees, {
        department: departmentFilter || undefined,
        state: stateFilter || undefined,
        blockerType: blockerFilter || undefined,
      }),
    [employees, departmentFilter, stateFilter, blockerFilter],
  );

  return (
    <div
      data-testid="employee-eligibility-report"
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            Employee Payroll Eligibility Report
          </h2>
          <p className="text-xs text-gray-500 mt-1" data-testid="eligibility-report-summary">
            {report.summaryMessage}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg text-xs text-indigo-700 font-medium">
          <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
          <span>
            {report.filteredCount} / {report.totalEmployees} shown
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 bg-gray-50 p-3 rounded-lg border" role="group" aria-label="Report filters">
        <Filter className="h-4 w-4 text-gray-400 mb-1.5" aria-hidden="true" />
        <div>
          <label htmlFor="eligibility-department-filter" className="block text-xs font-medium text-gray-700 mb-1">
            Department
          </label>
          <select
            id="eligibility-department-filter"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All departments</option>
            {report.departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="eligibility-state-filter" className="block text-xs font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="eligibility-state-filter"
            value={stateFilter}
            onChange={(e) =>
              setStateFilter(e.target.value as PayrollEligibilityState | "")
            }
            className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            {(Object.keys(ELIGIBILITY_STATE_LABELS) as PayrollEligibilityState[]).map(
              (state) => (
                <option key={state} value={state}>
                  {ELIGIBILITY_STATE_LABELS[state]}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label htmlFor="eligibility-blocker-filter" className="block text-xs font-medium text-gray-700 mb-1">
            Blocker Type
          </label>
          <select
            id="eligibility-blocker-filter"
            value={blockerFilter}
            onChange={(e) =>
              setBlockerFilter(e.target.value as EligibilityBlockerType | "")
            }
            className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All blockers</option>
            {(Object.keys(BLOCKER_TYPE_LABELS) as EligibilityBlockerType[]).map(
              (blocker) => (
                <option key={blocker} value={blocker}>
                  {BLOCKER_TYPE_LABELS[blocker]}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      {/* Report Table */}
      {report.rows.length === 0 ? (
        <div
          data-testid="eligibility-report-empty"
          className="text-center py-8 text-xs text-gray-400 border border-dashed rounded-lg"
        >
          {report.isEmptyRoster
            ? "No employees found in the roster."
            : "No employees match the current filters."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Employee</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Department</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {report.rows.map((row) => (
                <tr key={row.employeeId}>
                  <td className="px-3 py-2 font-medium text-gray-900">{row.name}</td>
                  <td className="px-3 py-2 text-gray-600">{row.department}</td>
                  <td className="px-3 py-2">
                    <span
                      data-testid={`eligibility-state-${row.employeeId}`}
                      className={`inline-flex px-2 py-0.5 rounded-full border font-medium ${STATE_BADGE_STYLES[row.state]}`}
                    >
                      {ELIGIBILITY_STATE_LABELS[row.state]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {row.reason}
                    {row.blockerType && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide text-gray-400">
                        ({BLOCKER_TYPE_LABELS[row.blockerType]})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default EmployeeEligibilityReport;
