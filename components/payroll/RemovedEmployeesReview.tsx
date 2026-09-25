"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  UserX,
  Undo2,
  AlertCircle,
  Shield,
  Edit3,
  CheckCircle2,
  EyeOff,
  Info,
  Clock,
} from "lucide-react";
import {
  RemovedEmployeeRecord,
  formatShortWallet,
} from "@/lib/payroll/removedEmployees";

export interface RemovedEmployeesReviewProps {
  removedEmployees?: RemovedEmployeeRecord[];
  onUndo?: (employeeId: string) => void;
  onEdit?: () => void;
  isLocked?: boolean;
  className?: string;
}

export function RemovedEmployeesReview({
  removedEmployees = [],
  onUndo,
  onEdit,
  isLocked = false,
  className = "",
}: RemovedEmployeesReviewProps) {
  const [restoredIds, setRestoredIds] = useState<Set<string>>(new Set());

  const handleUndoClick = (employeeId: string) => {
    setRestoredIds((prev) => new Set(prev).add(employeeId));
    if (onUndo) {
      onUndo(employeeId);
    }
  };

  const activeRemovals = removedEmployees.filter((e) => !restoredIds.has(e.id));

  return (
    <div
      data-testid="removed-employees-review"
      className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
            <UserX className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900">
                Draft Removals Review
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                {activeRemovals.length} excluded
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Review employees excluded from this draft prior to payroll lock
            </p>
          </div>
        </div>

        {onEdit && !isLocked && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Draft
          </button>
        )}
      </div>

      {/* Explanatory Banner */}
      <div className="bg-amber-50/80 border-b border-amber-100 px-6 py-3 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <span className="font-semibold">Draft-Stage Removals: </span>
          The employees listed below will be excluded from the upcoming payroll run. Removals only apply to this draft and can be safely restored before finalizing and locking the payroll batch.
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeRemovals.length === 0 ? (
          <div
            data-testid="removed-employees-empty"
            className="py-8 text-center space-y-2"
          >
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-700">
              No employees removed from this draft.
            </p>
            <p className="text-xs text-gray-400">
              All active employees in this company will be included in the locked payroll.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">
                List of employees removed from draft payroll
              </caption>
              <thead className="bg-gray-50 border-y border-gray-100">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-gray-600 uppercase">
                    Employee
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-gray-600 uppercase">
                    Department
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-gray-600 uppercase">
                    Wallet Address
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-gray-600 uppercase">
                    Salary Privacy
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-gray-600 uppercase">
                    Reason
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-xs font-medium text-gray-600 uppercase text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeRemovals.map((employee) => (
                  <tr
                    key={employee.id}
                    data-testid={`removed-employee-row-${employee.id}`}
                    className="hover:bg-gray-50/60 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm text-gray-900">
                        {employee.name}
                      </div>
                      <div className="text-xs font-mono text-gray-400">
                        ID: {employee.id}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {employee.department || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {formatShortWallet(employee.walletAddress)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500 font-medium">
                        <EyeOff className="w-3 h-3 text-gray-400" aria-hidden="true" />
                        [REDACTED]
                      </span>
                      {employee.salaryCommitment && (
                        <div className="text-[10px] font-mono text-gray-400 mt-0.5">
                          Commitment: {employee.salaryCommitment.slice(0, 10)}…
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                        {employee.removalReason || "Excluded from draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isLocked ? (
                        <span className="text-xs text-gray-400 italic">
                          Locked
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUndoClick(employee.id)}
                          data-testid={`undo-removal-btn-${employee.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                        >
                          <Undo2 className="w-3 h-3" />
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>Zero-Knowledge: Compensation details remain strictly private and redacted during draft review.</span>
        </span>
        {onEdit && (
          <Link
            href="/payroll/execute"
            className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            Go to draft wizard &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}

export default RemovedEmployeesReview;
