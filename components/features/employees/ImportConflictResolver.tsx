"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowRight,
  Shield,
  Copy,
} from "lucide-react";
import type { CsvRow } from "./CsvImport";

export interface ConflictType {
  id: string;
  type:
    | "duplicate_email"
    | "duplicate_address"
    | "duplicate_name"
    | "address_mismatch";
  severity: "warning" | "error";
  title: string;
  description: string;
  conflictingRows: CsvRow[];
  recommendation?: string;
}

interface ImportConflictResolverProps {
  rows: CsvRow[];
  existingEmployees?: { email?: string; address: string; name: string }[];
  onResolve: (resolvedRows: CsvRow[], skippedIds: string[]) => void;
  onCancel: () => void;
}

/**
 * Detects conflicts in imported rows:
 * - Duplicate emails in import
 * - Duplicate Stellar addresses in import
 * - Address already exists in system
 * - Similar names (potential duplicates)
 */
function detectConflicts(
  rows: CsvRow[],
  existingEmployees: { email?: string; address: string; name: string }[] = [],
): ConflictType[] {
  const conflicts: ConflictType[] = [];
  const addressMap = new Map<string, CsvRow[]>();
  const emailMap = new Map<string, CsvRow[]>();
  const nameMap = new Map<string, CsvRow[]>();

  // Map all rows
  rows.forEach((row) => {
    const addr = row.address.trim().toLowerCase();
    const email = row.email?.trim().toLowerCase();
    const name = row.name.trim().toLowerCase();

    if (addr) {
      if (!addressMap.has(addr)) addressMap.set(addr, []);
      addressMap.get(addr)!.push(row);
    }

    if (email) {
      if (!emailMap.has(email)) emailMap.set(email, []);
      emailMap.get(email)!.push(row);
    }

    if (name) {
      if (!nameMap.has(name)) nameMap.set(name, []);
      nameMap.get(name)!.push(row);
    }
  });

  // Detect duplicate addresses in import
  addressMap.forEach((rows, addr) => {
    if (rows.length > 1) {
      conflicts.push({
        id: `dup_addr_${addr}`,
        type: "duplicate_address",
        severity: "error",
        title: `Duplicate Stellar Address (${addr.slice(0, 8)}...)`,
        description: `${rows.length} rows in this import use the same Stellar address.`,
        conflictingRows: rows,
        recommendation:
          "Verify wallet ownership. A single address can only belong to one employee.",
      });
    }
  });

  // Detect duplicate emails in import
  emailMap.forEach((rows, email) => {
    if (rows.length > 1) {
      conflicts.push({
        id: `dup_email_${email}`,
        type: "duplicate_email",
        severity: "warning",
        title: `Duplicate Email Address (${email})`,
        description: `${rows.length} rows share this email address.`,
        conflictingRows: rows,
        recommendation:
          "One person may be listed twice. Verify names and addresses match.",
      });
    }
  });

  // Detect addresses that already exist in system
  rows.forEach((row) => {
    const existing = existingEmployees.find(
      (emp) => emp.address.toLowerCase() === row.address.trim().toLowerCase(),
    );
    if (existing) {
      conflicts.push({
        id: `sys_addr_${row.rowIndex}`,
        type: "address_mismatch",
        severity: "error",
        title: `Address Already in System`,
        description: `Row ${row.rowIndex} (${row.name}) uses an address already assigned to another employee.`,
        conflictingRows: [row],
        recommendation: `This address is registered to "${existing.name}". Use a different wallet address.`,
      });
    }
  });

  // Detect very similar names (potential duplicates)
  const checkedNames = new Set<string>();
  nameMap.forEach((rows, name) => {
    if (rows.length > 1 && !checkedNames.has(name)) {
      checkedNames.add(name);
      conflicts.push({
        id: `dup_name_${name}`,
        type: "duplicate_name",
        severity: "warning",
        title: `Duplicate Name (${name})`,
        description: `${rows.length} rows have the same employee name.`,
        conflictingRows: rows,
        recommendation:
          "Verify these are not duplicate entries. Check email and start dates.",
      });
    }
  });

  return conflicts.sort((a, b) => {
    // Errors first, then warnings
    if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
    return 0;
  });
}

