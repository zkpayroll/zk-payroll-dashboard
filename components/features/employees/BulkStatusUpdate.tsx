"use client";

import { useState, useMemo } from "react";
import { useEmployeeStore } from "@/stores/employees";
import { MOCK_EMPLOYEES } from "@/lib/api/mockData";
import type { Employee } from "@/types";

type TargetStatus = "active" | "inactive" | "pending";

type RowResult = { id: string; name: string; success: boolean; error?: string };

function deriveStatus(e: Employee): "active" | "inactive" | "pending" {
  if (e.status) return e.status;
  return e.isActive ? "active" : "inactive";
}

export default function BulkStatusUpdate() {
  const { employees: stored, updateEmployee } = useEmployeeStore();
  const employees = stored.length > 0 ? stored : MOCK_EMPLOYEES;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetStatus, setTargetStatus] = useState<TargetStatus>("active");
  const [step, setStep] = useState<"select" | "confirm" | "result">("select");
  const [results, setResults] = useState<RowResult[]>([]);

  const selectedEmployees = useMemo(
    () => employees.filter((e) => selected.has(e.id)),
    [employees, selected],
  );

  function toggleAll() {
    if (selected.size === employees.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(employees.map((e) => e.id)));
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    const rows: RowResult[] = selectedEmployees.map((e) => {
      try {
        updateEmployee(e.id, {
          status: targetStatus,
          isActive: targetStatus === "active",
        });
        return { id: e.id, name: e.name, success: true };
      } catch (err) {
        return {
          id: e.id,
          name: e.name,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    });
    setResults(rows);
    setStep("result");
  }

  if (step === "confirm") {
    return (
      <section aria-labelledby="bulk-confirm-heading" className="rounded-lg bg-white p-6 shadow-sm">
        <h3 id="bulk-confirm-heading" className="text-base font-semibold text-gray-900">
          Confirm bulk update
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          Set {selectedEmployees.length} employee(s) to{" "}
          <strong className="capitalize">{targetStatus}</strong>?
        </p>
        <ul className="mt-3 max-h-48 overflow-y-auto divide-y divide-gray-100 rounded border text-sm">
          {selectedEmployees.map((e) => (
            <li key={e.id} className="flex items-center justify-between px-3 py-2">
              <span>{e.name}</span>
              <span className="text-xs text-gray-400 capitalize">{deriveStatus(e)} → {targetStatus}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => setStep("select")}
            className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Apply changes
          </button>
        </div>
      </section>
    );
  }

  if (step === "result") {
    const failed = results.filter((r) => !r.success);
    return (
      <section aria-labelledby="bulk-result-heading" className="rounded-lg bg-white p-6 shadow-sm">
        <h3 id="bulk-result-heading" className="text-base font-semibold text-gray-900">
          Update complete
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          {results.filter((r) => r.success).length} updated, {failed.length} failed.
        </p>
        {failed.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-red-700">
            {failed.map((r) => (
              <li key={r.id} role="alert">
                {r.name}: {r.error}
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => {
            setSelected(new Set());
            setStep("select");
          }}
          className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Done
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="bulk-select-heading" className="rounded-lg bg-white p-6 shadow-sm">
      <h3 id="bulk-select-heading" className="text-base font-semibold text-gray-900">
        Bulk employee status update
      </h3>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label htmlFor="targetStatus" className="text-sm font-medium text-gray-700">Set status to</label>
        <select
          id="targetStatus"
          value={targetStatus}
          onChange={(e) => setTargetStatus(e.target.value as TargetStatus)}
          className="rounded-md border px-3 py-1.5 text-sm text-gray-700"
          aria-label="target status"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all employees"
                  checked={selected.size === employees.length && employees.length > 0}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Department</th>
              <th className="px-4 py-2.5">Current status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {employees.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    aria-label={`Select ${e.name}`}
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                  />
                </td>
                <td className="px-4 py-2.5 font-medium text-gray-900">{e.name}</td>
                <td className="px-4 py-2.5 text-gray-500">{e.department ?? "—"}</td>
                <td className="px-4 py-2.5 capitalize text-gray-700">{deriveStatus(e)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-gray-500">{selected.size} selected</span>
        <button
          disabled={selected.size === 0}
          onClick={() => setStep("confirm")}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          Review changes
        </button>
      </div>
    </section>
  );
}
