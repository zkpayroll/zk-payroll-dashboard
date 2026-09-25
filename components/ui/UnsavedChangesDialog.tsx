"use client";

/**
 * #468 – UnsavedChangesDialog
 *
 * Confirmation dialog paired with `useUnsavedChangesGuard`. Renders a
 * blocking modal whenever the guard's `isDialogOpen` is true, giving the
 * operator two clear choices:
 *
 * • "Keep editing"     — returns to the form (cancelLeave)
 * • "Discard changes"  — proceeds with the pending navigation/dismiss
 *                        (confirmLeave)
 *
 * Copy adapts to the pending action type:
 * • "navigation" → "Leave page?" variant
 * • "dismiss"    → "Discard changes?" variant
 *
 * No sensitive payroll data is ever rendered inside this dialog.
 *
 * Usage
 * ─────
 *   const guard = useUnsavedChangesGuard({ isDirty });
 *   ...
 *   <UnsavedChangesDialog guard={guard} />
 *
 *   // Or with custom copy:
 *   <UnsavedChangesDialog
 *     guard={guard}
 *     title="Unsaved employee edits"
 *     description="You have employee configuration changes that haven't been saved."
 *   />
 */

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import type { UnsavedChangesGuardState } from "@/hooks/useUnsavedChangesGuard";
import { cn } from "@/lib/utils";

interface UnsavedChangesDialogProps {
  guard: UnsavedChangesGuardState;
  /** Override the dialog title. Defaults depend on `pendingActionType`. */
  title?: string;
  /** Override the dialog description. */
  description?: string;
  /** Label for the destructive "leave" button. */
  confirmLabel?: string;
  /** Label for the safe "stay" button. */
  cancelLabel?: string;
}

const DEFAULT_COPY = {
  navigation: {
    title: "Leave page?",
    description:
      "You have unsaved changes. Leaving now will discard your edits. This cannot be undone.",
    confirmLabel: "Leave anyway",
    cancelLabel: "Stay and keep editing",
  },
  dismiss: {
    title: "Discard changes?",
    description:
      "You have unsaved changes that will be lost if you close this form.",
    confirmLabel: "Discard changes",
    cancelLabel: "Keep editing",
  },
} as const;

export function UnsavedChangesDialog({
  guard,
  title,
  description,
  confirmLabel,
  cancelLabel,
}: UnsavedChangesDialogProps) {
  const { isDialogOpen, pendingActionType, confirmLeave, cancelLeave } = guard;

  const copy =
    DEFAULT_COPY[pendingActionType ?? "dismiss"];

  const resolvedTitle = title ?? copy.title;
  const resolvedDescription = description ?? copy.description;
  const resolvedConfirmLabel = confirmLabel ?? copy.confirmLabel;
  const resolvedCancelLabel = cancelLabel ?? copy.cancelLabel;

  // Focus the safe "cancel" button by default so Enter doesn't accidentally
  // trigger the destructive action.
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isDialogOpen) {
      cancelRef.current?.focus();
    }
  }, [isDialogOpen]);

  if (!isDialogOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-dialog-title"
      aria-describedby="unsaved-dialog-description"
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      data-testid="unsaved-changes-dialog"
    >
      <div
        className="relative mx-4 w-full max-w-sm rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl"
        // Prevent click-outside from silently discarding — operator must
        // choose explicitly.
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon + title */}
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle
              className="h-5 w-5 text-amber-600"
              aria-hidden="true"
            />
          </span>
          <div className="pt-0.5">
            <h2
              id="unsaved-dialog-title"
              className="text-sm font-semibold text-gray-900"
            >
              {resolvedTitle}
            </h2>
            <p
              id="unsaved-dialog-description"
              className="mt-1 text-sm text-gray-600"
            >
              {resolvedDescription}
            </p>
          </div>
        </div>

        {/* Actions — safe action first in DOM order for screen readers */}
        <div
          className={cn(
            "mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3",
          )}
        >
          <button
            ref={cancelRef}
            type="button"
            onClick={cancelLeave}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 sm:w-auto"
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            onClick={confirmLeave}
            className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 sm:w-auto"
          >
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
