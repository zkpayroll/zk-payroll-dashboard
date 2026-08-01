"use client";

import { useMemo } from "react";
import { useViewKeyStore } from "@/stores/viewKeys";
import { IncidentBanner } from "@/components/ui/IncidentBanner";
import type { ViewKey } from "@/types";

export const AUDITOR_EXPIRATION_SOON_MS = 7 * 24 * 60 * 60 * 1000;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function daysUntil(iso: string, now: number): number {
  return Math.max(1, Math.ceil((new Date(iso).getTime() - now) / (24 * 60 * 60 * 1000)));
}

function aggregateMessage(
  keys: ViewKey[],
  now: number,
  expired: boolean
): string {
  const count = keys.length;
  const sample = keys[0]!;
  const sampleDays = expired ? 0 : daysUntil(sample.expiresAt, now);
  const moreCount = count - 1;

  if (expired) {
    if (count === 1) {
      return `Auditor access for ${sample.auditorName} (${sample.auditorOrg}) expired on ${formatDate(sample.expiresAt)}. Revoke or renew to restore compliance.`;
    }
    if (moreCount === 1) {
      return `${count} auditor view keys have expired. The most recent is ${sample.auditorName} (${sample.auditorOrg}) \u2014 expired on ${formatDate(sample.expiresAt)}. Revoke or renew to restore compliance. 1 more.`;
    }
    return `${count} auditor view keys have expired. The most recent is ${sample.auditorName} (${sample.auditorOrg}) \u2014 expired on ${formatDate(sample.expiresAt)}. Revoke or renew to restore compliance. ${moreCount} more.`;
  }

  if (count === 1) {
    return `Auditor access for ${sample.auditorName} (${sample.auditorOrg}) expires in ${sampleDays} day${sampleDays === 1 ? "" : "s"} (${formatDate(sample.expiresAt)}). Renew before it lapses.`;
  }
  if (moreCount === 1) {
    return `${count} auditor view keys expire within ${AUDITOR_EXPIRATION_SOON_MS / (24 * 60 * 60 * 1000)} days. The soonest is ${sample.auditorName} (${sample.auditorOrg}) \u2014 ${sampleDays} day${sampleDays === 1 ? "" : "s"} remaining. 1 more.`;
  }
  return `${count} auditor view keys expire within ${AUDITOR_EXPIRATION_SOON_MS / (24 * 60 * 60 * 1000)} days. The soonest is ${sample.auditorName} (${sample.auditorOrg}) \u2014 ${sampleDays} day${sampleDays === 1 ? "" : "s"} remaining. ${moreCount} more.`;
}

export interface AuditorAccessExpirationBannerProps {
  /** Override "now" used for expiration calculations. Defaults to Date.now(). */
  now?: number;
  /** Override threshold (ms). Defaults to 7 days. */
  warningWindowMs?: number;
  /** Custom store hook — useful for tests. */
  viewKeysSelector?: (state: { viewKeys: ViewKey[] }) => ViewKey[];
}

/**
 * Surface auditor view keys that are about to expire (or have already
 * expired) so admin/auditor workflows don't fail silently (#199).
 *
 * The banner aggregates per-key state from the persisted view key store and
 * renders a global, dismissible `IncidentBanner`:
 *
 *  - One or more keys already expired  → `variant="error"`
 *  - One or more active keys expiring within the warning window (~7 days)
 *                                       → `variant="warning"`
 *  - Otherwise                          → renders nothing
 *
 * Pure derived state — the banner intentionally never mutates the store.
 * The dismissible state is owned by the underlying `IncidentBanner` itself,
 * so a refresh re-surfaces expired access if it is still present.
 */
export default function AuditorAccessExpirationBanner({
  now,
  warningWindowMs = AUDITOR_EXPIRATION_SOON_MS,
  viewKeysSelector = (state) => state.viewKeys,
}: AuditorAccessExpirationBannerProps = {}) {
  const viewKeys = useViewKeyStore(viewKeysSelector);

  const classifications = useMemo(() => {
    const effectiveNow = now ?? Date.now();
    const expired: ViewKey[] = [];
    const soonExpiring: ViewKey[] = [];

    for (const key of viewKeys) {
      if (!key.isActive) continue;
      const expiry = new Date(key.expiresAt).getTime();
      if (Number.isNaN(expiry)) continue;
      if (expiry <= effectiveNow) {
        expired.push(key);
      } else if (expiry - effectiveNow <= warningWindowMs) {
        soonExpiring.push(key);
      }
    }

    expired.sort(
      (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
    );
    soonExpiring.sort(
      (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
    );

    return { expired, soonExpiring, effectiveNow };
  }, [viewKeys, now, warningWindowMs]);

  const { expired, soonExpiring, effectiveNow } = classifications;

  if (expired.length === 0 && soonExpiring.length === 0) return null;

  if (expired.length > 0) {
    return (
      <IncidentBanner
        variant="error"
        message={aggregateMessage(expired, effectiveNow, true)}
        dismissible
      />
    );
  }

  return (
    <IncidentBanner
      variant="warning"
      message={aggregateMessage(soonExpiring, effectiveNow, false)}
      dismissible
    />
  );
}
