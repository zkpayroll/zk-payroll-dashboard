"use client";

import React from "react";
import { AlertTriangle, ShieldAlert, X } from "lucide-react";
import {
  validatePaymentInstructions,
  maskPaymentAddress,
  getInstructionId,
  type PaymentInstruction,
  type PaymentInstructionDuplicateGroup,
  type PaymentInstructionDuplicateOptions,
  type PaymentInstructionValidationResult,
} from "@/lib/duplicateDetection";

export interface PaymentInstructionDuplicateWarningProps {
  /** Array of payment instructions to validate. */
  instructions?: PaymentInstruction[];
  /** Optional options configuring strictness, collisions, or multi-asset flags. */
  options?: PaymentInstructionDuplicateOptions;
  /** Pre-evaluated duplicate groups (optional; computed automatically if omitted). */
  duplicateGroups?: PaymentInstructionDuplicateGroup[];
  /** Pre-evaluated validation result (optional). */
  validationResult?: PaymentInstructionValidationResult;
  /** Callback invoked when the user requests resolution for a duplicate group. */
  onResolveDuplicate?: (group: PaymentInstructionDuplicateGroup) => void;
  /** Callback invoked when the warning banner is dismissed. */
  onDismiss?: () => void;
  /** Optional custom CSS classes. */
  className?: string;
}

function getKindLabel(kind: PaymentInstructionDuplicateGroup["kind"]): string {
  switch (kind) {
    case "instruction_id":
      return "Duplicate Instruction ID";
    case "recipient":
      return "Duplicate Recipient";
    case "address":
      return "Shared Wallet Address";
    case "exact_match":
      return "Identical Instruction";
    case "collision":
      return "Execution Collision";
    default:
      return "Duplicate Instruction";
  }
}

/**
 * Warns operators about duplicate payment instructions in a payroll batch (#633).
 *
 * Renders an accessible, privacy-safe alert with clear remediation guidance.
 * Returns null when no duplicates exist to keep common workflows quiet.
 */
export function PaymentInstructionDuplicateWarning({
  instructions,
  options,
  duplicateGroups: initialDuplicateGroups,
  validationResult: initialValidationResult,
  onResolveDuplicate,
  onDismiss,
  className = "",
}: PaymentInstructionDuplicateWarningProps) {
  const groups =
    initialDuplicateGroups ??
    initialValidationResult?.duplicateGroups ??
    (instructions ? validatePaymentInstructions(instructions, options).duplicateGroups : []);

  const result: PaymentInstructionValidationResult =
    initialValidationResult ??
    (instructions
      ? validatePaymentInstructions(instructions, options)
      : {
          isValid: !groups.some((g) => g.isBlocking),
          hasDuplicates: groups.length > 0,
          isBlocking: groups.some((g) => g.isBlocking),
          duplicateGroups: groups,
          summaryMessage: null,
        });

  if (!groups || groups.length === 0) {
    return null;
  }

  const isBlocking = groups.some((g) => g.isBlocking);

  return (
    <section
      role="alert"
      aria-live="polite"
      aria-labelledby="payment-instruction-duplicate-heading"
      data-testid="payment-instruction-duplicate-warning"
      className={`rounded-lg border p-4 space-y-3 shadow-sm ${
        isBlocking
          ? "border-red-300 bg-red-50 text-red-950"
          : "border-amber-300 bg-amber-50 text-amber-950"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {isBlocking ? (
            <ShieldAlert
              className="w-5 h-5 text-red-600 shrink-0"
              aria-hidden="true"
            />
          ) : (
            <AlertTriangle
              className="w-5 h-5 text-amber-600 shrink-0"
              aria-hidden="true"
            />
          )}
          <h3
            id="payment-instruction-duplicate-heading"
            className={`text-sm font-semibold ${
              isBlocking ? "text-red-900" : "text-amber-900"
            }`}
          >
            {groups.length} duplicate payment instruction
            {groups.length !== 1 ? "s" : ""} detected
          </h3>
          <span
            className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
              isBlocking
                ? "bg-red-100 text-red-800 border-red-200"
                : "bg-amber-100 text-amber-800 border-amber-200"
            }`}
          >
            {isBlocking ? "Blocking" : "Review Required"}
          </span>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss duplicate payment instruction warning"
            className="p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-black/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {result.summaryMessage && (
        <p
          className={`text-xs sm:text-sm ${
            isBlocking ? "text-red-800" : "text-amber-800"
          }`}
        >
          {result.summaryMessage}
        </p>
      )}

      <ul
        className="space-y-3 divide-y divide-black/5 pt-1"
        aria-label="Duplicate payment instruction groups"
      >
        {groups.map((group, index) => {
          const kindLabel = getKindLabel(group.kind);
          return (
            <li
              key={`${group.kind}-${group.value}-${index}`}
              className="pt-2 text-sm space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      group.isBlocking
                        ? "bg-red-100 text-red-800 border border-red-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {kindLabel}
                  </span>
                  <span className="font-mono text-xs font-medium text-gray-900">
                    {group.kind === "address"
                      ? maskPaymentAddress(group.value)
                      : group.value}
                  </span>
                </div>

                {onResolveDuplicate && (
                  <button
                    type="button"
                    onClick={() => onResolveDuplicate(group)}
                    className="text-xs font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
                  >
                    Resolve
                  </button>
                )}
              </div>

              <p
                className={`text-xs ${
                  group.isBlocking ? "text-red-800" : "text-amber-800"
                }`}
              >
                {group.message}
              </p>

              <div
                className={`p-2 rounded text-xs border ${
                  group.isBlocking
                    ? "bg-white/80 border-red-200 text-red-900"
                    : "bg-white/80 border-amber-200 text-amber-900"
                }`}
              >
                <span className="font-semibold">Remediation: </span>
                {group.actionableRemediation}
              </div>

              {group.instructions && group.instructions.length > 0 && (
                <div className="pt-0.5">
                  <span className="text-xs text-gray-600 block mb-1">
                    Affected instructions:
                  </span>
                  <ul
                    className="flex flex-wrap gap-1.5"
                    aria-label="Affected instructions list"
                  >
                    {group.instructions.map((inst, instIdx) => {
                      const idLabel = getInstructionId(inst, instIdx);
                      const nameOrEmp =
                        inst.name || inst.employeeId || idLabel;
                      return (
                        <li
                          key={`${idLabel}-${instIdx}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-gray-200 text-xs text-gray-800 shadow-2xs"
                        >
                          <span className="font-mono text-gray-500">
                            {idLabel}:
                          </span>
                          <span>{nameOrEmp}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default PaymentInstructionDuplicateWarning;
