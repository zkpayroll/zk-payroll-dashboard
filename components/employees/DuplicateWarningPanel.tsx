"use client";

import { AlertTriangle } from "lucide-react";
import type { Employee } from "@/types/models";
import {
  findDuplicateEmployeeWarnings,
  type DuplicateWarningGroup,
} from "@/lib/duplicateDetection";

interface DuplicateWarningPanelProps {
  employees: Employee[];
}

function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function guidanceFor(group: DuplicateWarningGroup): string {
  if (group.kind === "id") {
    return "The same employee was added to this draft more than once. Remove the duplicate row before continuing.";
  }
  return "These employee records share the same wallet address. If this is intentional, no action is needed — otherwise, correct the wallet address on one of them before continuing.";
}

/**
 * Warns about duplicate employee ids or wallet addresses in a payroll draft
 * before the user submits it (issue #366). Renders nothing when the draft
 * has no duplicates, so it never adds visual noise to the common case.
 */
function DuplicateWarningPanel({ employees }: DuplicateWarningPanelProps) {
  const groups = findDuplicateEmployeeWarnings(employees);

  if (groups.length === 0) return null;

  return (
    <section
      aria-labelledby="duplicate-warning-heading"
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3"
      role="alert"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
        <h3 id="duplicate-warning-heading" className="text-sm font-semibold text-amber-900">
          {groups.length} duplicate{groups.length !== 1 ? "s" : ""} found in this draft
        </h3>
      </div>

      <ul className="space-y-3">
        {groups.map((group) => (
          <li key={`${group.kind}-${group.value}`} className="text-sm">
            <p className="font-medium text-amber-900">
              {group.kind === "id" ? "Duplicate employee" : "Duplicate wallet address"}
              {": "}
              <span className="font-mono">
                {group.kind === "address" ? shortAddress(group.value) : group.value}
              </span>
            </p>
            <p className="text-amber-800 mt-0.5">{guidanceFor(group)}</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Affected rows">
              {group.employees.map((employee, index) => (
                <li
                  key={`${employee.id}-${index}`}
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-white border border-amber-200 text-xs text-amber-900"
                >
                  {employee.name || employee.id}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default DuplicateWarningPanel;
