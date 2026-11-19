import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ApprovalInvalidationError,
  assertApprovalStillValid,
  evaluateApprovalInvalidation,
  isApprovalInvalid,
  type ApprovalInvalidationInput,
} from "@/src/payroll/approvalInvalidation";
import ApprovalInvalidationPanel from "@/components/features/payroll/ApprovalInvalidationPanel";
import type { BatchRow } from "@/lib/payroll/batchDiff";

const NOW = Date.parse("2026-11-19T12:00:00Z");
const APPROVED_AT = "2026-11-18T12:00:00Z";

function row(overrides: Partial<BatchRow> = {}): BatchRow {
  return {
    employeeId: "emp_001",
    name: "Alice",
    walletAddress: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    assetCode: "USDC",
    salaryCommitment: "0xcommit_a",
    salaryAmount: 123456,
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<ApprovalInvalidationInput> = {},
): ApprovalInvalidationInput {
  return {
    hasApproval: true,
    approvalStatus: "approved",
    approvedAt: APPROVED_AT,
    currentRows: [row()],
    approvedRows: [row()],
    currentRevisionNumber: 2,
    approvedRevisionNumber: 2,
    expectedRevisionNumber: 2,
    ...overrides,
  };
}

describe("evaluateApprovalInvalidation", () => {
  it("keeps an unchanged approved batch valid", () => {
    const result = evaluateApprovalInvalidation(baseInput(), NOW);

    expect(result.invalid).toBe(false);
    expect(result.reason).toBeNull();
    expect(result.requiresReapproval).toBe(false);
  });

  it("invalidates an approval after a commitment rotation", () => {
    const result = evaluateApprovalInvalidation(
      baseInput({ currentRows: [row({ salaryCommitment: "0xrotated" })] }),
      NOW,
    );

    expect(result.invalid).toBe(true);
    expect(result.reason).toBe("commitment_changed");
    expect(result.blockedRowCount).toBe(1);
  });

  it("invalidates an approval after a recipient removal", () => {
    const result = evaluateApprovalInvalidation(
      baseInput({ currentRows: [], approvedRows: [row()] }),
      NOW,
    );

    expect(result.invalid).toBe(true);
    expect(result.reason).toBe("recipient_removed");
  });

  it("invalidates an approval when the current revision has moved", () => {
    const result = evaluateApprovalInvalidation(
      baseInput({ currentRevisionNumber: 3 }),
      NOW,
    );

    expect(result.invalid).toBe(true);
    expect(result.reason).toBe("stale_revision");
  });

  it("invalidates an approval with missing metadata", () => {
    const result = evaluateApprovalInvalidation(
      baseInput({ hasApproval: false, approvalStatus: null, approvedAt: null }),
      NOW,
    );

    expect(result.invalid).toBe(true);
    expect(result.reason).toBe("approval_missing");
  });

  it("exposes guard helpers for callers", () => {
    const invalidInput = baseInput({
      currentRows: [row({ salaryCommitment: "0xrotated" })],
    });

    expect(isApprovalInvalid(invalidInput, NOW)).toBe(true);
    expect(() => assertApprovalStillValid(invalidInput, NOW)).toThrow(
      ApprovalInvalidationError,
    );
    expect(() => assertApprovalStillValid(baseInput(), NOW)).not.toThrow();
  });
});

describe("ApprovalInvalidationPanel", () => {
  it("renders a blocking, privacy-safe state with recovery actions", () => {
    render(
      <ApprovalInvalidationPanel
        input={baseInput({
          currentRows: [row({ salaryCommitment: "0xrotated" })],
        })}
        now={NOW}
      />,
    );

    const panel = screen.getByTestId("approval-invalidation-panel");
    expect(panel.getAttribute("data-reason")).toBe("commitment_changed");
    expect(screen.getByTestId("approval-invalidation-invalid")).toBeTruthy();
    expect(screen.getByTestId("approval-invalidation-row-count")).toBeTruthy();
    expect(screen.getByTestId("approval-invalidation-review-link")).toBeTruthy();
    expect(panel.textContent).not.toContain("Alice");
    expect(panel.textContent).not.toContain("GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37");
    expect(panel.textContent).not.toContain("123456");
  });

  it("renders a non-blocking state when the approval is still valid", () => {
    render(<ApprovalInvalidationPanel input={baseInput()} now={NOW} />);

    expect(screen.getByTestId("approval-invalidation-valid")).toBeTruthy();
    expect(screen.queryByTestId("approval-invalidation-review-link")).toBeNull();
  });
});
