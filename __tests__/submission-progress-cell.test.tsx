import { render, screen } from "@testing-library/react";
import SubmissionProgressCell from "@/components/stepper/SubmissionProgressCell";
import type { SubmissionProgressInput } from "@/src/payroll/submissionProgress";

const runInput = (
  overrides: Partial<Extract<SubmissionProgressInput, { source: "run" }>["run"]>,
): SubmissionProgressInput => ({
  source: "run",
  run: {
    status: "pending",
    approvalStatus: "draft",
    reconciliationStatus: undefined,
    cancellationReason: undefined,
    transactionHash: undefined,
    txHash: undefined,
    ...overrides,
  },
});

describe("SubmissionProgressCell", () => {
  it("renders six stage markers for an in-flight run", () => {
    render(<SubmissionProgressCell input={runInput({ txHash: "0xabc" })} />);

    for (const key of [
      "validation",
      "approval",
      "signing",
      "submission",
      "confirmation",
      "reconciliation",
    ]) {
      expect(screen.getByTestId(`progress-${key}`)).toBeInTheDocument();
    }
  });

  it("reflects stage states via data-state for an awaiting-confirmation run", () => {
    render(<SubmissionProgressCell input={runInput({ txHash: "0xabc" })} />);

    expect(screen.getByTestId("progress-validation")).toHaveAttribute("data-state", "complete");
    expect(screen.getByTestId("progress-signing")).toHaveAttribute("data-state", "complete");
    expect(screen.getByTestId("progress-confirmation")).toHaveAttribute("data-state", "active");
    expect(screen.getByTestId("progress-reconciliation")).toHaveAttribute("data-state", "pending");
  });

  it("marks the failed stage for a failed run", () => {
    render(<SubmissionProgressCell input={runInput({ status: "failed" })} />);

    expect(screen.getByTestId("progress-submission")).toHaveAttribute("data-state", "failed");
  });

  it("marks the skipped stage for a cancelled run (edge case)", () => {
    render(
      <SubmissionProgressCell
        input={runInput({ status: "cancelled", cancellationReason: "treasury_insufficient" })}
      />,
    );

    expect(screen.getByTestId("progress-validation")).toHaveAttribute("data-state", "skipped");
    expect(screen.getByTestId("progress-approval")).toHaveAttribute("data-state", "pending");
  });

  it("provides a screen-reader summary of the current stage", () => {
    render(<SubmissionProgressCell input={runInput({ approvalStatus: "rejected" })} />);

    expect(screen.getByText(/Failed at Approval/)).toBeInTheDocument();
  });

  it("privacy: never renders amounts, salaries, wallet addresses, proofs, or hashes", () => {
    const { container } = render(
      <SubmissionProgressCell
        input={runInput({
          status: "verified",
          approvalStatus: "approved",
          reconciliationStatus: "complete",
          transactionHash: "0xsecrettxhash123",
          txHash: "0xsecrettxhash123",
        })}
      />,
    );

    const text = container.textContent ?? "";
    expect(text).not.toMatch(/0xsecrettxhash123/i);
    expect(text).not.toMatch(/salary/i);
    expect(text).not.toMatch(/G[A-Z0-9]{55}/);
    expect(text).not.toMatch(/\$\s?\d/);
    expect(text).not.toMatch(/proof-hash/i);
  });
});
