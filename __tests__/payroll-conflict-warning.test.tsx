import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  detectPeriodConflict,
  usePayrollConflictWarning,
  type PeriodSnapshot,
} from "@/hooks/usePayrollConflictWarning";
import { PayrollConflictBanner } from "@/components/features/payroll/PayrollConflictBanner";
import { PayrollConflictWarningModal } from "@/components/features/payroll/PayrollConflictWarningModal";

describe("detectPeriodConflict", () => {
  it("returns null when either base or remote is missing or IDs differ", () => {
    expect(detectPeriodConflict(null, null)).toBeNull();
    const snap1: PeriodSnapshot = { id: "run-1", version: 1 };
    const snap2: PeriodSnapshot = { id: "run-2", version: 2 };
    expect(detectPeriodConflict(snap1, snap2)).toBeNull();
  });

  it("detects status mismatch between base and remote", () => {
    const base: PeriodSnapshot = { id: "run-1", status: "draft" };
    const remote: PeriodSnapshot = { id: "run-1", status: "finalized", lastEditedBy: "Alice" };

    const conflict = detectPeriodConflict(base, remote);
    expect(conflict).not.toBeNull();
    expect(conflict?.changeDescription).toContain('changed from "draft" to "finalized"');
    expect(conflict?.remoteEditor).toBe("Alice");
  });

  it("detects newer version on remote", () => {
    const base: PeriodSnapshot = { id: "run-1", version: 1, status: "draft" };
    const remote: PeriodSnapshot = { id: "run-1", version: 3, status: "draft" };

    const conflict = detectPeriodConflict(base, remote);
    expect(conflict).not.toBeNull();
    expect(conflict?.changeDescription).toContain("newer revision (v3)");
  });

  it("detects newer updatedAt timestamp on remote", () => {
    const base: PeriodSnapshot = {
      id: "run-1",
      updatedAt: "2026-09-25T10:00:00Z",
    };
    const remote: PeriodSnapshot = {
      id: "run-1",
      updatedAt: "2026-09-25T10:15:00Z",
      lastEditedBy: "Operator Bob",
    };

    const conflict = detectPeriodConflict(base, remote);
    expect(conflict).not.toBeNull();
    expect(conflict?.changeDescription).toContain("Operator Bob");
  });

  it("returns null when remote is older or identical", () => {
    const base: PeriodSnapshot = {
      id: "run-1",
      version: 2,
      updatedAt: "2026-09-25T10:00:00Z",
    };
    const remote: PeriodSnapshot = {
      id: "run-1",
      version: 2,
      updatedAt: "2026-09-25T09:00:00Z",
    };

    expect(detectPeriodConflict(base, remote)).toBeNull();
  });
});

describe("PayrollConflictBanner & Modal Components", () => {
  function TestHarness({
    onReload,
    onOverwrite,
    initialConflict = true,
  }: {
    onReload?: () => Promise<void> | void;
    onOverwrite?: () => Promise<void> | void;
    initialConflict?: boolean;
  }) {
    const base: PeriodSnapshot = {
      id: "run-1",
      status: "draft",
      version: 1,
      updatedAt: "2026-09-25T10:00:00Z",
    };
    const remote: PeriodSnapshot = initialConflict
      ? {
          id: "run-1",
          status: "finalized",
          version: 2,
          updatedAt: "2026-09-25T11:00:00Z",
          lastEditedBy: "Carol",
        }
      : base;

    const state = usePayrollConflictWarning({
      baseSnapshot: base,
      remoteSnapshot: remote,
      onReloadLatest: onReload,
      onOverwrite: onOverwrite,
    });

    return <PayrollConflictBanner state={state} />;
  }

  it("renders conflict banner when concurrent modification exists", () => {
    render(<TestHarness />);
    expect(screen.getByTestId("payroll-conflict-banner")).toBeInTheDocument();
    expect(screen.getByText(/Concurrent modification detected/i)).toBeInTheDocument();
    expect(screen.getByText(/changed from "draft" to "finalized"/i)).toBeInTheDocument();
  });

  it("does not render when no conflict exists", () => {
    render(<TestHarness initialConflict={false} />);
    expect(screen.queryByTestId("payroll-conflict-banner")).not.toBeInTheDocument();
  });

  it("invokes onReloadLatest when Reload latest is clicked", async () => {
    const onReload = vi.fn().mockResolvedValue(undefined);
    render(<TestHarness onReload={onReload} />);

    const reloadBtn = screen.getByRole("button", { name: /Reload latest/i });
    fireEvent.click(reloadBtn);

    await waitFor(() => {
      expect(onReload).toHaveBeenCalledTimes(1);
    });
  });

  it("opens modal on review and enforces acknowledgement before overwrite", async () => {
    const onOverwrite = vi.fn().mockResolvedValue(undefined);
    render(<TestHarness onOverwrite={onOverwrite} />);

    // Click review changes
    fireEvent.click(screen.getByRole("button", { name: /Review changes/i }));

    // Modal is opened
    expect(screen.getByTestId("payroll-conflict-warning-modal")).toBeInTheDocument();
    expect(screen.getByText(/Payroll Data Conflict Detected/i)).toBeInTheDocument();

    const overwriteBtn = screen.getByRole("button", { name: /Overwrite remote changes/i });
    expect(overwriteBtn).toBeDisabled();

    // Check acknowledgement
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(overwriteBtn).not.toBeDisabled();

    // Click overwrite
    fireEvent.click(overwriteBtn);

    await waitFor(() => {
      expect(onOverwrite).toHaveBeenCalledTimes(1);
    });
  });

  it("dismisses banner when close button is clicked", () => {
    render(<TestHarness />);
    const dismissBtn = screen.getByRole("button", { name: /Dismiss warning/i });
    fireEvent.click(dismissBtn);
    expect(screen.queryByTestId("payroll-conflict-banner")).not.toBeInTheDocument();
  });
});
