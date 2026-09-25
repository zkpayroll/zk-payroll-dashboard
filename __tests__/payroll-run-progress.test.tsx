/**
 * Tests for #470 – Payroll Run Progress Persistence
 *
 * Covers:
 *   - usePayrollRunProgressStore: recordProgress, clearProgress, hasResumableRun
 *   - usePayrollRunProgress hook: syncs wizard state → progress store
 *   - PayrollRunProgressBanner: renders on resumable run, resume/discard actions
 *
 * Edge cases:
 *   - Snapshot is cleared on successful submission (no stale banner)
 *   - Banner never renders when there is no resumable run
 */

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";

import { usePayrollRunProgressStore } from "@/stores/payrollRunProgress";
import { usePayrollWizardStore } from "@/stores/payrollWizard";
import { usePayrollRunProgress } from "@/hooks/usePayrollRunProgress";
import { PayrollRunProgressBanner } from "@/components/features/payroll/PayrollRunProgressBanner";

// ── Store reset helpers ──────────────────────────────────────────────────────

function resetStores() {
  usePayrollRunProgressStore.setState({ snapshot: null });
  usePayrollWizardStore.getState().reset();
}

// ── Store unit tests ─────────────────────────────────────────────────────────

describe("usePayrollRunProgressStore", () => {
  beforeEach(resetStores);

  it("starts with no snapshot", () => {
    expect(usePayrollRunProgressStore.getState().snapshot).toBeNull();
    expect(usePayrollRunProgressStore.getState().hasResumableRun()).toBe(false);
  });

  it("recordProgress saves a safe snapshot", () => {
    const { recordProgress } = usePayrollRunProgressStore.getState();

    act(() => {
      recordProgress("run_001", "proof", 5, false, false);
    });

    const snap = usePayrollRunProgressStore.getState().snapshot;
    expect(snap).not.toBeNull();
    expect(snap?.runId).toBe("run_001");
    expect(snap?.currentStep).toBe("proof");
    expect(snap?.employeeCount).toBe(5);
    expect(snap?.proofReady).toBe(false);
    expect(snap?.submitted).toBe(false);
    expect(typeof snap?.updatedAt).toBe("string");
  });

  it("hasResumableRun returns true for an in-progress snapshot", () => {
    act(() => {
      usePayrollRunProgressStore.getState().recordProgress("run_002", "confirm", 3, true, false);
    });
    expect(usePayrollRunProgressStore.getState().hasResumableRun()).toBe(true);
  });

  it("hasResumableRun returns false once submitted=true", () => {
    act(() => {
      usePayrollRunProgressStore.getState().recordProgress("run_003", "submit", 3, true, true);
    });
    // submitted=true → not resumable
    expect(usePayrollRunProgressStore.getState().hasResumableRun()).toBe(false);
  });

  it("clearProgress removes the snapshot", () => {
    act(() => {
      usePayrollRunProgressStore.getState().recordProgress("run_004", "review", 2, false, false);
    });
    act(() => {
      usePayrollRunProgressStore.getState().clearProgress();
    });
    expect(usePayrollRunProgressStore.getState().snapshot).toBeNull();
    expect(usePayrollRunProgressStore.getState().hasResumableRun()).toBe(false);
  });
});

// ── Hook unit tests ──────────────────────────────────────────────────────────

