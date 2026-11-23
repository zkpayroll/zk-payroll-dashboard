import { describe, it, expect } from "vitest";
import {
  scorePayrollReadiness,
  getReadinessSignalLabel,
  type ReadinessScoreInput,
} from "@/src/payroll/readinessScoring";

describe("scorePayrollReadiness", () => {
  it("returns score 100 and ready when all signals pass", () => {
    const input: ReadinessScoreInput = {
      treasuryFunded: true,
      employeeRosterClean: true,
      approvalsMet: true,
      reconciliationClear: true,
      duplicateCheckPassed: true,
      networkReady: true,
      proofValid: true,
    };
    const result = scorePayrollReadiness(input);
    expect(result.score).toBe(100);
    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.pending).toHaveLength(0);
  });

  it("reduces score by signal weight for each failing signal", () => {
    const result = scorePayrollReadiness({ treasuryFunded: false });
    expect(result.score).toBe(75);
    expect(result.ready).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0].id).toBe("treasury_funded");
    expect(result.blockers[0].hint).toBeDefined();
  });

  it("marks signals as pending when input is null or undefined", () => {
    const result = scorePayrollReadiness({});
    expect(result.score).toBe(0);
    expect(result.ready).toBe(false);
    expect(result.pending).toHaveLength(7);
    expect(result.summary).toContain("pending");
  });

  it("includes hint only on fail and warn signals", () => {
    const result = scorePayrollReadiness({ treasuryFunded: true });
    const pass = result.signals.find((s) => s.id === "treasury_funded")!;
    expect(pass.hint).toBeUndefined();
  });

  it("summary mentions blocker count when blockers exist", () => {
    const result = scorePayrollReadiness({ treasuryFunded: false, approvalsMet: false });
    expect(result.summary).toMatch(/2 blockers/);
  });
});

describe("getReadinessSignalLabel", () => {
  it("returns human-readable label for known signal ids", () => {
    expect(getReadinessSignalLabel("treasury_funded")).toBe(
      "Treasury balance covers run total",
    );
  });

  it("returns the id itself for unknown ids", () => {
    expect(getReadinessSignalLabel("unknown_signal" as never)).toBe(
      "unknown_signal",
    );
  });
});
