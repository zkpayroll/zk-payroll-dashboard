import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PayrollSubmissionStepper from "@/components/stepper/PayrollSubmissionStepper";
import type { SubmissionProgressInput } from "@/src/payroll/submissionProgress";

const wizardInput: SubmissionProgressInput = {
  source: "wizard",
  currentStep: "submit",
  proofStatus: "success",
  submissionStatus: "submitting",
  failedStage: null,
};

describe("PayrollSubmissionStepper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all six stages with an accessible nav label", () => {
    render(<PayrollSubmissionStepper input={wizardInput} />);

    expect(
      screen.getByRole("navigation", { name: /payroll submission progress/i }),
    ).toBeInTheDocument();
    for (const label of [
      "Validation",
      "Approval",
      "Signing",
      "Submission",
      "Confirmation",
      "Reconciliation",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks complete stages and the active stage via data attributes", () => {
    render(<PayrollSubmissionStepper input={wizardInput} />);

    expect(screen.getByTestId("stage-validation")).toHaveAttribute(
      "data-state",
      "complete",
    );
    expect(screen.getByTestId("stage-signing")).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByTestId("stage-reconciliation")).toHaveAttribute(
      "data-state",
      "pending",
    );
  });

  it("marks the failed stage and keeps later stages pending", () => {
    render(
      <PayrollSubmissionStepper
        input={{
          source: "wizard",
          currentStep: "submit",
          proofStatus: "success",
          submissionStatus: "error",
          failedStage: null,
        }}
      />,
    );

    expect(screen.getByTestId("stage-submission")).toHaveAttribute(
      "data-state",
      "failed",
    );
    expect(screen.getByTestId("stage-confirmation")).toHaveAttribute(
      "data-state",
      "pending",
    );
  });

  it("marks a cancelled run's stage as skipped (edge case)", () => {
    render(
      <PayrollSubmissionStepper
        input={{
          source: "run",
          run: {
            status: "cancelled",
            approvalStatus: "approved",
            reconciliationStatus: undefined,
            cancellationReason: "approval_rejected",
            transactionHash: undefined,
            txHash: undefined,
          },
        }}
      />,
    );

    expect(screen.getByTestId("stage-approval")).toHaveAttribute(
      "data-state",
      "skipped",
    );
    expect(screen.getByTestId("stage-signing")).toHaveAttribute(
      "data-state",
      "pending",
    );
  });

  it("renders all-complete state for a settled run", () => {
    render(
      <PayrollSubmissionStepper
        input={{
          source: "run",
          run: {
            status: "verified",
            approvalStatus: "approved",
            reconciliationStatus: "complete",
            cancellationReason: undefined,
            transactionHash: "0xabc",
            txHash: "0xabc",
          },
        }}
      />,
    );

    for (const key of [
      "validation",
      "approval",
      "signing",
      "submission",
      "confirmation",
      "reconciliation",
    ]) {
      expect(screen.getByTestId(`stage-${key}`)).toHaveAttribute(
        "data-state",
        "complete",
      );
    }
  });

  it("renders in compact mode without descriptions", () => {
    render(
      <PayrollSubmissionStepper input={wizardInput} compact hideDescriptions />,
    );

    expect(screen.queryByText(/Run data, treasury/)).not.toBeInTheDocument();
    expect(screen.getByText("Validation")).toBeInTheDocument();
  });
});

describe("PayrollSubmissionStepper privacy", () => {
  it("never renders amounts, employee data, wallet addresses, proofs, or hashes", () => {
    const { container } = render(
      <PayrollSubmissionStepper
        input={{
          source: "run",
          run: {
            status: "verified",
            approvalStatus: "approved",
            reconciliationStatus: "complete",
            cancellationReason: undefined,
            transactionHash: "0xsecrettxhash123",
            txHash: "0xsecrettxhash123",
          },
        }}
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
