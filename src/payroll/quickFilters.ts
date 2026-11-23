import type {
  PayrollRiskScore,
  PayrollRun,
  PayrollTransaction,
} from "@/types/models";

/**
 * One-click quick filters for payroll history lists (issue #284).
 *
 * Kept as pure functions so the matching rules are testable without rendering
 * the toolbar, and so any payroll list (transaction history, archived payrolls,
 * schedule) can reuse the same semantics.
 *
 * PRIVACY: facets are derived exclusively from lifecycle state fields (status,
 * approval state, reconciliation outcome). No amounts, employee identifiers,
 * wallet addresses, proofs, or hashes are ever read or surfaced — the toolbar
 * shows state labels and counts only, so it is safe to render anywhere the
 * underlying list is safe to render.
 */

export type QuickFilterGroup =
  | "status"
  | "approval"
  | "risk"
  | "treasury"
  | "reconciliation";

export const QUICK_FILTER_GROUPS: readonly QuickFilterGroup[] = [
  "status",
  "approval",
  "risk",
  "treasury",
  "reconciliation",
] as const;

/** Payroll status values a run can be quick-filtered by. */
export type StatusFacet = PayrollTransaction["status"];

/** Approval lifecycle values a run can be quick-filtered by. */
export type ApprovalFacet = NonNullable<PayrollTransaction["approvalStatus"]>;

/**
 * Coarse risk level mirroring `PayrollRiskScore["riskLevel"]`. History rows do
 * not carry the full review-time risk score (that is computed from employee
 * and treasury data in the approval flow), so the history toolbar uses a
 * conservative proxy derived from run state — see `deriveHistoryRiskLevel`.
 */
export type RiskFacet = PayrollRiskScore["riskLevel"];

/** Treasury readiness facet for a run. */
export type TreasuryFacet = "funded" | "underfunded" | "unverified";

/** Reconciliation outcome values a run can be quick-filtered by. */
export type ReconciliationFacet = NonNullable<
  PayrollRun["reconciliationStatus"]
>;

/** Per-group facet values a run exposes for quick filtering. */
export interface RunQuickFacets {
  status: StatusFacet;
  approval?: ApprovalFacet;
  risk?: RiskFacet;
  treasury: TreasuryFacet;
  reconciliation?: ReconciliationFacet;
}

/** The value type each quick-filter group accepts. */
export interface QuickFilterValueMap {
  status: StatusFacet;
  approval: ApprovalFacet;
  risk: RiskFacet;
  treasury: TreasuryFacet;
  reconciliation: ReconciliationFacet;
}

/**
 * Current quick-filter selection, one dimension per group. `"all"` means the
 * group is not filtering; any other value requires the run to expose that
 * exact facet.
 */
export type QuickFilterSelection = {
  [G in QuickFilterGroup]: "all" | QuickFilterValueMap[G];
};

/** A run the quick filters can operate on. */
export type QuickFilterableRun = PayrollTransaction &
  Partial<Pick<PayrollRun, "reconciliationStatus" | "cancellationReason">>;

/** No quick filters applied — matches every run. */
export const EMPTY_QUICK_FILTERS: QuickFilterSelection = {
  status: "all",
  approval: "all",
  risk: "all",
  treasury: "all",
  reconciliation: "all",
};

/** Per-group counts of runs matching each facet value. */
export type QuickFilterCounts = {
  [G in QuickFilterGroup]: Partial<Record<QuickFilterValueMap[G], number>>;
};

/**
 * Derive the quick-filter facets for a single run.
 *
 * Runs may legitimately lack some facets (e.g. a plain transaction has no
 * reconciliation outcome yet). A missing facet simply never matches a
 * specific filter for that group, but keeps matching `"all"`.
 */
export function getRunQuickFacets(run: QuickFilterableRun): RunQuickFacets {
  return {
    status: run.status,
    approval: run.approvalStatus,
    risk: deriveHistoryRiskLevel(run),
    treasury: deriveTreasuryFacet(run),
    reconciliation: run.reconciliationStatus,
  };
}

/**
 * Coarse, stateless risk proxy for history scanning (issue #284).
 *
 * This is NOT the full review-time risk score from
 * `PayrollReviewRiskScoring` — it uses only lifecycle state already visible
 * on the history row (no employee, salary, or treasury-balance data), so it
 * cannot leak anything the row does not already show. Precedence: the most
 * severe signal wins.
 */
