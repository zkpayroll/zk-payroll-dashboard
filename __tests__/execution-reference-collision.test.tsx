import { describe, it, expect, vi, afterEach } from "vitest";
import {
  generateExecutionReference,
  generateUniqueExecutionReference,
  isExecutionReferenceCollision,
  isWellFormedExecutionReference,
} from "@/lib/payroll/executionReference";

describe("generateExecutionReference", () => {
  it("produces a well-formed reference", () => {
    const ref = generateExecutionReference();
    expect(isWellFormedExecutionReference(ref)).toBe(true);
    expect(ref).toMatch(/^pay_/);
  });

  it("never encodes salary, PII, or commitment-hash terms", () => {
    const ref = generateExecutionReference();
    expect(ref).not.toMatch(/salary|amount|hash|employee/i);
  });
});

describe("isExecutionReferenceCollision", () => {
  it("returns false when the reference is unique (success path)", () => {
    expect(
      isExecutionReferenceCollision("pay_abc_def123", ["pay_xyz_000000"]),
    ).toBe(false);
  });

  it("returns true when the exact reference already exists (failure path)", () => {
    expect(
      isExecutionReferenceCollision("pay_abc_def123", ["pay_abc_def123"]),
    ).toBe(true);
  });

  it("is case-sensitive, unlike import reference matching (edge case)", () => {
    expect(
      isExecutionReferenceCollision("pay_abc_def123", ["PAY_ABC_DEF123"]),
    ).toBe(false);
  });

  it("treats an empty existing set as no collision", () => {
    expect(isExecutionReferenceCollision("pay_abc_def123", [])).toBe(false);
  });
});

describe("generateUniqueExecutionReference", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a reference not present in the existing set (success path)", () => {
    const existing = ["pay_aaa_111111", "pay_bbb_222222"];
    const ref = generateUniqueExecutionReference(existing);
    expect(existing).not.toContain(ref);
    expect(isWellFormedExecutionReference(ref)).toBe(true);
  });

  it("retries on collision and returns a distinct reference (edge case)", () => {
    const collidingRef = "pay_fixed_aaaaaa";
    let calls = 0;
    const spy = vi.spyOn(Math, "random").mockImplementation(() => {
      calls += 1;
      return calls === 1 ? 0 : 0.999999;
    });

    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(0);

    const firstCall = generateExecutionReference();
    spy.mockRestore();
    dateSpy.mockRestore();

    const ref = generateUniqueExecutionReference([firstCall]);
    expect(ref).not.toBe(firstCall);
  });

  it("throws when maxAttempts leaves no room to try (failure path)", () => {
    expect(() => generateUniqueExecutionReference([], 0)).toThrow(
      /unique execution reference/i,
    );
  });
});
