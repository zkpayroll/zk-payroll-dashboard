import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { createPayrollDraftChecksum, matchesReviewedPayrollDraft } from "@/lib/payroll/draftChecksum";
import type { Employee } from "@/types/models";

const employee = (overrides: Partial<Employee> = {}): Employee => ({
  id: "emp-private-01",
  address: "GPRIVATEWALLETADDRESS",
  name: "Private Employee",
  salary: 5000,
  salaryCommitment: "commitment-a",
  isActive: true,
  onboardingStatus: "completed",
  startDate: "2025-01-01T00:00:00Z",
  ...overrides,
});

describe("createPayrollDraftChecksum", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));
  afterEach(() => vi.unstubAllGlobals());

  it("is stable when the same reviewed rows arrive in a different order", async () => {
    const other = employee({ id: "emp-private-02", salaryCommitment: "commitment-c" });
    const first = await createPayrollDraftChecksum(["emp-private-01", "emp-private-02"], [employee(), other], 10000);
    const second = await createPayrollDraftChecksum(["emp-private-02", "emp-private-01"], [other, employee()], 10000);
    expect(first).toBe(second);
    expect(first).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first).not.toContain("emp-private-01");
    expect(first).not.toContain("GPRIVATE");
  });

  it("changes when payroll commitments or aggregate values change", async () => {
    const baseline = await createPayrollDraftChecksum(["emp-private-01"], [employee()], 5000);
    const changed = await createPayrollDraftChecksum(
      ["emp-private-01"],
      [employee({ salaryCommitment: "commitment-b" })],
      5100,
    );
    expect(changed).not.toBe(baseline);
  });

  it("rejects a draft with missing employee records", async () => {
    await expect(createPayrollDraftChecksum(["missing"], [employee()], 5000)).rejects.toThrow(/records are unavailable/i);
  });

  it("requires a non-empty matching reviewed checksum before submission", () => {
    expect(matchesReviewedPayrollDraft("sha256:abc", "sha256:abc")).toBe(true);
    expect(matchesReviewedPayrollDraft("sha256:abc", "sha256:def")).toBe(false);
    expect(matchesReviewedPayrollDraft(null, "sha256:def")).toBe(false);
  });
});
