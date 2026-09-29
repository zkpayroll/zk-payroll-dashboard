"use client";

/**
 * #468 – useUnsavedChangesGuard
 *
 * Reusable hook that detects dirty form state and protects against
 * accidental navigation or dismissal.
 *
 * Responsibilities
 * ────────────────
 * 1. Tracks whether the form has unsaved changes (`isDirty`).
 * 2. Intercepts browser-level unload events (refresh / tab-close) when dirty.
 * 3. Exposes `requestNavigation` / `requestDismiss` helpers that either
 *    proceed immediately (clean) or open a confirmation dialog (dirty).
 * 4. Provides `confirm` and `cancel` callbacks the dialog binds to.
 *
 * The hook is entirely headless — it controls no UI itself. Pair it with
 * `<UnsavedChangesDialog>` for a ready-made confirmation modal.
 *
 * Usage
 * ─────
 *   const guard = useUnsavedChangesGuard({ isDirty });
 *
 *   // In a "Close" button handler:
 *   guard.requestDismiss(() => closeModal());
 *
 *   // In a Next.js Link's onClick (soft-nav interception):
 *   guard.requestNavigation(() => router.push("/employees"));
 *
 *   // Render the dialog:
 *   <UnsavedChangesDialog guard={guard} />
 */

import { useEffect, useCallback, useState } from "react";

export interface UseUnsavedChangesGuardOptions {
  /** Whether the form currently has unsaved changes. */
  isDirty: boolean;
  /**
   * Optional message shown in the native browser beforeunload dialog.
   * Browsers may ignore custom messages in modern engines; the string is
   * kept for compatibility with older embeddings.
   */
  browserPromptMessage?: string;
}

export interface UnsavedChangesGuardState {
  /** Mirror of the `isDirty` option — useful to pass to the dialog. */
  isDirty: boolean;
  /** Whether the confirmation dialog should be visible. */
  isDialogOpen: boolean;
  /**
   * Call before any navigation action. If the form is dirty the dialog
   * opens; if clean the `proceed` callback runs immediately.
   */
  requestNavigation: (proceed: () => void) => void;
  /**
   * Call before any dismiss/close action. Same semantics as
   * `requestNavigation` but semantically distinct so callers can tell the
   * difference (the dialog can show different copy for each).
   */
  requestDismiss: (proceed: () => void) => void;
  /** The type of pending action — lets the dialog tailor its copy. */
  pendingActionType: "navigation" | "dismiss" | null;
  /** Bound to the dialog's "Leave anyway" / "Discard changes" button. */
  confirmLeave: () => void;
  /** Bound to the dialog's "Stay" / "Keep editing" button. */
  cancelLeave: () => void;
}

export function useUnsavedChangesGuard(
  options: UseUnsavedChangesGuardOptions,
): UnsavedChangesGuardState {
  const {
    isDirty,
    browserPromptMessage = "You have unsaved changes. Are you sure you want to leave?",
  } = options;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [pendingActionType, setPendingActionType] = useState<
    "navigation" | "dismiss" | null
  >(null);

  // ── Browser unload guard ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // `returnValue` is required for Chrome/Edge; the custom string is shown
      // only in legacy browsers — modern ones show their own generic message.
      e.returnValue = browserPromptMessage;
      return browserPromptMessage;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, browserPromptMessage]);

  // ── Internal helper ───────────────────────────────────────────────────────
  const openDialog = useCallback(
    (proceed: () => void, type: "navigation" | "dismiss") => {
      setPendingAction(() => proceed);
      setPendingActionType(type);
      setIsDialogOpen(true);
    },
    [],
  );

  // ── Public API ────────────────────────────────────────────────────────────
  const requestNavigation = useCallback(
    (proceed: () => void) => {
      if (!isDirty) {
        proceed();
        return;
      }
      openDialog(proceed, "navigation");
    },
    [isDirty, openDialog],
  );

  const requestDismiss = useCallback(
    (proceed: () => void) => {
      if (!isDirty) {
        proceed();
        return;
      }
      openDialog(proceed, "dismiss");
    },
    [isDirty, openDialog],
  );

  const confirmLeave = useCallback(() => {
    setIsDialogOpen(false);
    const action = pendingAction;
    setPendingAction(null);
    setPendingActionType(null);
    // Run after state update to avoid React batching conflicts.
    action?.();
  }, [pendingAction]);

  const cancelLeave = useCallback(() => {
    setIsDialogOpen(false);
    setPendingAction(null);
    setPendingActionType(null);
  }, []);

  return {
    isDirty,
    isDialogOpen,
    pendingActionType,
    requestNavigation,
    requestDismiss,
    confirmLeave,
    cancelLeave,
  };
}
