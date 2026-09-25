"use client";

import { useMemo } from "react";
import {
  CheckCircle,
  Clock,
  XCircle,
  Ban,
  ShieldCheck,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown,
  MessageSquareWarning,
  FileEdit,
  Landmark,
  CircleDashed,
  RefreshCcw,
  CheckCircle2,
  MinusCircle,
} from "lucide-react";
import {
  EMPTY_QUICK_FILTERS,
  QUICK_FILTER_GROUPS,
  countActiveQuickFilters,
  isQuickFilterEmpty,
  toggleQuickFilter,
} from "@/src/payroll/quickFilters";
import type {
  ApprovalFacet,
  QuickFilterCounts,
  QuickFilterGroup,
  QuickFilterSelection,
  ReconciliationFacet,
  RiskFacet,
  StatusFacet,
  TreasuryFacet,
} from "@/src/payroll/quickFilters";

/**
 * One-click quick filters for payroll history (issue #284).
 *
 * State-only facets: payroll status, approval state, risk state, treasury
 * readiness and reconciliation outcome. Labels and counts describe lifecycle
 * state — never amounts, employee data, wallet addresses or hashes — so the
 * toolbar can be rendered anywhere the underlying payroll list is safe to
 * render.
 */

export interface PayrollQuickFiltersProps {
  selection: QuickFilterSelection;
  counts: QuickFilterCounts;
  totalCount: number;
  filteredCount: number;
  onChange: (next: QuickFilterSelection) => void;
}

interface QuickFilterOption<V extends string = string> {
  value: V;
  label: string;
  icon: typeof CheckCircle;
  tone: "emerald" | "amber" | "orange" | "red" | "gray";
}

const STATUS_OPTIONS: QuickFilterOption<StatusFacet>[] = [
  { value: "verified", label: "Verified", icon: CheckCircle, tone: "emerald" },
  { value: "pending", label: "Pending", icon: Clock, tone: "amber" },
  { value: "failed", label: "Failed", icon: XCircle, tone: "red" },
  { value: "cancelled", label: "Cancelled", icon: Ban, tone: "gray" },
];

const APPROVAL_OPTIONS: QuickFilterOption<ApprovalFacet>[] = [
  { value: "draft", label: "Draft", icon: FileEdit, tone: "gray" },
  {
    value: "pending_executive_approval",
    label: "Awaiting approval",
    icon: Clock,
    tone: "amber",
  },
  { value: "approved", label: "Approved", icon: ThumbsUp, tone: "emerald" },
  { value: "rejected", label: "Rejected", icon: ThumbsDown, tone: "red" },
  {
    value: "correction_requested",
    label: "Correction requested",
    icon: MessageSquareWarning,
    tone: "orange",
  },
];

const RISK_OPTIONS: QuickFilterOption<RiskFacet>[] = [
  { value: "clear", label: "Clear", icon: ShieldCheck, tone: "emerald" },
  { value: "caution", label: "Caution", icon: ShieldCheck, tone: "amber" },
  { value: "warning", label: "Warning", icon: ShieldAlert, tone: "orange" },
  { value: "block", label: "Block", icon: ShieldAlert, tone: "red" },
];

const TREASURY_OPTIONS: QuickFilterOption<TreasuryFacet>[] = [
  { value: "funded", label: "Funded", icon: Landmark, tone: "emerald" },
  {
    value: "underfunded",
    label: "Underfunded",
    icon: MinusCircle,
    tone: "red",
  },
  {
    value: "unverified",
    label: "Not yet verified",
    icon: CircleDashed,
    tone: "gray",
  },
];

const RECONCILIATION_OPTIONS: QuickFilterOption<ReconciliationFacet>[] = [
  { value: "complete", label: "Complete", icon: CheckCircle2, tone: "emerald" },
  { value: "partial", label: "Partial", icon: RefreshCcw, tone: "amber" },
  { value: "pending", label: "Pending", icon: Clock, tone: "gray" },
  { value: "failed", label: "Failed", icon: XCircle, tone: "red" },
];

const GROUP_OPTIONS: Record<QuickFilterGroup, QuickFilterOption[]> = {
  status: STATUS_OPTIONS,
  approval: APPROVAL_OPTIONS,
  risk: RISK_OPTIONS,
  treasury: TREASURY_OPTIONS,
  reconciliation: RECONCILIATION_OPTIONS,
};

