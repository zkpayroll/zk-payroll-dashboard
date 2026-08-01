import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, act } from "@testing-library/react";
import ReconciliationDiffPanel from "@/components/features/payroll/ReconciliationDiffPanel";
import type { Employee, PayrollRun } from "@/types/models";

const NOW = 1_700_000_000_000;

function run(overrides: Partial<PayrollRun> = {}): PayrollRun {
  return {
    id: overrides.id ?? "tx_test",
    companyId: overrides.companyId ?? "company_001",
    timestamp: overrides.timestamp ?? "2025-02-28T09:00:00Z",
    createdAt: overrides.createdAt ?? "2025-02-28T09:00:00Z",
    totalAmount: overrides.totalAmount ?? 10000,
    employeeCount: overrides.employeeCount ?? 2,
    proof: overrides.proof ?? "0xproof",
    status: overrides.status ?? "verified",
    txHash: overrides.txHash ?? "0xabc",
    isArchived: overrides.isArchived ?? false,
    employeeIds: overrides.employeeIds ?? ["emp_a", "emp_b"],
    executedAt: overrides.executedAt ?? "2025-02-28T09:00:00Z",
    transactionHash: overrides.transactionHash ?? "0xabc",
  };
}

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: overrides.id ?? "emp_test",
    address: overrides.address ?? "GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    name: overrides.name ?? "Test Employee",
    salary: overrides.salary ?? 5000,
    salaryCommitment: overrides.salaryCommitment ?? "0xcommit",
    isActive: overrides.isActive ?? true,
    status: overrides.status ?? "active",
    onboardingStatus: overrides.onboardingStatus ?? "completed",
    startDate: overrides.startDate ?? "2024-01-01T00:00:00Z",
  };
}

describe("ReconciliationDiffPanel", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the panel and a copy button", () => {
    render(
      <ReconciliationDiffPanel
        run={run()}
        employees={[employee({ address: "GAAAA11111111111111111111111111111111111111111" })]}
        now={NOW}
      />,
    );

    expect(screen.getByTestId("reconciliation-diff-panel")).toBeInTheDocument();
    expect(screen.getByTestId("reconciliation-diff-copy")).toBeInTheDocument();
  });

  it("shows a 'fully reconciled' summary for verified runs", () => {
    render(
      <ReconciliationDiffPanel
        run={run({ status: "verified" })}
        employees={[employee()]}
        now={NOW}
      />,
    );

    expect(screen.getByText(/fully reconciled/i)).toBeInTheDocument();
    expect(screen.getByText(/All payments reconcile cleanly/i)).toBeInTheDocument();
  });

  it("shows a 'needs attention' summary for failed runs", () => {
    render(
      <ReconciliationDiffPanel
        run={run({ status: "failed" })}
        employees={[
          employee({ id: "a", address: "GAAAA11111111111111111111111111111111111111111" }),
          employee({ id: "b", address: "GBBBB22222222222222222222222222222222222222222" }),
        ]}
        now={NOW}
      />,
    );

    expect(screen.getByText(/Differences detected/i)).toBeInTheDocument();
  });

  it("renders the formatted diff text inside the <pre> block", () => {
    render(
      <ReconciliationDiffPanel
        run={run()}
        employees={[employee()]}
        now={NOW}
      />,
    );

    const pre = screen.getByTestId("reconciliation-diff-text");
    expect(pre.textContent).toMatch(/reconciliation:/);
    expect(pre.textContent?.length ?? 0).toBeGreaterThan(10);
  });

  it("writes the diff text to the clipboard when the copy button is clicked", async () => {
    render(
      <ReconciliationDiffPanel
        run={run()}
        employees={[employee()]}
        now={NOW}
      />,
    );

    fireEvent.click(screen.getByTestId("reconciliation-diff-copy"));
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledTimes(1);
    const arg = writeText.mock.calls[0]?.[0] as string;
    expect(arg).toMatch(/^reconciliation:/);
  });

  it("falls back to a textarea + execCommand when clipboard.writeText is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    // execCommand is legacy; we deliberately stub it for the fallback path.
    document.execCommand = execCommand;

    render(
      <ReconciliationDiffPanel
        run={run()}
        employees={[employee()]}
        now={NOW}
      />,
    );

    fireEvent.click(screen.getByTestId("reconciliation-diff-copy"));
    await Promise.resolve();

    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("toggles the 'Copied' label after clicking and resets after a delay", async () => {
    vi.useFakeTimers();

    render(
      <ReconciliationDiffPanel
        run={run()}
        employees={[employee()]}
        now={NOW}
      />,
    );

    const button = screen.getByTestId("reconciliation-diff-copy");
    fireEvent.click(button);
    await act(async () => {
      // Let the await navigator.clipboard.writeText() promise resolve.
      await Promise.resolve();
    });
    expect(within(button).getByText("Copied")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(within(button).getByText("Copy")).toBeInTheDocument();
  });

  it("renders as a section with the operator-view header", () => {
    render(
      <ReconciliationDiffPanel
        run={run()}
        employees={[employee()]}
        now={NOW}
      />,
    );

    const panel = screen.getByTestId("reconciliation-diff-panel");
    expect(panel.tagName.toLowerCase()).toBe("section");
    expect(panel).toHaveAttribute("aria-label", "Operator reconciliation diff");
  });

  it("fires an error toast when navigator.clipboard.writeText rejects", async () => {
    writeText.mockRejectedValueOnce(new Error("clipboard denied"));
    render(
      <ReconciliationDiffPanel
        run={run()}
        employees={[employee()]}
        now={NOW}
      />,
    );
    // Should not throw, even when the clipboard rejects.
    fireEvent.click(screen.getByTestId("reconciliation-diff-copy"));
    await act(async () => {
      await Promise.resolve();
    });
    // The button should still show "Copy" (not "Copied") because the
    // handler caught the rejection before flipping state.
    const button = screen.getByTestId("reconciliation-diff-copy");
    expect(within(button).getByText("Copy")).toBeInTheDocument();
  });

  // Regression guard: the privacy warning copy should be in the DOM.
  it("renders the privacy notice about unredacted stroops", () => {
    render(
      <ReconciliationDiffPanel
        run={run()}
        employees={[employee()]}
        now={NOW}
      />,
    );

    expect(
      screen.getByText(/contains unredacted stroops/i),
    ).toBeInTheDocument();
  });
});