function ConflictCard({
  conflict,
  onSkip,
  onSelect,
}: {
  conflict: ConflictType;
  onSkip: () => void;
  onSelect: (rowIndex: number) => void;
}) {
  const isError = conflict.severity === "error";
  const bgColor = isError
    ? "bg-red-50 border-red-200"
    : "bg-amber-50 border-amber-200";
  const headerColor = isError ? "text-red-800" : "text-amber-800";
  const textColor = isError ? "text-red-700" : "text-amber-700";
  const Icon = isError ? AlertTriangle : AlertTriangle;

  return (
    <div className={`border ${bgColor} rounded-lg p-4 space-y-3`} role="alert">
      <div className="flex items-start gap-3">
        <Icon
          className={`w-5 h-5 ${isError ? "text-red-600" : "text-amber-600"} mt-0.5 shrink-0`}
        />
        <div className="flex-1">
          <h4 className={`font-semibold text-sm ${headerColor}`}>
            {conflict.title}
          </h4>
          <p className={`text-sm mt-1 ${textColor}`}>{conflict.description}</p>

          {conflict.recommendation && (
            <div
              className={`mt-2 p-2 rounded bg-white/50 text-xs ${textColor}`}
            >
              <strong>Recommendation:</strong> {conflict.recommendation}
            </div>
          )}

          <div className="mt-3 space-y-2">
            {conflict.conflictingRows.map((row) => (
              <div
                key={row.rowIndex}
                className="flex items-center justify-between p-2 bg-white/50 rounded text-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900">
                    Row {row.rowIndex}: {row.name}
                  </div>
                  <div className="text-gray-600 font-mono">
                    {row.address.slice(0, 12)}...
                  </div>
                  {row.email && (
                    <div className="text-gray-600">{row.email}</div>
                  )}
                </div>
                {conflict.type !== "address_mismatch" && (
                  <button
                    type="button"
                    onClick={() => onSelect(row.rowIndex)}
                    title="Keep this row, skip conflicting ones"
                    className="ml-2 p-1 rounded hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {conflict.type !== "address_mismatch" && (
            <button
              type="button"
              onClick={onSkip}
              className="mt-2 w-full px-3 py-1.5 text-xs font-medium rounded bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Skip these rows
            </button>
          )}
          {conflict.type === "address_mismatch" && (
            <div className="mt-2 p-2 rounded bg-white/50 text-xs text-red-600 font-medium">
              ⚠️ This row will be skipped automatically
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ImportConflictResolver({
  rows,
  existingEmployees = [],
  onResolve,
  onCancel,
}: ImportConflictResolverProps) {
  const conflicts = useMemo(
    () => detectConflicts(rows, existingEmployees),
    [rows, existingEmployees],
  );

  const [skippedRowIds, setSkippedRowIds] = useState<Set<number>>(new Set());

  const handleSkipConflict = (conflictId: string) => {
    const conflict = conflicts.find((c) => c.id === conflictId);
    if (conflict) {
      const newSkipped = new Set(skippedRowIds);
      conflict.conflictingRows.forEach((row) => {
        newSkipped.add(row.rowIndex);
      });
      setSkippedRowIds(newSkipped);
    }
  };

  const handleSelectRow = (rowIndex: number) => {
    const conflict = conflicts.find((c) =>
      c.conflictingRows.some((r) => r.rowIndex === rowIndex),
    );
    if (conflict) {
      const newSkipped = new Set(skippedRowIds);
      conflict.conflictingRows.forEach((row) => {
        if (row.rowIndex !== rowIndex) {
          newSkipped.add(row.rowIndex);
        }
      });
      setSkippedRowIds(newSkipped);
    }
  };

  const resolvedRows = rows.filter((r) => !skippedRowIds.has(r.rowIndex));
  const hasErrors = conflicts.some((c) => c.severity === "error");
  const canProceed = !hasErrors && resolvedRows.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-dialog-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="conflict-dialog-title"
              className="text-lg font-semibold text-gray-900"
            >
              Resolve Import Conflicts
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {conflicts.length} issue
              {conflicts.length !== 1 ? "s" : ""} detected in your import
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {conflicts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
            <div className="text-center">
              <h3 className="font-semibold text-gray-900">
                No conflicts detected
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                All {rows.length} row{rows.length !== 1 ? "s" : ""} are ready to
                import.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-h-[calc(90vh-300px)] overflow-y-auto">
            {conflicts.map((conflict) => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                onSkip={() => handleSkipConflict(conflict.id)}
                onSelect={handleSelectRow}
              />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-600">
            {skippedRowIds.size > 0 && (
              <span>
                Skipping {skippedRowIds.size} row
                {skippedRowIds.size !== 1 ? "s" : ""} •{" "}
              </span>
            )}
            Importing {resolvedRows.length}/{rows.length} rows
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                onResolve(resolvedRows, Array.from(skippedRowIds).map(String))
              }
              disabled={!canProceed && conflicts.length > 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>
                {conflicts.length === 0 ? "Proceed" : "Import Resolved"}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {hasErrors && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <Shield className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">
              Critical conflicts must be resolved before proceeding. Fix or skip
              conflicting rows.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
