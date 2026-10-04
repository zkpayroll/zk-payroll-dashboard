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
  settlementComplete?: boolean;
  reconciliationComplete?: boolean;
  receiptReviewComplete?: boolean;
  auditHandoffComplete?: boolean;
}

/**
 * Builds the period-close checklist for a payroll run: whether each of the
 * required categories (settlement, reconciliation, receipt review, audit handoff,
 * holds, disputes, funding reservations) is clear, and whether the period can be closed overall.
 */
export function buildPeriodCloseChecklist(inputs: PeriodCloseInputs): PeriodCloseChecklist {
  const {
    payrollRunId,
    locks,
    disputes,
    reservations,
    exportedAuditTimelineRunIds,
    settlementComplete = true,
    reconciliationComplete = true,
    receiptReviewComplete = true,
    auditHandoffComplete,
  } = inputs;

  const openLocks = locks.filter((l) => l.payrollId === payrollRunId && !l.isResolved);
  const openDisputes = disputes.filter((d) => d.payrollRunId === payrollRunId && !d.isResolved);
  const openReservations = reservations.filter(
    (r) => r.payrollRunId === payrollRunId && !r.isReleased,
  );
  const hasExportedAuditReference =
    exportedAuditTimelineRunIds.includes(payrollRunId) || auditHandoffComplete === true;

  const items: PeriodCloseChecklistItem[] = [
    {
      category: "settlement",
      label: "Settlement",
      isSatisfied: settlementComplete,
      blockers: settlementComplete
        ? []
        : [{ category: "settlement", description: "On-chain disbursement settlement is not complete." }],
    },
    {
      category: "reconciliation",
      label: "Reconciliation",
      isSatisfied: reconciliationComplete,
      blockers: reconciliationComplete
        ? []
        : [{ category: "reconciliation", description: "Period reconciliation has unresolved variances." }],
    },
    {
      category: "receipt_review",
      label: "Receipt review",
      isSatisfied: receiptReviewComplete,
      blockers: receiptReviewComplete
        ? []
        : [{ category: "receipt_review", description: "Settlement receipts have pending reviewer sign-off." }],
    },
    {
      category: "audit_handoff",
      label: "Audit handoff",
      isSatisfied: hasExportedAuditReference,
      blockers: hasExportedAuditReference
        ? []
        : [{ category: "audit_handoff", description: "Audit handoff bundle has not been generated and exported." }],
    },
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
      blockers: openDisputes.map((d) => ({ category: "disputes", description: d.reason || d.safeReasonDescription || d.id })),
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
