/**
 * Tests for Feature 4: Resume Flow for Interrupted Batch Payrolls
 *
 * Covers:
 *  - BatchResumePanel renders run details (no raw salary amounts)
 *  - Resume button is disabled until acknowledgement is checked
 *  - Successful resume shows confirmation and calls onResumed
 *  - API error is surfaced without exposing payroll data
 *  - In-progress state is shown while the request is pending
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BatchResumePanel } from "@/components/features/batches/BatchResumePanel";
import type { PayrollRun } from "@/types/models";

// ─── Fixture ──────────────────────────────────────────────────────────────────

const INTERRUPTED_RUN: PayrollRun = {
  id: "run_interrupted_001",
  companyId: "company_001",
  timestamp: "2026-09-01T10:00:00Z",
  createdAt: "2026-09-01T10:00:00Z",
  // totalAmount intentionally present — must NOT be rendered in the panel
  totalAmount: 250000,
  employeeCount: 12,
  proof: "0xzkproof_test",
  status: "failed",
  employeeIds: ["emp_001", "emp_002"],
  reconciliationStatus: "failed",
  approvalHistory: [],
};

// Helper: click checkbox then resume button
async function checkAndResume(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("checkbox"));
  await user.click(
    screen.getByRole("button", {
      name: /resume interrupted batch payroll run/i,
    }),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BatchResumePanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the run ID and employee count", () => {
    render(<BatchResumePanel run={INTERRUPTED_RUN} />);
    expect(screen.getByText("run_interrupted_001")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("does not render the raw totalAmount", () => {
    render(<BatchResumePanel run={INTERRUPTED_RUN} />);
    // $250,000 must never appear in the panel
    expect(screen.queryByText(/250,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/250000/)).not.toBeInTheDocument();
  });

  it("renders the interrupted run status", () => {
    render(<BatchResumePanel run={INTERRUPTED_RUN} />);
    // Both status and reconciliationStatus are "failed" — use getAllByText
    const failedLabels = screen.getAllByText("failed");
    expect(failedLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("disables the Resume button when acknowledgement is unchecked", () => {
    render(<BatchResumePanel run={INTERRUPTED_RUN} />);
    // Before checking: aria-label signals the box needs to be checked
    const resumeBtn = screen.getByRole("button", {
      name: /resume run — check the acknowledgement box first/i,
    });
    expect(resumeBtn).toBeDisabled();
  });

  it("enables the Resume button after checking acknowledgement", async () => {
    const user = userEvent.setup();
    render(<BatchResumePanel run={INTERRUPTED_RUN} />);
    await user.click(screen.getByRole("checkbox"));
    // After acknowledging: aria-label changes to the full description
    const resumeBtn = screen.getByRole("button", {
      name: /resume interrupted batch payroll run/i,
    });
    expect(resumeBtn).not.toBeDisabled();
  });

  it("calls onResumed with the run ID after a successful API response", async () => {
    const user = userEvent.setup();
    const onResumed = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: "run_interrupted_001", status: "pending" },
        }),
      }),
    );

    render(<BatchResumePanel run={INTERRUPTED_RUN} onResumed={onResumed} />);
    await checkAndResume(user);

    await waitFor(() => {
      expect(onResumed).toHaveBeenCalledWith("run_interrupted_001");
    });
  });

  it("shows a success message after resuming", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: "run_interrupted_001", status: "pending" },
        }),
      }),
    );

    render(<BatchResumePanel run={INTERRUPTED_RUN} />);
    await checkAndResume(user);

    await waitFor(() => {
      expect(
        screen.getByText(/run_interrupted_001 resumed and re-queued/i),
      ).toBeInTheDocument();
    });
  });

  it("surfaces a safe error message on API failure without exposing payroll data", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: { message: 'Run cannot be resumed from status "cancelled".' },
        }),
      }),
    );

    render(<BatchResumePanel run={INTERRUPTED_RUN} />);
    await checkAndResume(user);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      // The error must not contain salary amounts
      expect(alert.textContent).not.toMatch(/\$\d/);
    });
  });

  it("shows in-progress label while the request is pending", async () => {
    const user = userEvent.setup();
    // Never resolves so we can inspect the loading state
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(<BatchResumePanel run={INTERRUPTED_RUN} />);
    await checkAndResume(user);

    expect(await screen.findByText(/resuming…/i)).toBeInTheDocument();
  });

  it("hint text warns against including salary amounts in the note", () => {
    render(<BatchResumePanel run={INTERRUPTED_RUN} />);
    expect(
      screen.getByText(/do not include raw salary amounts or wallet keys/i),
    ).toBeInTheDocument();
  });
});
