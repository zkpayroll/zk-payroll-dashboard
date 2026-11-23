"use client";

import React from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { SalaryCommitmentDuplicateGroup } from "@/src/payroll/importSalaryCommitmentDuplicates";

/** How the operator resolved a duplicate group. */
export type DuplicateCommitmentResolution = number | "skip";

export interface ImportSalaryCommitmentDuplicateWarningProps {
  /** Duplicate groups reported by the detector. */
  groups: SalaryCommitmentDuplicateGroup[];
  /** Chosen resolution per group id — the row index to keep, or `"skip"`. */
  resolutions?: Record<string, DuplicateCommitmentResolution>;
  /** Invoked when the operator resolves a group. */
  onResolve?: (
    group: SalaryCommitmentDuplicateGroup,
    resolution: DuplicateCommitmentResolution,
  ) => void;
}

function groupLabel(group: SalaryCommitmentDuplicateGroup): string {
  return group.kind === "identical_commitment_value"
    ? "Duplicate commitment value"
    : "Duplicate salary commitment";
}

function rowLabel(
  group: SalaryCommitmentDuplicateGroup,
  rowIndex: number,
  name?: string | null,
): string {
  return name ? `Row ${rowIndex} — ${name}` : `Row ${rowIndex}`;
}

/**
 * Highlights duplicate salary commitments detected in an employee import.
 *
 * Two import rows that bind the same hidden salary to the same wallet would
 * create two commitments to the same statement, so the import must not proceed
 * until the operator keeps a single row (or excludes the group).
 *
 * Privacy: the panel never renders a raw salary amount — only masked wallet
 * addresses, truncated commitment values, and the source row numbers.
 */
export function ImportSalaryCommitmentDuplicateWarning({
  groups,
  resolutions = {},
  onResolve,
}: ImportSalaryCommitmentDuplicateWarningProps) {
  if (!groups || groups.length === 0) return null;

  return (
    <section
      aria-labelledby="salary-commitment-duplicate-heading"
      data-testid="import-salary-commitment-duplicate-warning"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-4"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div>
          <h3
            id="salary-commitment-duplicate-heading"
            className="text-sm font-semibold text-amber-900"
          >
            {groups.length} duplicate salary commitment
            {groups.length === 1 ? "" : "s"} detected in this import
          </h3>
          <p className="text-sm text-amber-800 mt-0.5">
            These rows would commit the same hidden salary to the same wallet.
            Resolve every group before importing.
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {groups.map((group) => {
          const resolution = resolutions[group.id];
          const isResolved = resolution !== undefined;

          return (
            <li
              key={group.id}
              data-testid={`salary-commitment-duplicate-group-${group.id}`}
              className="rounded-md border border-amber-200 bg-white/70 p-3 space-y-2"
            >
              <div className="flex items-start gap-2">
                <ShieldAlert
                  className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-900">
                    {groupLabel(group)}
                    {group.address ? `: ${group.address}` : ""}
                  </p>
                  <p className="text-xs text-amber-800">{group.message}</p>
                  <p className="text-xs text-amber-700">
                    <strong>Recommended action:</strong>{" "}
                    {group.actionableRemediation}
                  </p>
                </div>
              </div>

              {onResolve && (
                <div className="space-y-2">
                  <fieldset
                    className="space-y-1"
                    aria-label={`Resolve ${groupLabel(group).toLowerCase()}`}
                  >
                    <legend className="sr-only">
                      Choose the row to keep for {group.address}
                    </legend>
                    {group.rows.map((row) => {
                      const inputId = `${group.id}-row-${row.rowIndex}`;
                      const isChecked = resolution === row.rowIndex;
                      return (
                        <label
                          key={row.rowIndex}
                          htmlFor={inputId}
                          className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"
                        >
                          <input
                            id={inputId}
                            type="radio"
                            name={group.id}
                            value={row.rowIndex}
                            checked={isChecked}
                            onChange={() => onResolve(group, row.rowIndex)}
                            className="h-3.5 w-3.5"
                          />
                          <span>
                            {rowLabel(group, row.rowIndex, row.name)}
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>

                  <button
                    type="button"
                    onClick={() => onResolve(group, "skip")}
                    aria-pressed={resolution === "skip"}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors ${
                      resolution === "skip"
                        ? "bg-amber-100 border-amber-300 text-amber-900"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Exclude every row in this group
                  </button>

                  {isResolved && (
                    <p className="text-xs text-amber-800">
                      {resolution === "skip"
                        ? "All rows in this group will be excluded from the import."
                        : `Row ${resolution} will be imported; the other rows in this group will be excluded.`}
                    </p>
                  )}
                </div>
              )}

              {!onResolve && (
                <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Affected rows">
                  {group.rows.map((row) => (
                    <li
                      key={row.rowIndex}
                      className="inline-flex items-center px-2 py-0.5 rounded-full bg-white border border-amber-200 text-xs text-amber-900"
                    >
                      {rowLabel(group, row.rowIndex, row.name)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default ImportSalaryCommitmentDuplicateWarning;
