/**
 * Payroll accounting reconciliation markers (#689).
 *
 * Provides first-class reconciliation markers for accounting alignment,
 * tracking balanced entries, discrepancies, timing adjustments, and tax/treasury
 * checkpoints before payroll periods are finalized and posted to external ledgers.
 *
 * Privacy guarantees: No recipient identities, employee names, wallet addresses,
 * or individual compensation amounts are exposed or stored. All entries use
 * opaque identifiers, aggregated category tallies, and standard accounting codes.
 */

export type ReconciliationMarkerType =
  | "balanced"
  | "variance"
  | "timing_difference"
  | "manual_adjustment"
  | "tax_withholding"
  | "disputed_entry";

export type ReconciliationMarkerSeverity = "info" | "warning" | "critical";

export type ReconciliationMarkerStatus = "pending" | "resolved" | "waived";

export type AccountingCategory =
  | "net_disbursements"
  | "tax_withholdings"
  | "benefit_deductions"
  | "gas_network_fees"
  | "treasury_drawdown"
  | "escrow_reserve";

export interface ReconciliationMarker {
  id: string;
  payrollRunId: string;
  category: AccountingCategory;
  markerType: ReconciliationMarkerType;
  severity: ReconciliationMarkerSeverity;
  status: ReconciliationMarkerStatus;
  description: string;
  varianceAmount?: number;
  markedAt: number;
  resolvedAt?: number;
  resolutionNote?: string;
}

export interface CreateMarkerInput {
  id: string;
  payrollRunId: string;
  category: AccountingCategory;
  markerType: ReconciliationMarkerType;
  description: string;
  severity?: ReconciliationMarkerSeverity;
  varianceAmount?: number;
  markedAt?: number;
}

export interface ResolveMarkerInput {
  marker: ReconciliationMarker;
  resolution: "resolved" | "waived";
  note: string;
  resolvedAt?: number;
}

export interface AccountingReconciliationSummary {
  payrollRunId: string;
  totalMarkers: number;
  pendingCount: number;
  resolvedCount: number;
  waivedCount: number;
  criticalPendingCount: number;
  isAccountingReady: boolean;
  blockers: ReconciliationMarker[];
  warnings: ReconciliationMarker[];
  summaryMessage: string;
  evaluatedAt: string;
}

/**
 * Derives default severity from marker type when not explicitly supplied.
 */
function defaultSeverityForType(type: ReconciliationMarkerType): ReconciliationMarkerSeverity {
  switch (type) {
    case "balanced":
      return "info";
    case "timing_difference":
    case "tax_withholding":
    case "manual_adjustment":
      return "warning";
    case "variance":
    case "disputed_entry":
      return "critical";
  }
}

/**
 * Creates a validated reconciliation marker.
 */
export function createReconciliationMarker(input: CreateMarkerInput): ReconciliationMarker {
  if (!input.id || input.id.trim().length === 0) {
    throw new Error("Marker id must be a non-empty string");
  }
  if (!input.payrollRunId || input.payrollRunId.trim().length === 0) {
    throw new Error("Payroll run id must be a non-empty string");
  }
  if (!input.description || input.description.trim().length === 0) {
    throw new Error("Marker description must be a non-empty string");
  }

  const severity = input.severity ?? defaultSeverityForType(input.markerType);

  return {
    id: input.id.trim(),
    payrollRunId: input.payrollRunId.trim(),
    category: input.category,
    markerType: input.markerType,
    severity,
    status: input.markerType === "balanced" ? "resolved" : "pending",
    description: input.description.trim(),
    varianceAmount: input.varianceAmount !== undefined ? Math.abs(input.varianceAmount) : undefined,
    markedAt: input.markedAt ?? Date.now(),
  };
}

/**
 * Resolves or waives an active reconciliation marker with an audit note.
 */
export function resolveReconciliationMarker(input: ResolveMarkerInput): ReconciliationMarker {
  if (!input.note || input.note.trim().length === 0) {
    throw new Error("Resolution note must be provided when clearing a reconciliation marker");
  }

  if (input.marker.status !== "pending") {
    throw new Error(`Marker ${input.marker.id} is already in '${input.marker.status}' status`);
  }

  return {
    ...input.marker,
    status: input.resolution,
    resolutionNote: input.note.trim(),
    resolvedAt: input.resolvedAt ?? Date.now(),
  };
}

/**
 * Evaluates all accounting reconciliation markers for a payroll run.
 */
export function evaluateAccountingReconciliationMarkers(
  payrollRunId: string,
  markers: ReconciliationMarker[],
): AccountingReconciliationSummary {
  const runMarkers = markers.filter((m) => m.payrollRunId === payrollRunId);

  const pending = runMarkers.filter((m) => m.status === "pending");
  const resolved = runMarkers.filter((m) => m.status === "resolved");
  const waived = runMarkers.filter((m) => m.status === "waived");

  const blockers = pending.filter((m) => m.severity === "critical");
  const warnings = pending.filter((m) => m.severity === "warning");

  const isAccountingReady = blockers.length === 0;

  let summaryMessage: string;
  if (runMarkers.length === 0) {
    summaryMessage = "No reconciliation markers recorded for this payroll run.";
  } else if (isAccountingReady && warnings.length === 0) {
    summaryMessage = `All ${runMarkers.length} accounting reconciliation markers resolved or clear.`;
  } else if (isAccountingReady && warnings.length > 0) {
    summaryMessage = `Reconciliation permitted with ${warnings.length} warning marker(s) pending review.`;
  } else {
    summaryMessage = `Reconciliation blocked: ${blockers.length} critical marker(s) must be resolved.`;
  }

  return {
    payrollRunId,
    totalMarkers: runMarkers.length,
    pendingCount: pending.length,
    resolvedCount: resolved.length,
    waivedCount: waived.length,
    criticalPendingCount: blockers.length,
    isAccountingReady,
    blockers,
    warnings,
    summaryMessage,
    evaluatedAt: new Date().toISOString(),
  };
}

export class AccountingReconciliationMarkerError extends Error {
  summary: AccountingReconciliationSummary;

  constructor(summary: AccountingReconciliationSummary) {
    super(summary.summaryMessage);
    this.name = "AccountingReconciliationMarkerError";
    this.summary = summary;
  }
}

/**
 * Asserts that a payroll run has no critical unresolved reconciliation markers.
 */
export function assertAccountingReconciliationClear(
  payrollRunId: string,
  markers: ReconciliationMarker[],
): void {
  const summary = evaluateAccountingReconciliationMarkers(payrollRunId, markers);
  if (!summary.isAccountingReady) {
    throw new AccountingReconciliationMarkerError(summary);
  }
}
