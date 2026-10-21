/**
 * Policy revision attached to a payroll run (#751).
 *
 * Each run records the revision of the payroll policy it executed under, so
 * auditors can tell which rules applied. Revisions are plain whole numbers;
 * anything else is treated as not recorded rather than shown as a guess.
 */

export interface PolicyRevisionInfo {
  recorded: boolean;
  revision: number | null;
  /** Compact label such as "r3", or "Not recorded". */
  label: string;
  /** One-line explanation for tooltips and screen readers. */
  detail: string;
}

export function getPolicyRevisionInfo(revision: unknown): PolicyRevisionInfo {
  if (typeof revision === "number" && Number.isInteger(revision) && revision >= 1) {
    return {
      recorded: true,
      revision,
      label: `r${revision}`,
      detail: `This run executed under payroll policy revision ${revision}.`,
    };
  }
  return {
    recorded: false,
    revision: null,
    label: "Not recorded",
    detail: "No policy revision was recorded for this run.",
  };
}
