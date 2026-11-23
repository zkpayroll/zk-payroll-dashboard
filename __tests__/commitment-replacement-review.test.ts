import { describe, it, expect } from "vitest";
import {
  reviewCommitmentReplacement,
  COMMITMENT_CHANGE_KIND_LABELS,
} from "@/lib/employees/commitmentReplacementReview";
import type { Employee } from "@/types/models";

const baseEmployee: Employee = {
  id: "emp_001",
  address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQR",
  name: "Jane Doe",
  email: "jane@example.com",
  salary: 125000,
  salaryCommitment: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  isActive: true,
  onboardingStatus: "complete",
  startDate: "2024-01-01T00:00:00Z",
};

describe("reviewCommitmentReplacement", () => {
  it("accepts a commitment-only replacement (success path)", () => {
    const result = reviewCommitmentReplacement({
      employee: baseEmployee,
      nextCommitment: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.review.changeKind).toBe("commitment_only");
    expect(result.review.walletChanged).toBe(false);
    expect(result.review.previousCommitmentPreview).toBe("0xaaaaaaaa…");
    expect(result.review.nextCommitmentPreview).toBe("0xbbbbbbbb…");
    expect(COMMITMENT_CHANGE_KIND_LABELS[result.review.changeKind]).toBe(
      "Salary commitment hash",
    );
  });

  it("accepts a combined commitment + wallet replacement and previews both", () => {
    const result = reviewCommitmentReplacement({
      employee: baseEmployee,
      nextCommitment: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      nextAddress: "GZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.review.changeKind).toBe("commitment_and_wallet");
    expect(result.review.walletChanged).toBe(true);
    expect(result.review.previousWalletPreview).toBeDefined();
    expect(result.review.nextWalletPreview).toBeDefined();
  });

  it("accepts a wallet-only replacement when the commitment is unchanged", () => {
    const result = reviewCommitmentReplacement({
      employee: baseEmployee,
      nextCommitment: baseEmployee.salaryCommitment,
      nextAddress: "GZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.review.changeKind).toBe("wallet_only");
  });

  it("rejects when the employee cannot be found (failure path)", () => {
    const result = reviewCommitmentReplacement({
      employee: undefined,
      nextCommitment: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error result");
    expect(result.error.code).toBe("EMPLOYEE_NOT_FOUND");
  });

  it("rejects an empty commitment (boundary: whitespace only)", () => {
    const result = reviewCommitmentReplacement({
      employee: baseEmployee,
      nextCommitment: "   ",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error result");
    expect(result.error.code).toBe("COMMITMENT_EMPTY");
  });

  it("rejects a malformed/too-short commitment (boundary)", () => {
    const result = reviewCommitmentReplacement({
      employee: baseEmployee,
      nextCommitment: "0x1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error result");
    expect(result.error.code).toBe("COMMITMENT_MALFORMED");
  });

  it("rejects a no-op replacement where nothing actually changed (boundary)", () => {
    const result = reviewCommitmentReplacement({
      employee: baseEmployee,
      nextCommitment: baseEmployee.salaryCommitment,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error result");
    expect(result.error.code).toBe("COMMITMENT_UNCHANGED");
  });

  it("rejects a no-op replacement even when the same wallet address is explicitly re-sent", () => {
    const result = reviewCommitmentReplacement({
      employee: baseEmployee,
      nextCommitment: baseEmployee.salaryCommitment,
      nextAddress: baseEmployee.address,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error result");
    expect(result.error.code).toBe("COMMITMENT_UNCHANGED");
  });

  it("never includes the raw salary number in a successful review result", () => {
    const result = reviewCommitmentReplacement({
      employee: baseEmployee,
      nextCommitment: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    expect(result.ok).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("125000");
  });

  it("never includes the raw salary number in a rejection result", () => {
    const result = reviewCommitmentReplacement({
      employee: baseEmployee,
      nextCommitment: "",
    });
    expect(result.ok).toBe(false);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("125000");
  });

  it("truncates long commitment hashes for display", () => {
    const result = reviewCommitmentReplacement({
      employee: baseEmployee,
      nextCommitment: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.review.nextCommitmentPreview.length).toBeLessThanOrEqual(11);
  });
});