const GROUP_CONFIG: Record<QuickFilterGroup, { label: string; srLabel: string }> =
  {
    status: { label: "Status", srLabel: "Filter by payroll status" },
    approval: { label: "Approval", srLabel: "Filter by approval state" },
    risk: { label: "Risk", srLabel: "Filter by risk state" },
    treasury: { label: "Treasury", srLabel: "Filter by treasury readiness" },
    reconciliation: {
      label: "Reconciliation",
      srLabel: "Filter by reconciliation outcome",
    },
  };

/** Tailwind class sets per tone — static strings so JIT keeps them. */
const TONE_CLASSES: Record<
  QuickFilterOption["tone"],
  { active: string; idle: string }
> = {
  emerald: {
    active: "bg-emerald-600 text-white border-emerald-600",
    idle: "text-emerald-700 hover:bg-emerald-50 border-gray-200",
  },
  amber: {
    active: "bg-amber-500 text-white border-amber-500",
    idle: "text-amber-700 hover:bg-amber-50 border-gray-200",
  },
  orange: {
    active: "bg-orange-600 text-white border-orange-600",
    idle: "text-orange-700 hover:bg-orange-50 border-gray-200",
  },
  red: {
    active: "bg-red-600 text-white border-red-600",
    idle: "text-red-700 hover:bg-red-50 border-gray-200",
  },
  gray: {
    active: "bg-gray-700 text-white border-gray-700",
    idle: "text-gray-700 hover:bg-gray-100 border-gray-200",
  },
};

function QuickFilterChip({
  group,
  value,
  label,
  icon: Icon,
  tone,
  selected,
  count,
  onClick,
}: {
  group: QuickFilterGroup;
  value: string;
  label: string;
  icon: typeof CheckCircle;
  tone: QuickFilterOption["tone"];
  selected: boolean;
  count?: number;
  onClick: () => void;
}) {
  const tones = TONE_CLASSES[tone] ?? TONE_CLASSES.gray;
  const countLabel =
    count === undefined ? "" : ` (${count} run${count === 1 ? "" : "s"})`;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`${label}${countLabel}`}
      data-quick-filter={`${group}:${value}`}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        selected ? tones.active : `bg-white ${tones.idle}`
      }`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
      {count !== undefined && (
        <span
          className={`ml-0.5 rounded-full px-1.5 text-[10px] leading-4 ${
            selected ? "bg-white/20" : "bg-gray-100 text-gray-600"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function PayrollQuickFilters({
  selection,
  counts,
  totalCount,
  filteredCount,
  onChange,
}: PayrollQuickFiltersProps) {
  const activeCount = countActiveQuickFilters(selection);
  const isEmpty = isQuickFilterEmpty(selection);

  // Worded to avoid "Showing …" — the table footer already uses that phrase
  // and several tests target it with a broad /showing/i text query.
  const summary = useMemo(() => {
    if (isEmpty) {
      return `All ${totalCount} run${totalCount === 1 ? "" : "s"} listed`;
    }
    return `${filteredCount} of ${totalCount} run${
      totalCount === 1 ? "" : "s"
    } match ${activeCount} quick filter${activeCount === 1 ? "" : "s"}`;
  }, [isEmpty, totalCount, filteredCount, activeCount]);

  return (
    <section
      aria-label="Payroll quick filters"
      data-testid="payroll-quick-filters"
      className="border-b bg-gray-50/60 px-4 py-3 sm:px-6"
    >
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        {QUICK_FILTER_GROUPS.map((group) => {
          const config = GROUP_CONFIG[group];
          return (
            <fieldset key={group} className="min-w-0">
              <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {config.label}
              </legend>
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label={config.srLabel}
                data-quick-filter-group={group}
              >
                {GROUP_OPTIONS[group].map((option) => (
                  <QuickFilterChip
                    key={option.value}
                    group={group}
                    value={option.value}
                    label={option.label}
                    icon={option.icon}
                    tone={option.tone}
                    selected={selection[group] === option.value}
                    count={
                      counts[group][
                        option.value as keyof (typeof counts)[typeof group]
                      ] as number | undefined
                    }
                    onClick={() =>
                      onChange(
                        toggleQuickFilter(
                          selection,
                          group,
                          option.value as never,
                        ),
                      )
                    }
                  />
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-200 pt-2">
        <p className="text-xs text-gray-600" role="status">
          {summary}
          {filteredCount === 0 && !isEmpty && (
            <span className="ml-1 text-gray-500">
              — no runs match. Try removing a filter.
            </span>
          )}
        </p>
        {!isEmpty && (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_QUICK_FILTERS })}
            aria-label="Clear quick filters"
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <XCircle className="h-3 w-3" aria-hidden="true" />
            Clear quick filters
          </button>
        )}
      </div>
    </section>
  );
}

export default PayrollQuickFilters;