export function deriveHistoryRiskLevel(
  run: QuickFilterableRun,
): RiskFacet {
  // Blocking signals: the run failed outright or could not be funded.
  if (
    run.status === "failed" ||
    run.reconciliationStatus === "failed" ||
    run.cancellationReason === "treasury_insufficient"
  ) {
    return "block";
  }
  // Warning signals: an approver pushed back on the run.
  if (
    run.approvalStatus === "rejected" ||
    run.approvalStatus === "correction_requested"
  ) {
    return "warning";
  }
  // Caution: not yet verified — still in flight.
  if (run.status === "pending") {
    return "caution";
  }
  return "clear";
}

/**
 * Treasury readiness proxy from run state only. Only two states are ever
 * *known*: a run that was cancelled for insufficient funds, and a run that
 * settled successfully. Everything else is reported as `unverified` rather
 * than guessed.
 */
export function deriveTreasuryFacet(run: QuickFilterableRun): TreasuryFacet {
  if (run.cancellationReason === "treasury_insufficient") {
    return "underfunded";
  }
  if (run.status === "verified") {
    return "funded";
  }
  return "unverified";
}

/** True when no quick filter group is narrowing the list. */
export function isQuickFilterEmpty(selection: QuickFilterSelection): boolean {
  return QUICK_FILTER_GROUPS.every((group) => selection[group] === "all");
}

/** Number of quick filter groups currently narrowing the list. */
export function countActiveQuickFilters(selection: QuickFilterSelection): number {
  return QUICK_FILTER_GROUPS.filter((group) => selection[group] !== "all")
    .length;
}

/**
 * Toggle a quick filter within a group (radio semantics): selecting the
 * already-active value resets that group to `"all"`.
 */
export function toggleQuickFilter<G extends QuickFilterGroup>(
  selection: QuickFilterSelection,
  group: G,
  value: QuickFilterValueMap[G],
): QuickFilterSelection {
  const nextValue = selection[group] === value ? "all" : value;
  return { ...selection, [group]: nextValue } as QuickFilterSelection;
}

/**
 * True when a run's facets satisfy the selection. A group set to `"all"`
 * always matches; a specific value matches only when the run exposes that
 * facet — runs missing the facet are excluded, which keeps filters honest
 * instead of silently matching runs whose state is unknown.
 */
export function runMatchesQuickFilters(
  facets: RunQuickFacets,
  selection: QuickFilterSelection,
): boolean {
  if (selection.status !== "all" && facets.status !== selection.status) {
    return false;
  }
  if (selection.approval !== "all" && facets.approval !== selection.approval) {
    return false;
  }
  if (selection.risk !== "all" && facets.risk !== selection.risk) {
    return false;
  }
  if (
    selection.treasury !== "all" &&
    facets.treasury !== selection.treasury
  ) {
    return false;
  }
  if (
    selection.reconciliation !== "all" &&
    facets.reconciliation !== selection.reconciliation
  ) {
    return false;
  }
  return true;
}

/** Filter runs by the current quick-filter selection. */
export function applyQuickFilters<T extends QuickFilterableRun>(
  runs: T[],
  selection: QuickFilterSelection,
): T[] {
  if (isQuickFilterEmpty(selection)) return runs;
  return runs.filter((run) =>
    runMatchesQuickFilters(getRunQuickFacets(run), selection),
  );
}

/**
 * Faceted counts for the quick-filter chips.
 *
 * For each group, a run is counted when it matches every *other* active
 * group (standard faceted-search semantics), so each chip shows how many
 * results selecting it would produce given the current selection elsewhere.
 */
export function computeQuickFilterCounts<T extends QuickFilterableRun>(
  runs: T[],
  selection: QuickFilterSelection,
): QuickFilterCounts {
  const counts = {
    status: {},
    approval: {},
    risk: {},
    treasury: {},
    reconciliation: {},
  } as QuickFilterCounts;

  for (const run of runs) {
    const facets = getRunQuickFacets(run);
    for (const group of QUICK_FILTER_GROUPS) {
      // Counts for a group ignore that group's own selection.
      const otherGroups = { ...selection, [group]: "all" };
      if (!runMatchesQuickFilters(facets, otherGroups)) continue;
      const value = facets[group];
      if (value === undefined) continue;
      // Indexed access across the union — value is keyed to `group` by
      // construction, so the cast is sound.
      const bucket = counts[group] as Record<string, number | undefined>;
      bucket[value as string] = (bucket[value as string] ?? 0) + 1;
    }
  }

  return counts;
}
