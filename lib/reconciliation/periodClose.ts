import type {
  PayrollLock,
  PayrollDispute,
  FundingReservation,
  PeriodCloseChecklist,
  PeriodCloseChecklistItem,
} from "@/types/models";

export interface PeriodCloseInputs {
  payrollRunId: string;
  locks: PayrollLock[];
  disputes: PayrollDispute[];
  reservations: FundingReservation[];
  /** payrollRunIds that have a generated + exported audit-ready timeline. */
  exportedAuditTimelineRunIds: string[];
}

/**
 * Builds the period-close checklist for a payroll run: whether each of the
 * four required categories (holds, disputes, funding reservations, audit
 * references) is clear, and whether the period can be closed overall (only
 * when every category is clear).
 */
export function buildPeriodCloseChecklist(inputs: PeriodCloseInputs): PeriodCloseChecklist {
  const { payrollRunId, locks, disputes, reservations, exportedAuditTimelineRunIds } = inputs;

  const openLocks = locks.filter((l) => l.payrollId === payrollRunId && !l.isResolved);
  const openDisputes = disputes.filter((d) => d.payrollRunId === payrollRunId && !d.isResolved);
  const openReservations = reservations.filter(
    (r) => r.payrollRunId === payrollRunId && !r.isReleased,
  );
  const hasExportedAuditReference = exportedAuditTimelineRunIds.includes(payrollRunId);

  const items: PeriodCloseChecklistItem[] = [
    {
      category: "holds",
      label: "Holds",
      isSatisfied: openLocks.length === 0,
      blockers: openLocks.map((l) => ({ category: "holds", description: l.reasonDescription })),
    },
    {
      category: "disputes",
      label: "Disputes",
      isSatisfied: openDisputes.length === 0,
      blockers: openDisputes.map((d) => ({ category: "disputes", description: d.reason })),
    },
    {
      category: "funding_reservations",
      label: "Funding reservations",
      isSatisfied: openReservations.length === 0,
      blockers: openReservations.map((r) => ({
        category: "funding_reservations",
        description: `${r.purpose} ($${r.amount.toLocaleString()} reserved)`,
      })),
    },
    {
      category: "audit_references",
      label: "Audit references",
      isSatisfied: hasExportedAuditReference,
      blockers: hasExportedAuditReference
        ? []
        : [{ category: "audit_references", description: "No exported audit-ready timeline for this period yet." }],
    },
  ];

  return {
    payrollRunId,
    items,
    canClose: items.every((item) => item.isSatisfied),
  };
}
