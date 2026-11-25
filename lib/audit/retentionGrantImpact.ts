export interface RetentionGrantWarning {
  activeGrantCount: number;
  message: string | null;
}

/**
 * Returns a privacy-safe warning when a retention edit can outlive an active
 * audit grant's access to the records it is meant to review.
 */
export function getRetentionGrantWarning(
  previousRetentionDays: number,
  nextRetentionDays: number,
  activeGrantCount: number,
): RetentionGrantWarning {
  const count = Number.isFinite(activeGrantCount)
    ? Math.max(0, Math.floor(activeGrantCount))
    : 0;

  if (
    count === 0 ||
    !Number.isFinite(previousRetentionDays) ||
    !Number.isFinite(nextRetentionDays) ||
    nextRetentionDays >= previousRetentionDays
  ) {
    return { activeGrantCount: 0, message: null };
  }

  const grantLabel = count === 1 ? "active audit grant" : "active audit grants";
  const verb = count === 1 ? "is" : "are";

  return {
    activeGrantCount: count,
    message: `Shortening audit retention may remove records that ${verb} still covered by ${count} ${grantLabel}. Review or re-issue affected grants before saving.`,
  };
}
