import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { PayrollRun } from "@/types/models";
import {
  MOCK_AMENDMENTS,
  SalaryCommitmentAmendment,
} from "@/lib/sdk/amendments";
import {
  createPayrollRunAmendmentReview,
  assertOriginalRecordIntact,
} from "@/src/payroll/amendments";
import { PayrollRunAmendmentReview } from "@/components/payroll/PayrollRunAmendmentReview";

const mockOriginalRun: PayrollRun = {
  id: "pr_2025_03_main",
  companyId: "comp_001",
  totalAmount: 150000,
  employeeCount: 15,
  status: "verified",
  employeeIds: ["emp_1"],
  timestamp: "2025-03-01T10:00:00Z",
  proof: "0xproof",
  createdAt: "2025-03-01T10:00:00Z",
  updatedAt: "2025-03-01T10:00:00Z",
};

describe("Payroll Run Amendments Dashboard Support (#518)", () => {
  it("allows authorized users to review amendment details without overwriting original record (main path)", () => {
    const validAmendment = MOCK_AMENDMENTS[0]; // valid pending amendment
    const originalCopy = { ...mockOriginalRun };

    const review = createPayrollRunAmendmentReview(
      mockOriginalRun,
      validAmendment
    );

    expect(review.isOriginalPreserved).toBe(true);
    expect(review.originalRun.id).toBe(mockOriginalRun.id);
    expect(review.originalRun.totalAmount).toBe(mockOriginalRun.totalAmount);
    expect(review.amendment.id).toBe(validAmendment.id);

    // Ensure original object in parent state was not mutated
    expect(mockOriginalRun).toEqual(originalCopy);
  });

  it("asserts original record remains intact and detects destructive overwrites", () => {
    const mutatedRun: PayrollRun = {
      ...mockOriginalRun,
      totalAmount: 999999, // Attempted overwrite
    };

    const check = assertOriginalRecordIntact(mockOriginalRun, mutatedRun);
    expect(check.isIntact).toBe(false);
    expect(check.error).toContain(
      "Destructive action blocked: Original payroll record cannot be overwritten"
    );
  });

  it("handles stale amendment edge case with actionable warning and disabled approval", () => {
    const staleAmendment = MOCK_AMENDMENTS.find((a) => a.isStale)!;
    expect(staleAmendment).toBeDefined();

    const review = createPayrollRunAmendmentReview(
      mockOriginalRun,
      staleAmendment
    );

    expect(review.validation.canApprove).toBe(false);
    expect(review.warning).toContain("stale");

    render(
      <PayrollRunAmendmentReview
        originalRun={mockOriginalRun}
        amendment={staleAmendment}
      />
    );

    const warningEl = screen.getByTestId("amendment-review-warning");
    expect(warningEl).toBeInTheDocument();
    expect(warningEl.textContent).toMatch(/stale/i);
  });

  it("renders review component and triggers approve/reject callbacks while keeping salary private", () => {
    const validAmendment = MOCK_AMENDMENTS[0];
    const onApprove = vi.fn();
    const onReject = vi.fn();

    render(
      <PayrollRunAmendmentReview
        originalRun={mockOriginalRun}
        amendment={validAmendment}
        onApprove={onApprove}
        onReject={onReject}
      />
    );

    expect(
      screen.getByText("Payroll Run Amendment Review")
    ).toBeInTheDocument();
    expect(screen.getByText("Original Record Protected")).toBeInTheDocument();
    expect(screen.getByText("Salary values encrypted")).toBeInTheDocument();

    const approveBtn = screen.getByRole("button", { name: /approve amendment/i });
    fireEvent.click(approveBtn);
    expect(onApprove).toHaveBeenCalledWith(validAmendment.id);

    // Verify privacy rule: no raw salary numbers exposed in text output
    const containerText = screen.getByTestId(
      `payroll-amendment-review-${validAmendment.id}`
    ).textContent;
    expect(containerText).not.toContain("150000");
  });
});
