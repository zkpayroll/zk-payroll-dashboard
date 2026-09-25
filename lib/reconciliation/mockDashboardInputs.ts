/**
 * Mock input data for the reconciliation dashboard.
 *
 * Adapts the app's existing payroll-run, lock, funding-reservation, and
 * multi-asset mock fixtures (`lib/api/mockData.ts`) into the reconciliation
 * SDK's period/run/asset input shapes (`lib/sdk/reconciliation.ts`). Kept
 * separate from `mockData.ts` because the reconciliation dashboard groups
 * and labels this data differently (by period and by asset) than the
 * screens that already consume those fixtures directly.
 *
 * Only ever reads aggregate fields (`totalAmount`, `group.totalAmount`) —
 * never an asset group's per-employee `employees[]` list — so no raw
 * salary or payment amount can leak into the dashboard.
 */

import {
  MOCK_PAYROLL_RUNS,
  MOCK_MULTI_ASSET_RUNS,
  MOCK_PAYROLL_LOCKS,
  MOCK_FUNDING_RESERVATIONS,
} from "@/lib/api/mockData";
import { buildReconciliation, assetLabel } from "@/lib/payroll/multiAsset";
import { formatPeriodId, formatPeriodLabel } from "@/lib/date/periodLabel";
import type {
  ReconciliationAssetAmount,
  ReconciliationBlocker,
  ReconciliationPeriodInput,
  ReconciliationRunInput,
} from "@/lib/sdk/reconciliation";

/**
 * Local, minimal dispute fixture for the reconciliation dashboard.
 *
 * Deliberately not imported from `lib/api/mockData`'s `MOCK_PAYROLL_DISPUTES`
 * (or its `PayrollDispute` type): `types/models.ts` currently declares two
 * incompatible `PayrollDispute` interfaces that merge into one (a pre-existing
 * defect unrelated to this feature), so any consumer of that type inherits
 * the ambiguity. Values below mirror `MOCK_PAYROLL_DISPUTES` for consistency.
 */
const MOCK_RECONCILIATION_DISPUTES: Array<{
  id: string;
  payrollRunId: string;
  reason: string;
  isResolved: boolean;
}> = [
  {
    id: "dsp_001",
    payrollRunId: "tx_002",
    reason: "Reported amount does not match agreed contract rate for March.",
    isResolved: false,
  },
  {
    id: "dsp_002",
    payrollRunId: "tx_004",
    reason: "Missing overtime hours for the last week of the period.",
    isResolved: true,
  },
];

const NATIVE_ASSET = { code: "XLM" } as const;

function legacyRunAssetAmount(
  status: string,
  totalAmount: number,
): ReconciliationAssetAmount {
  if (status === "verified") {
    return { asset: NATIVE_ASSET, liability: totalAmount, settled: totalAmount, outstanding: 0 };
  }
  if (status === "cancelled") {
    return { asset: NATIVE_ASSET, liability: 0, settled: 0, outstanding: 0 };
  }
  // "pending" | "failed" — committed liability that hasn't settled yet.
  return { asset: NATIVE_ASSET, liability: totalAmount, settled: 0, outstanding: totalAmount };
}

function buildLegacyRunInputs(): ReconciliationRunInput[] {
  return MOCK_PAYROLL_RUNS.map((run) => {
    const blockers: ReconciliationBlocker[] = [];

    for (const lock of MOCK_PAYROLL_LOCKS) {
      if (lock.payrollId === run.id && !lock.isResolved) {
        blockers.push({ category: "holds", payrollRunId: run.id, description: lock.reasonDescription });
      }
    }

    for (const dispute of MOCK_RECONCILIATION_DISPUTES) {
      if (dispute.payrollRunId === run.id && !dispute.isResolved) {
        blockers.push({ category: "disputes", payrollRunId: run.id, description: dispute.reason });
      }
    }

    for (const reservation of MOCK_FUNDING_RESERVATIONS) {
      if (reservation.payrollRunId === run.id && !reservation.isReleased) {
        blockers.push({
          category: "refund_blockers",
          payrollRunId: run.id,
          description: `${reservation.purpose} (reservation not yet released)`,
        });
      }
    }

    return {
      payrollRunId: run.id,
      label: run.id,
      href: `/payroll/${run.id}`,
      status: run.status,
      assets: [legacyRunAssetAmount(run.status, run.totalAmount)],
      blockers,
    } satisfies ReconciliationRunInput;
  });
}

function buildLegacyPeriods(): ReconciliationPeriodInput[] {
  const runsByPeriod = new Map<string, { periodLabel: string; runs: ReconciliationRunInput[] }>();

  for (const runInput of buildLegacyRunInputs()) {
    const run = MOCK_PAYROLL_RUNS.find((r) => r.id === runInput.payrollRunId)!;
    const periodId = formatPeriodId(run.timestamp, run.id);
    const periodLabel = formatPeriodLabel(run.timestamp, { fallback: run.id });

    const existing = runsByPeriod.get(periodId);
    if (existing) {
      existing.runs.push(runInput);
    } else {
      runsByPeriod.set(periodId, { periodLabel, runs: [runInput] });
    }
  }

  return Array.from(runsByPeriod.entries()).map(([periodId, { periodLabel, runs }]) => ({
    periodId,
    periodLabel,
    runs,
  }));
}

function buildMultiAssetPeriods(): ReconciliationPeriodInput[] {
  return MOCK_MULTI_ASSET_RUNS.map((run) => {
    const reconciliation = buildReconciliation(run);
    const blockers: ReconciliationBlocker[] = [];

    const assets: ReconciliationAssetAmount[] = run.assetGroups.map((group) => {
      const groupReconciliation = reconciliation.groups.find((g) => g.asset.code === group.asset.code);
      const settled = groupReconciliation?.totalConfirmed ?? 0;
      const liability = group.totalAmount;

      if (group.status === "failed" || group.status === "partial") {
        blockers.push({
          category: "mismatches",
          payrollRunId: run.id,
          description:
            group.errorMessage ??
            `${assetLabel(group.asset)} settlement could not be confirmed for this run.`,
        });
      }

      return {
        asset: group.asset,
        liability,
        settled,
        outstanding: Math.max(liability - settled, 0),
      };
    });

    const runInput: ReconciliationRunInput = {
      payrollRunId: run.id,
      label: run.label,
      href: `/payroll/multi-asset/${run.id}`,
      status: run.status,
      assets,
      blockers,
    };

    return {
      periodId: run.id,
      periodLabel: run.label,
      runs: [runInput],
    } satisfies ReconciliationPeriodInput;
  });
}

/** Realistic mock period inputs spanning healthy, warning, and blocked states. */
export function buildMockReconciliationPeriods(): ReconciliationPeriodInput[] {
  return [...buildLegacyPeriods(), ...buildMultiAssetPeriods()];
}

/** Empty fixture for the dashboard's empty state. */
export const MOCK_RECONCILIATION_PERIODS_EMPTY: ReconciliationPeriodInput[] = [];
