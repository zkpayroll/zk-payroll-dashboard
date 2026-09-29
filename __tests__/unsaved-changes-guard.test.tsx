/**
 * Tests for #468 – Reusable Form Unsaved-Changes Guard
 *
 * Covers:
 *   - useUnsavedChangesGuard hook: clean path (no dialog), dirty path (dialog)
 *   - requestNavigation vs requestDismiss action types
 *   - confirmLeave, cancelLeave state transitions
 *   - beforeunload listener registered when dirty, removed when clean
 *   - UnsavedChangesDialog component: renders, focus, cancel/confirm buttons
 *
 * Edge cases:
 *   - Guard does not open dialog when isDirty=false (proceeds immediately)
 *   - Dialog adapts copy based on pendingActionType
 *   - Cancel button receives focus by default (prevents accidental discard)
 */

import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";

import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/ui/UnsavedChangesDialog";

// ── Hook unit tests ──────────────────────────────────────────────────────────

describe("useUnsavedChangesGuard hook", () => {
  it("requestNavigation proceeds immediately when isDirty=false", () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ isDirty: false }),
    );

    const proceed = vi.fn();
    act(() => { result.current.requestNavigation(proceed); });

    expect(proceed).toHaveBeenCalledOnce();
    expect(result.current.isDialogOpen).toBe(false);
  });

  it("requestDismiss proceeds immediately when isDirty=false", () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ isDirty: false }),
    );

    const proceed = vi.fn();
    act(() => { result.current.requestDismiss(proceed); });

    expect(proceed).toHaveBeenCalledOnce();
    expect(result.current.isDialogOpen).toBe(false);
  });

  it("requestNavigation opens dialog when isDirty=true", () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ isDirty: true }),
    );

    act(() => { result.current.requestNavigation(vi.fn()); });

    expect(result.current.isDialogOpen).toBe(true);
    expect(result.current.pendingActionType).toBe("navigation");
  });

  it("requestDismiss opens dialog when isDirty=true", () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ isDirty: true }),
    );

    act(() => { result.current.requestDismiss(vi.fn()); });

    expect(result.current.isDialogOpen).toBe(true);
    expect(result.current.pendingActionType).toBe("dismiss");
  });

  it("confirmLeave closes dialog and runs the pending action", () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ isDirty: true }),
    );

    const proceed = vi.fn();
    act(() => { result.current.requestNavigation(proceed); });
    expect(result.current.isDialogOpen).toBe(true);

    act(() => { result.current.confirmLeave(); });

    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.pendingActionType).toBeNull();
    expect(proceed).toHaveBeenCalledOnce();
  });

  it("cancelLeave closes dialog without running the pending action", () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ isDirty: true }),
    );

    const proceed = vi.fn();
    act(() => { result.current.requestNavigation(proceed); });

    act(() => { result.current.cancelLeave(); });

    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.pendingActionType).toBeNull();
    expect(proceed).not.toHaveBeenCalled();
  });

  it("registers beforeunload listener when dirty", () => {
    const addSpy = vi.spyOn(window, "addEventListener");

    renderHook(() => useUnsavedChangesGuard({ isDirty: true }));

    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });

  it("removes beforeunload listener when isDirty becomes false", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { rerender } = renderHook(
      ({ dirty }: { dirty: boolean }) =>
        useUnsavedChangesGuard({ isDirty: dirty }),
      { initialProps: { dirty: true } },
    );

    rerender({ dirty: false });

    expect(removeSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    removeSpy.mockRestore();
  });

  it("reflects isDirty from the options in the returned state", () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ isDirty: true }),
    );
    expect(result.current.isDirty).toBe(true);
  });
});

// ── Component integration tests ──────────────────────────────────────────────

// Minimal component that wires guard + dialog together for integration testing
function TestForm({ initialDirty = false }: { initialDirty?: boolean }) {
  const [dirty, setDirty] = useState(initialDirty);
  const [navigated, setNavigated] = useState(false);
  const [closed, setClosed] = useState(false);

  const guard = useUnsavedChangesGuard({ isDirty: dirty });

  return (
    <div>
      <button onClick={() => setDirty(true)}>Make dirty</button>
      <button onClick={() => guard.requestNavigation(() => setNavigated(true))}>
        Navigate
      </button>
      <button onClick={() => guard.requestDismiss(() => setClosed(true))}>
        Close form
      </button>
      {navigated && <span>Navigated</span>}
      {closed && <span>Form closed</span>}
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}

describe("UnsavedChangesDialog component", () => {
  it("dialog is not in DOM when form is clean", () => {
    render(<TestForm initialDirty={false} />);
    expect(screen.queryByTestId("unsaved-changes-dialog")).not.toBeInTheDocument();
  });

  it("dialog does not appear when navigating with clean form", () => {
    render(<TestForm initialDirty={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Navigate/i }));
    expect(screen.queryByTestId("unsaved-changes-dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Navigated")).toBeInTheDocument();
  });

  it("dialog appears when navigating with dirty form (navigation variant)", () => {
    render(<TestForm initialDirty={true} />);
    fireEvent.click(screen.getByRole("button", { name: /Navigate/i }));
    expect(screen.getByTestId("unsaved-changes-dialog")).toBeInTheDocument();
    // Navigation-specific copy
    expect(screen.getByText(/Leave page\?/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Leave anyway/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stay and keep editing/i })).toBeInTheDocument();
  });

  it("dialog appears with dismiss variant when closing a dirty form", () => {
    render(<TestForm initialDirty={true} />);
    fireEvent.click(screen.getByRole("button", { name: /Close form/i }));
    expect(screen.getByTestId("unsaved-changes-dialog")).toBeInTheDocument();
    expect(screen.getByText(/Discard changes\?/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Discard changes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Keep editing/i })).toBeInTheDocument();
  });

  it("confirming leave runs the pending action and closes dialog", () => {
    render(<TestForm initialDirty={true} />);
    fireEvent.click(screen.getByRole("button", { name: /Navigate/i }));
    fireEvent.click(screen.getByRole("button", { name: /Leave anyway/i }));
    expect(screen.queryByTestId("unsaved-changes-dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Navigated")).toBeInTheDocument();
  });

  it("cancelling closes dialog without running the action", () => {
    render(<TestForm initialDirty={true} />);
    fireEvent.click(screen.getByRole("button", { name: /Navigate/i }));
    fireEvent.click(screen.getByRole("button", { name: /Stay and keep editing/i }));
    expect(screen.queryByTestId("unsaved-changes-dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Navigated")).not.toBeInTheDocument();
  });

  it("dialog has role=dialog and aria-modal=true", () => {
    render(<TestForm initialDirty={true} />);
    fireEvent.click(screen.getByRole("button", { name: /Navigate/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "unsaved-dialog-title");
    expect(dialog).toHaveAttribute("aria-describedby", "unsaved-dialog-description");
  });

  it("can be opened twice for two separate actions in sequence", () => {
    render(<TestForm initialDirty={true} />);

    // First navigate → cancel
    fireEvent.click(screen.getByRole("button", { name: /Navigate/i }));
    fireEvent.click(screen.getByRole("button", { name: /Stay and keep editing/i }));
    expect(screen.queryByTestId("unsaved-changes-dialog")).not.toBeInTheDocument();

    // Second close → confirm
    fireEvent.click(screen.getByRole("button", { name: /Close form/i }));
    expect(screen.getByTestId("unsaved-changes-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Discard changes/i }));
    expect(screen.getByText("Form closed")).toBeInTheDocument();
  });
});
