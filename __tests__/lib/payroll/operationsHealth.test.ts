import { describe, expect, it } from "vitest";
import {
  scorePayrollOperationsHealth,
  type PayrollHealthRun,
} from "@/lib/payroll/operationsHealth";

const NOW = new Date("2026-06-30T12:00:00Z");

function run(
  id: string,
  status: PayrollHealthRun["status"],
  daysAgo: number,
  overrides: Partial<PayrollHealthRun> = {},
): PayrollHealthRun {
  return {
    id,
    status,
    timestamp: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    totalAmount: 9_500,
    reconciliationStatus: status === "verified" ? "matched" : "pending",
    ...overrides,
  };
}

const HEALTHY_RUNS = [
  run("r1", "verified", 1),
  run("r2", "verified", 31),
  run("r3", "verified", 61),
  run("r4", "pending", 1),
];

describe("scorePayrollOperationsHealth", () => {
  it("scores settled runs with a funded treasury as healthy", () => {
    const result = scorePayrollOperationsHealth({
      runs: HEALTHY_RUNS,
      treasuryBalance: 45_000,
      nextRunAmount: 19_500,
      now: NOW,
    });

    expect(result.kind).toBe("scored");
    expect(result.score).toBe(100);
    expect(result.band).toBe("healthy");
    expect(result.factors).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(result.runsEvaluated).toBe(4);
  });

  it("flags failed runs and an underfunded treasury as critical with actionable factors", () => {
    const result = scorePayrollOperationsHealth({
      runs: [
        run("r1", "failed", 2, { reconciliationStatus: "failed" }),
        run("r2", "failed", 10),
        run("r3", "failed", 20),
        run("r4", "verified", 40),
        run("r5", "pending", 5),
      ],
      treasuryBalance: 5_000,
      nextRunAmount: 19_500,
      now: NOW,
    });

    expect(result.kind).toBe("scored");
    // 100 - 45 (failed) - 35 (underfunded) - 10 (stuck pending) - 5 (reconciliation)
    expect(result.score).toBe(5);
    expect(result.band).toBe("critical");

    const ids = result.factors.map((f) => f.id);
    expect(ids).toEqual([
      "failed_runs",
      "underfunded_next_run",
      "stuck_pending_runs",
      "reconciliation_issues",
    ]);

    const failed = result.factors[0];
    expect(failed.severity).toBe("critical");
    expect(failed.message).toBe(
      "3 failed payroll runs in the last 5 runs. Review and retry them from the recovery center.",
    );
    expect(failed.action?.href).toBe("/payroll/recovery");

    const funding = result.factors[1];
    expect(funding.severity).toBe("critical");
    expect(funding.message).toContain("covers less than the next payroll run");
    expect(funding.message).toContain("Add at least 14,500");
    expect(funding.action?.href).toBe("/treasury");
  });

  it("forces the critical band when the treasury cannot cover the next run, even with a high score", () => {
    const result = scorePayrollOperationsHealth({
      runs: HEALTHY_RUNS,
      treasuryBalance: 10_000,
      nextRunAmount: 19_500,
      now: NOW,
    });

    expect(result.score).toBe(65);
    expect(result.band).toBe("critical");
  });

  it("warns when the balance covers the next run but is below the reserve buffer", () => {
    const result = scorePayrollOperationsHealth({
      runs: HEALTHY_RUNS,
      treasuryBalance: 20_000,
      nextRunAmount: 19_500,
      now: NOW,
    });

    expect(result.score).toBe(90);
    expect(result.band).toBe("warning");
    expect(result.factors.map((f) => f.id)).toEqual(["low_funding_buffer"]);
  });

  it("only evaluates the most recent runs and never drops below 0", () => {
    const manyFailures = Array.from({ length: 12 }, (_, i) =>
      run(`f${i}`, "failed", i, { reconciliationStatus: "mismatched" }),
    );
    const result = scorePayrollOperationsHealth(
      { runs: [...manyFailures, run("p1", "paused", 1), run("p2", "paused", 2)], treasuryBalance: 0, nextRunAmount: 100, now: NOW },
      { lookbackRuns: 10 },
    );

    expect(result.runsEvaluated).toBe(10);
    expect(result.score).toBe(0);
    expect(result.band).toBe("critical");
  });

  describe("edge cases", () => {
    it("returns insufficient data with no score when there are no runs", () => {
      for (const runs of [[], null, undefined]) {
        const result = scorePayrollOperationsHealth({ runs, now: NOW });
        expect(result.kind).toBe("insufficient_data");
        expect(result.score).toBeNull();
        expect(result.band).toBeNull();
        expect(result.runsEvaluated).toBe(0);
        if (result.kind === "insufficient_data") {
          expect(result.reason).toMatch(/No payroll runs recorded yet/);
        }
      }
    });

    it("excludes malformed runs and invalid funding values without producing NaN", () => {
      const result = scorePayrollOperationsHealth({
        runs: [
          run("bad-date", "verified", 1, { timestamp: "not-a-date" }),
          run("bad-status", "unknown" as PayrollHealthRun["status"], 1),
          run("ok", "verified", 1),
        ],
        treasuryBalance: Number.NaN,
        nextRunAmount: -5,
        now: NOW,
      });

      expect(result.kind).toBe("scored");
      expect(Number.isNaN(result.score)).toBe(false);
      expect(result.score).toBe(100);
      expect(result.runsEvaluated).toBe(1);
      expect(result.issues).toEqual([
        "Payroll run bad-date has an invalid timestamp and was excluded from the score.",
        "Payroll run bad-status has an unknown status and was excluded from the score.",
        "Treasury balance must be a non-negative number; funding was excluded from the score.",
        "Next payroll run amount must be a non-negative number; funding was excluded from the score.",
      ]);
      expect(result.factors.map((f) => f.id)).toEqual(["funding_unavailable"]);
      expect(result.band).toBe("healthy");
    });

    it("reports insufficient data when every run is invalid", () => {
      const result = scorePayrollOperationsHealth({
        runs: [run("bad", "verified", 1, { timestamp: "" })],
        now: NOW,
      });

      expect(result.kind).toBe("insufficient_data");
      expect(result.score).toBeNull();
      if (result.kind === "insufficient_data") {
        expect(result.reason).toMatch(/No valid payroll runs/);
      }
      expect(result.issues).toHaveLength(1);
    });

    it("does not penalise funding when no next run is scheduled", () => {
      const result = scorePayrollOperationsHealth({
        runs: HEALTHY_RUNS,
        treasuryBalance: 0,
        nextRunAmount: 0,
        now: NOW,
      });

      expect(result.score).toBe(100);
      expect(result.factors).toEqual([]);
    });
  });
});
