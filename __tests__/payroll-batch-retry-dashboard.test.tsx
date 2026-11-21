import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PayrollDashboardPage from "@/app/payroll/page";

// Mock router / navigation if needed
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/payroll",
  useParams: () => ({ id: "tx_001" }),
}));

describe("PayrollDashboardPage - Payout Batch Retry Guidance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty retry decisions container with clear guidance placeholder", () => {
    render(<PayrollDashboardPage />);

    expect(screen.getByTestId("retry-decision-log")).toBeInTheDocument();
    expect(
      screen.getByText(
        /No retry decisions recorded yet\. Retry evaluations will appear here with privacy-safe identifiers and actionable operator guidance\./i,
      ),
    ).toBeInTheDocument();
  });

  it("logs retry decision with clear guidance for a settled run", async () => {
    const user = userEvent.setup();
    render(<PayrollDashboardPage />);

    // In MOCK_PAYROLL_RUNS, tx_001 is verified / settled
    const retryBtn = screen.getByTestId("retry-decision-tx_001");
    expect(retryBtn).toBeInTheDocument();

    await user.click(retryBtn);

    const logEntry = screen.getByTestId("retry-decision-entry");
    expect(logEntry).toBeInTheDocument();
    expect(logEntry).toHaveTextContent("Retry blocked");
    expect(logEntry).toHaveTextContent("ALREADY_SETTLED");

    const guidanceText = screen.getByTestId("retry-guidance-text-tx_001");
    expect(guidanceText).toHaveTextContent(
      /Retry blocked — this payout already has a settlement receipt/i,
    );

    const nextSteps = screen.getByTestId("retry-guidance-next-steps-tx_001");
    expect(nextSteps).toHaveTextContent(
      /Verify on-chain settlement details in Transaction History/i,
    );

    const remediationLink = screen.getByRole("link", {
      name: /View Settlement History/i,
    });
    expect(remediationLink).toHaveAttribute("href", "/history");
  });

  it("logs retry decision with clear guidance for a cancelled run", async () => {
    const user = userEvent.setup();
    render(<PayrollDashboardPage />);

    const retryBtn = screen.getByTestId("retry-decision-tx_004");
    expect(retryBtn).toBeInTheDocument();

    await user.click(retryBtn);

    const guidanceText = screen.getByTestId("retry-guidance-text-tx_004");
    expect(guidanceText).toHaveTextContent(
      /Cancelled payroll runs cannot be retried/i,
    );

    const retryLog = screen.getByTestId("retry-decision-log");
    const remediationLink = within(retryLog).getByRole("link", {
      name: /Create Draft Batch/i,
    });
    expect(remediationLink).toHaveAttribute("href", "/payroll/create");
  });

  it("increments retry attempts and defers when exceeding max limit", async () => {
    const user = userEvent.setup();
    render(<PayrollDashboardPage />);

    // Click tx_003 (pending) 4 times to exceed max retries (3)
    const retryBtn = screen.getByTestId("retry-decision-tx_003");
    expect(retryBtn).toBeInTheDocument();

    // 1st click -> attempt 1
    await user.click(retryBtn);
    // 2nd click -> attempt 2
    await user.click(retryBtn);
    // 3rd click -> attempt 3
    await user.click(retryBtn);
    // 4th click -> attempt 4 (exceeded)
    await user.click(retryBtn);

    const entries = screen.getAllByTestId("retry-decision-entry");
    expect(entries.length).toBe(4);

    // Latest entry at the top should be deferred
    expect(entries[0]).toHaveTextContent("Retry deferred");
    expect(entries[0]).toHaveTextContent("MAX_ATTEMPTS_EXCEEDED");
    expect(entries[0]).toHaveTextContent("attempt 4 of 3");

    const guidanceText = screen.getAllByTestId("retry-guidance-text-tx_003")[0];
    expect(guidanceText).toHaveTextContent(
      /Retry attempts exhausted \(3 of 3 used\)\. Automated retries are deferred to protect payroll integrity/i,
    );
  });
});
