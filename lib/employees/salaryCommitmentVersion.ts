/** Newest salary commitment format version supported by the dashboard. */
export const SUPPORTED_SALARY_COMMITMENT_VERSION = 1;

/**
 * Missing version metadata is treated as legacy version 1 for compatibility.
 */
export function isSupportedSalaryCommitmentVersion(
  version: number | undefined,
): boolean {
  return (
    version === undefined ||
    version === SUPPORTED_SALARY_COMMITMENT_VERSION
  );
}

/**
 * Returns privacy-safe, actionable guidance for a salary commitment format
 * version. Never includes salary amounts, commitment values, or wallet data.
 */
export function getSalaryCommitmentVersionGuidance(
  version: number | undefined,
): string | null {
  if (isSupportedSalaryCommitmentVersion(version)) return null;

  const found = version === undefined ? "unknown" : `v${version}`;
  return (
    `This salary commitment uses format ${found}, but the dashboard supports ` +
    `v${SUPPORTED_SALARY_COMMITMENT_VERSION}. Do not run payroll for this ` +
    `employee until the commitment is re-generated in the replacement review ` +
    `flow, or an administrator confirms compatibility with the payroll contract.`
  );
}
