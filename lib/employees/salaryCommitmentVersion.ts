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
