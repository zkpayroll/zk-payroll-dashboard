/**
 * @vitest-environment jsdom
 *
 * Tests for the failed payout retry diagnostics shown in the payroll failure
 * recovery center (issue #620).
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PayrollFailureRecoveryCenter from "@/components/features/payroll/PayrollFailureRecoveryCenter";
import type { PayrollRun } from "@/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PayrollFailureRecoveryCenter", () => {
  it("explains why the failed run failed and offers a retry", () => {
    render(<PayrollFailureRecoveryCenter />);

    expect(screen.getByText("Payroll failure recovery center")).toBeInTheDocument();
    expect(screen.getByText("Reconciliation failed")).toBeInTheDocument();
    expect(screen.getByText("Run tx_005")).toBeInTheDocument();

    const diagnostic = screen.getByTestId("retry-diagnostic-tx_005");
    expect(diagnostic).toHaveTextContent("Reconciliation failed.");
    expect(diagnostic).toHaveTextContent(
      "Reconciliation reported this payout as failed. Retry re-queues the run; review the reconciliation details first.",
    );
    expect(screen.getByRole("link", { name: "Review reconciliation" })).toHaveAttribute(
      "href",
      "/reconciliation",
    );

    expect(screen.getByTestId("retry-summary-tx_005")).toHaveTextContent(
      "Retry available — 3 of 3 attempts remaining.",
    );

    const retryButton = screen.getByRole("button", { name: "Retry" });
    expect(retryButton).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("disables further retries and reports exhaustion once attempts run out", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<PayrollFailureRecoveryCenter />);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const retryButton = screen.getByRole("button", { name: "Retry" });
      expect(retryButton).toBeEnabled();
      await user.click(retryButton);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(attempt));
      if (attempt < 3) {
        await waitFor(() =>
          expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled(),
        );
      }
    }

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled(),
    );

    const diagnostic = screen.getByTestId("retry-diagnostic-tx_005");
    expect(diagnostic).toHaveTextContent("Retry attempts exhausted.");
    expect(diagnostic).toHaveTextContent(
      "This run has used all of its retry attempts.",
    );
    expect(screen.getByRole("link", { name: "View history" })).toHaveAttribute(
      "href",
      "/history",
    );
    expect(screen.getByTestId("retry-summary-tx_005")).toHaveTextContent("Retry blocked —");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("surfaces an error when the retry request itself fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<PayrollFailureRecoveryCenter />);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByText("Failed to retry run tx_005. Please try again."),
    ).toBeInTheDocument();
  });

  it("records the retry decision before dispatching the recovery request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const onDecision = vi.fn();
    const user = userEvent.setup();

    render(<PayrollFailureRecoveryCenter onRetryPolicyDecision={onDecision} />);
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(onDecision).toHaveBeenCalledWith("tx_005", expect.objectContaining({ canRetry: true }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/payroll/tx_005",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("blocks a retry for a batch that already has a settlement receipt", async () => {
    const settledRun = {
      id: "tx_settled",
      companyId: "company_001",
      timestamp: "2025-05-31T09:00:00Z",
      createdAt: "2025-05-31T09:00:00Z",
      totalAmount: 100,
      employeeCount: 1,
      employeeIds: ["emp_001"],
      proof: "",
      status: "failed" as const,
      reconciliationStatus: "failed" as const,
      receiptId: "receipt_already_settled",
    } satisfies PayrollRun;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<PayrollFailureRecoveryCenter initialRuns={[settledRun]} />);
    const retryButton = screen.getByRole("button", { name: "Retry" });
    expect(retryButton).toBeDisabled();
    expect(retryButton).toHaveAttribute("title", expect.stringContaining("Retry blocked"));
    await user.click(retryButton);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