describe("usePayrollRunProgress hook", () => {
  beforeEach(resetStores);

  it("records progress when runId and employeeIds are present", () => {
    usePayrollWizardStore.setState({
      currentStep: "proof",
      employeeIds: ["emp_1", "emp_2"],
      proofStatus: "generating",
      submissionStatus: "idle",
    });

    renderHook(() => usePayrollRunProgress({ runId: "run_hook_1" }));

    const snap = usePayrollRunProgressStore.getState().snapshot;
    expect(snap?.runId).toBe("run_hook_1");
    expect(snap?.currentStep).toBe("proof");
    expect(snap?.employeeCount).toBe(2);
    expect(snap?.proofReady).toBe(false);
    expect(snap?.submitted).toBe(false);
  });

  it("sets proofReady=true when proofStatus is success", () => {
    usePayrollWizardStore.setState({
      currentStep: "confirm",
      employeeIds: ["emp_1"],
      proofStatus: "success",
      submissionStatus: "idle",
    });

    renderHook(() => usePayrollRunProgress({ runId: "run_hook_2" }));

    expect(usePayrollRunProgressStore.getState().snapshot?.proofReady).toBe(true);
  });

  it("clears progress when submissionStatus becomes success", () => {
    // First record some progress
    act(() => {
      usePayrollRunProgressStore.getState().recordProgress("run_hook_3", "submit", 2, true, false);
    });

    usePayrollWizardStore.setState({
      currentStep: "submit",
      employeeIds: ["emp_1", "emp_2"],
      proofStatus: "success",
      submissionStatus: "success",
    });

    renderHook(() => usePayrollRunProgress({ runId: "run_hook_3" }));

    // Successful submission → snapshot cleared
    expect(usePayrollRunProgressStore.getState().snapshot).toBeNull();
  });

  it("does nothing when runId is null", () => {
    usePayrollWizardStore.setState({
      currentStep: "review",
      employeeIds: ["emp_1"],
      proofStatus: "idle",
      submissionStatus: "idle",
    });

    renderHook(() => usePayrollRunProgress({ runId: null }));

    expect(usePayrollRunProgressStore.getState().snapshot).toBeNull();
  });
});

// ── Component tests ──────────────────────────────────────────────────────────

describe("PayrollRunProgressBanner", () => {
  beforeEach(resetStores);

  it("renders nothing when there is no resumable run", () => {
    const { container } = render(
      <PayrollRunProgressBanner onResume={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the banner when a resumable snapshot exists", () => {
    act(() => {
      usePayrollRunProgressStore.getState().recordProgress(
        "run_banner_1",
        "proof",
        4,
        false,
        false,
      );
    });

    render(<PayrollRunProgressBanner onResume={vi.fn()} />);

    expect(
      screen.getByTestId("payroll-run-progress-banner"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Unfinished payroll run detected/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/4/)).toBeInTheDocument();
    expect(screen.getByText(/Generating ZK proof/i)).toBeInTheDocument();
  });

  it("shows proof-ready hint when proof was already generated", () => {
    act(() => {
      usePayrollRunProgressStore.getState().recordProgress(
        "run_banner_2",
        "confirm",
        2,
        true,  // proofReady
        false,
      );
    });

    render(<PayrollRunProgressBanner onResume={vi.fn()} />);

    expect(
      screen.getByText(/A ZK proof was generated for this batch/i),
    ).toBeInTheDocument();
  });

  it("calls onResume when the Resume button is clicked", () => {
    act(() => {
      usePayrollRunProgressStore.getState().recordProgress(
        "run_banner_3",
        "review",
        1,
        false,
        false,
      );
    });

    const handleResume = vi.fn();
    render(<PayrollRunProgressBanner onResume={handleResume} />);

    fireEvent.click(screen.getByRole("button", { name: /Resume run/i }));

    expect(handleResume).toHaveBeenCalledOnce();
  });

  it("clears the snapshot and hides the banner when Discard is clicked", () => {
    act(() => {
      usePayrollRunProgressStore.getState().recordProgress(
        "run_banner_4",
        "review",
        3,
        false,
        false,
      );
    });

    render(<PayrollRunProgressBanner onResume={vi.fn()} />);

    expect(screen.getByTestId("payroll-run-progress-banner")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Discard and dismiss/i }),
    );

    expect(usePayrollRunProgressStore.getState().snapshot).toBeNull();
  });

  it("does not render when the run is submitted (edge case)", () => {
    act(() => {
      usePayrollRunProgressStore.getState().recordProgress(
        "run_banner_5",
        "submit",
        2,
        true,
        true, // already submitted
      );
    });

    const { container } = render(
      <PayrollRunProgressBanner onResume={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
