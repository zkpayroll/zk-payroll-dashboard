/**
 * Privacy-safe copy for the reconciliation dashboard.
 *
 * The dashboard only ever renders aggregate liability figures (per payroll
 * run, per asset, per period). It must never render a single employee's
 * salary or payment amount.
 */

export const RECONCILIATION_PRIVACY_NOTICE =
  "Amounts shown are aggregated per payroll run, asset, and period. Individual employee salary or payment amounts are never displayed here.";

/**
 * QA helper: asserts none of the given raw per-employee amounts leak into
 * rendered dashboard text. Mirrors the equivalent guard in
 * `lib/privacy/amendments.ts` for the amendments review screens.
 */
export function containsRawEmployeeAmount(text: string, rawEmployeeAmounts: number[]): boolean {
  return rawEmployeeAmounts.some((amount) => text.includes(String(amount)));
}
