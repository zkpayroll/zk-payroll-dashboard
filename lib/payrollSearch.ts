import type { Company, PayrollTransaction } from "@/types/models";
import {
  RECONCILIATION_STATUS_LABELS,
  resolveReconciliationStatus,
} from "@/lib/reconciliation/status";
import { resolveCompanyFromRegistry, type CompanyRegistryInput } from "@/lib/payroll/inactiveCompanyWarning";
import { formatPeriodLabel } from "@/lib/date/periodLabel";

/**
 * Free-text search across payroll runs (#167, #845).
 *
 * Kept as a pure function so the matching rules are testable without rendering
 * the history table, and so the same predicate can back any other list that
 * needs it later.
 *
 * Searches the fields an operator needs to identify a run:
 * - Run ID, status, and transaction hash
 * - Receipt reference
 * - Human-readable period and ISO date
 * - Visible reconciliation status
 * - Employer context: Company ID and resolved company/employer name (#845)
 *
 * Privacy Guarantees:
 * - Matches on public or operator metadata only.
 * - NEVER matches on zero-knowledge proofs, employee IDs, employee names, or salary figures.
 */

/** Period label derived from a run's timestamp or period field, e.g. "March 2026". */
export function formatRunPeriod(tx: Pick<PayrollTransaction, "createdAt" | "timestamp">): string {
  return formatPeriodLabel(tx, { fallback: "" });
}

export interface PayrollSearchOptions {
  /**
   * Optional custom company registry, map, or list.
   * If omitted, falls back to MOCK_COMPANIES.
   */
  companies?: CompanyRegistryInput;
}

/**
 * Resolves safe employer context strings (employer name and company ID)
 * for a payroll transaction.
 */
export function resolveEmployerSearchContext(
  tx: Pick<PayrollTransaction, "companyId">,
  registry?: CompanyRegistryInput,
): { companyId: string; employerName: string } {
  const companyId = (tx.companyId ?? "").trim();
  if (!companyId) {
    return { companyId: "", employerName: "" };
  }

  const company = resolveCompanyFromRegistry(companyId, registry);
  const employerName = company?.name?.trim() ?? "";

  return { companyId, employerName };
}

/**
 * True when `tx` matches `query`.
 *
 * An empty or whitespace-only query matches everything, so clearing the box
 * restores the full list rather than emptying it.
 */
export function matchesPayrollSearch(
  tx: PayrollTransaction,
  query: string,
  options?: PayrollSearchOptions | CompanyRegistryInput,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const registry: CompanyRegistryInput =
    options && typeof options === "object" && "companies" in options
      ? (options as PayrollSearchOptions).companies
      : (options as CompanyRegistryInput);

  const { companyId, employerName } = resolveEmployerSearchContext(tx, registry);

  const reconciliationStatus = resolveReconciliationStatus(tx);
  const haystacks = [
    tx.id,
    tx.status,
    tx.txHash ?? "",
    tx.receiptId ?? (tx.status === "verified" ? `rcpt_${tx.id}` : ""),
    formatRunPeriod(tx),
    RECONCILIATION_STATUS_LABELS[reconciliationStatus],
    reconciliationStatus,
    // ISO date too, so "2026-03" works as well as "March 2026" — users paste
    // both, and supporting only one makes the box feel broken.
    (tx.createdAt || tx.timestamp || "").slice(0, 10),
    // Employer context (#845): company identifier and safe display name
    companyId,
    employerName,
  ];

  return haystacks.some((value) => Boolean(value) && value.toLowerCase().includes(needle));
}

/** Filter a list of runs by the search query. */
export function searchPayrollRuns<T extends PayrollTransaction = PayrollTransaction>(
  transactions: T[],
  query: string,
  options?: PayrollSearchOptions | CompanyRegistryInput,
): T[] {
  const needle = query.trim();
  if (!needle) return transactions;
  return transactions.filter((tx) => matchesPayrollSearch(tx, needle, options));
}
