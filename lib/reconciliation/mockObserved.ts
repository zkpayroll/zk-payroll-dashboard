/**
 * Synthesizes the inputs the SDK reconciliation helpers need from the
 * dashboard's existing mock payroll-run + employee data.
 *
 * The dashboard does not (yet) call the live SDK. To make the new
 * `generateReconciliationDiff` / `formatReconciliationDiff` helpers
 * useful in the reconciliation panel today, this module builds:
 *
 *   - an "expected" outcomes list (what the client recorded for each
 *     employee in the run), and
 *   - a synthesized "observed" on-chain state whose categories
 *     reflect the run's status.
 *
 * Behaviour by `run.status`:
 *
 *   - `"verified"`  → every employee observed as confirmed → all `match`
 *   - `"pending"`   → every employee observed as not_found → all `missing`
 *   - `"failed"`    → first employee observed as confirmed (status
 *                     mismatch), the rest as not_found (missing) so the
 *                     operator can see both categories at once
 *   - `"cancelled"` → all observed as not_found → all `missing`
 *
 * All amounts are converted from the dashboard's dollars (number) to
 * the SDK's stroops (bigint) at the helper boundary so the rest of the
 * stack stays unit-clean.
 */
import type {
  ObservedPaymentState,
  ReconciliationDiffResult,
} from "./types";
import { generateReconciliationDiff } from "./ReconciliationDiffGenerator";
import type { Employee, PayrollRun } from "@/types/models";

const STROOPS_PER_DOLLAR = BigInt(10_000_000);
const DEMO_ASSET = "native";

function toStroops(dollars: number): bigint {
  return BigInt(Math.round(dollars * Number(STROOPS_PER_DOLLAR)));
}

export interface SynthesizedReconciliation {
  expected: Parameters<typeof generateReconciliationDiff>[0];
  observed: ObservedPaymentState[];
}

export function synthesizeReconciliation(
  run: PayrollRun,
  employees: Employee[],
  now: number = Date.now(),
): SynthesizedReconciliation {
  const results = employees.map((emp) => ({
    recipient: emp.address,
    amount: toStroops(emp.salary),
    asset: DEMO_ASSET,
    status:
      run.status === "verified"
        ? ("success" as const)
        : run.status === "failed"
          ? ("failure" as const)
          : ("pending" as const),
    txHash: run.transactionHash ?? undefined,
  }));

  const observed: ObservedPaymentState[] = employees.map((emp, idx) => {
    const base = {
      recipient: emp.address,
      amount: toStroops(emp.salary),
      asset: DEMO_ASSET,
      observedAt: now,
    } as const;

    if (run.status === "verified") {
      return { ...base, onChainStatus: "confirmed" as const };
    }
    if (run.status === "failed") {
      // First employee: client says it failed but chain shows it confirmed
      // (duplicate-submission / stale-client pattern).
      if (idx === 0) {
        return { ...base, onChainStatus: "confirmed" as const };
      }
      return { ...base, onChainStatus: "not_found" as const };
    }
    return { ...base, onChainStatus: "not_found" as const };
  });

  return { expected: { results }, observed };
}

/**
 * Convenience wrapper that runs synthesis + diff generation. The UI calls
 * `formatReconciliationDiff(result)` separately so the formattable string
 * can be recomputed lazily and cached.
 */
export function buildReconciliationDiff(
  run: PayrollRun,
  employees: Employee[],
  now: number = Date.now(),
): ReconciliationDiffResult {
  const { expected, observed } = synthesizeReconciliation(run, employees, now);
  return generateReconciliationDiff(expected, observed);
}