import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { PayrollRun } from "@/types/models";
import {
  MOCK_AMENDMENTS,
  type SalaryCommitmentAmendment,
} from "@/lib/sdk/amendments";
import {
  createPayrollRunAmendmentReview,
  validateAmendmentDraft,
  type AmendmentDraftInput,
} from "@/src/payroll/amendments";
import { PayrollRunAmendmentReview } from "@/components/payroll/PayrollRunAmendmentReview";

const mockOriginalRun: PayrollRun = {
  id: "pr_2025_03_main",
  companyId: "comp_001",
  totalAmount: 150000,
  employeeCount: 15,
  status: "verified",
  employeeIds: ["emp_001"],
  timestamp: "2025-03-01T10:00:00Z",
  proof: "0xproof",
  createdAt: "2025-03-01T10:00:00Z",
  updatedAt: "2025-03-01T10:00:00Z",
};

function draftOverrides(
  base: SalaryCommitmentAmendment,
  overrides: Partial<AmendmentDraftInput>,
): AmendmentDraftInput {
  return {
    id: base.id,
    employeeId: base.employeeId,
    employeeReference: base.employeeReference,
    previousVersion: base.previousVersion,
    commitmentVersion: base.commitmentVersion,
    previousCommitment: base.previousCommitment,
    nextCommitment: base.nextCommitment,
    period: base.period,
    approvalStatus: base.approvalStatus,
    reason: base.reason,
    ...overrides,
  };
}

const validAmendment = MOCK_AMENDMENTS[0];

describe("Payroll run amendment draft validation (Issue #615)", () => {
  it("accepts a well-formed pending amendment draft", () => {
    const result = validateAmendmentDraft(
      draftOverrides(validAmendment, {}),
      mockOriginalRun,
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("flags missing commitment hashes, no-op commitments, and version skips with actionable errors", () => {
    const result = validateAmendmentDraft(
      draftOverrides(validAmendment, {
        previousCommitment: "",
        nextCommitment: "",
        commitmentVersion: validAmendment.previousVersion + 3,
      }),
      mockOriginalRun,
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Previous commitment hash is required/i);
    expect(result.errors.join(" ")).toMatch(/Next commitment hash is required/i);
    expect(result.errors.join(" ")).toMatch(/Commitment version must advance exactly one step/i);
  });

  it("blocks a no-op amendment where the commitment did not change", () => {
    const result = validateAmendmentDraft(
      draftOverrides(validAmendment, {
        nextCommitment: validAmendment.previousCommitment,
      }),
      mockOriginalRun,
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/No-op amendment blocked/i);
  });

  it("blocks non-pending amendments and employees outside the run roster (edge cases)", () => {
    const nonPending = validateAmendmentDraft(
      draftOverrides(validAmendment, { approvalStatus: "approved" }),
      mockOriginalRun,
    );
    expect(nonPending.isValid).toBe(false);
    expect(nonPending.errors.join(" ")).toMatch(/Only pending amendments/i);

    const outsider = validateAmendmentDraft(
      draftOverrides(validAmendment, { employeeId: "emp_unknown" }),
      mockOriginalRun,
    );
    expect(outsider.isValid).toBe(false);
    expect(outsider.errors.join(" ")).toMatch(/not part of payroll run/i);
  });

  it("warns (but does not block) when a rationale is missing", () => {
    const result = validateAmendmentDraft(
      draftOverrides(validAmendment, { reason: undefined }),
      mockOriginalRun,
    );

    expect(result.isValid).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/Add a rationale/i);
  });

  it("surfaces draft errors and keyboard-reachable actions in the review component", () => {
    const brokenAmendment: SalaryCommitmentAmendment = {
      ...validAmendment,
      commitmentVersion: validAmendment.previousVersion + 5,
      reason: undefined,
    };

    const review = createPayrollRunAmendmentReview(
      mockOriginalRun,
      brokenAmendment,
    );
    expect(review.draftValidation.isValid).toBe(false);

    const onApprove = vi.fn();
    render(
      <PayrollRunAmendmentReview
        originalRun={mockOriginalRun}
        amendment={brokenAmendment}
        onApprove={onApprove}
      />,
    );

    const errorBlock = screen.getByTestId("amendment-draft-errors");
    expect(errorBlock).toHaveAttribute("role", "alert");
    expect(errorBlock.textContent).toMatch(/Commitment version must advance/i);

    // Approve stays reachable via the keyboard toolbar even when the draft
    // is invalid; activation is the callback's responsibility.
    const approveBtn = screen.getByRole("button", { name: /approve amendment/i });
    fireEvent.click(approveBtn);
    expect(onApprove).toHaveBeenCalledWith(brokenAmendment.id);
  });
});
