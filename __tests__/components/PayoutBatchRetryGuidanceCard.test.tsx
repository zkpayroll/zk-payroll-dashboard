import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PayoutBatchRetryGuidanceCard } from "@/components/features/payroll/PayoutBatchRetryGuidanceCard";
import { evaluatePayoutBatchRetryGuidance } from "@/lib/payroll/payoutBatchRetryGuidance";

describe("PayoutBatchRetryGuidanceCard", () => {
  it("renders permitted retry guidance with attempts and next steps", () => {
    const guidance = evaluatePayoutBatchRetryGuidance({
      payrollId: "run_test_001",
      attempt: 1,
      maxAttempts: 3,
    });

    render(<PayoutBatchRetryGuidanceCard guidance={guidance} />);

    expect(
      screen.getByTestId("payout-batch-retry-guidance-card"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("retry-outcome-badge")).toHaveTextContent(
      "Retry permitted",
    );
    expect(screen.getByText("run_test_001")).toBeInTheDocument();
    expect(screen.getByTestId("retry-guidance-text")).toHaveTextContent(
      /2 attempt\(s\) remaining/i,
    );
    expect(
      screen.getByTestId("retry-guidance-next-steps"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Attempts remaining: 2/i)).toBeInTheDocument();
  });

  it("renders blocked retry guidance with remediation action link", () => {
    const guidance = evaluatePayoutBatchRetryGuidance({
      payrollId: "run_test_paused",
      isMutationDisabled: true,
      pauseReason: "Admin emergency",
    });

    const onAction = vi.fn();

    render(
      <PayoutBatchRetryGuidanceCard
        guidance={guidance}
        onActionClick={onAction}
      />,
    );

    expect(screen.getByTestId("retry-outcome-badge")).toHaveTextContent(
      "Retry blocked",
    );
    expect(screen.getByTestId("retry-guidance-text")).toHaveTextContent(
      /Review pause status in Admin Settings/i,
    );

    const remediationLink = screen.getByTestId("retry-remediation-link");
    expect(remediationLink).toHaveAttribute("href", "/admin");
    expect(remediationLink).toHaveTextContent(
      "Review Pause Status in Admin Settings",
    );

    fireEvent.click(remediationLink);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("renders deferred retry guidance when max retries are exceeded", () => {
    const guidance = evaluatePayoutBatchRetryGuidance({
      payrollId: "run_test_exhausted",
      attempt: 4,
      maxAttempts: 3,
    });

    render(<PayoutBatchRetryGuidanceCard guidance={guidance} />);

    expect(screen.getByTestId("retry-outcome-badge")).toHaveTextContent(
      "Retry deferred",
    );
    expect(screen.getByTestId("retry-guidance-text")).toHaveTextContent(
      /Retry attempts exhausted/i,
    );
    const remediationLink = screen.getByTestId("retry-remediation-link");
    expect(remediationLink).toHaveAttribute("href", "/payroll/reconciliation");
  });
});
