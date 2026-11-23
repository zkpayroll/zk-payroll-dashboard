"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { fetchPauseStatus, type PauseCategory, type PauseStatus } from "@/lib/sdk/pauseStatus";
import { useCompanyWarningsStore } from "@/stores/companyWarnings";

export type { PauseCategory, PauseStatus };

const CATEGORY_LABELS: Record<PauseCategory, string> = {
  payroll: "Payroll processing",
  treasury: "Treasury operations",
  audit: "Audit submissions",
  admin: "Admin actions",
};

const CATEGORY_DESCRIPTIONS: Record<PauseCategory, string> = {
  payroll: "Payroll cannot be processed while the system is paused.",
  treasury: "Treasury withdrawals and transfers are currently unavailable.",
  audit: "Audit report submissions are temporarily disabled.",
  admin: "Administrative operations are restricted during this pause.",
};

const POLL_INTERVAL_MS = 30_000;

/**
 * Re-reads the persisted company state so a pause or resume made in another
 * tab reaches a page that has been open for a long time (#842). Failures are
 * ignored: the in-memory state is still a valid fallback.
 */
async function syncFromPersistedState(): Promise<void> {
  try {
    await useCompanyWarningsStore.persist.rehydrate();
  } catch {
    // Storage unavailable or unreadable; keep the in-memory state.
  }
}

function usePauseStatus(): {
  status: PauseStatus | null;
  loading: boolean;
  refresh: () => void;
} {
  const [status, setStatus] = useState<PauseStatus | null>(null);
  // Only true until the first read completes; later refreshes keep showing the
  // current status instead of toggling back to a loading state.
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(() => {
    try {
      setStatus(fetchPauseStatus());
    } catch (err) {
      // Keep the last known status: hiding an active pause because one refresh
      // failed would tell the operator payroll is safe when it may not be.
      console.error("[PauseStatusBanner] Failed to fetch pause status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, POLL_INTERVAL_MS);

    // Timers are throttled or frozen in background tabs, so a page left open
    // can be hours behind. Re-sync as soon as the operator comes back to it.
    const resync = () => {
      if (document.visibilityState === "hidden") return;
      void syncFromPersistedState().then(fetchStatus);
    };

    // Another tab changed the persisted pause state.
    const storageKey = useCompanyWarningsStore.persist.getOptions().name;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== storageKey) return;
      void syncFromPersistedState().then(fetchStatus);
    };

    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    window.addEventListener("storage", onStorage);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
      window.removeEventListener("storage", onStorage);
    };
  }, [fetchStatus]);

  return { status, loading, refresh: fetchStatus };
}

export function PauseStatusBanner() {
  const { status, loading, refresh } = usePauseStatus();
  const [dismissed, setDismissed] = useState(false);

  // A dismissal only applies to the pause it was made for. Once the pause is
  // lifted, clear it so a later pause is shown again on the same open page.
  const isPaused = Boolean(status?.paused);
  useEffect(() => {
    if (!isPaused) setDismissed(false);
  }, [isPaused]);

  if (loading || !status?.paused || dismissed) return null;

  const activeCategories =
    status.categories.length > 0
      ? status.categories
      : (["payroll", "treasury", "audit", "admin"] as PauseCategory[]);

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-label="System pause status"
      className="w-full bg-yellow-50 border-b border-yellow-300 px-4 py-3 text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-200"
    >
      <div className="mx-auto max-w-7xl flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400"
          aria-hidden="true"
        />

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">
            System operations are currently paused
            {status.reason ? `: ${status.reason}` : "."}
          </p>

          <ul className="mt-1 space-y-0.5 text-sm">
            {activeCategories.map((cat) => (
              <li key={cat}>
                <span className="font-medium">{CATEGORY_LABELS[cat]}</span>
                {" — "}
                {CATEGORY_DESCRIPTIONS[cat]}
              </li>
            ))}
          </ul>

          <p className="mt-2 text-xs text-yellow-700 dark:text-yellow-300">
            Operations will resume automatically when the pause is lifted.
            Contact your admin if this is unexpected.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={refresh}
            aria-label="Refresh pause status"
            title="Refresh"
            className="rounded p-1 hover:bg-yellow-100 dark:hover:bg-yellow-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss pause status banner"
            title="Dismiss"
            className="rounded p-1 hover:bg-yellow-100 dark:hover:bg-yellow-800 transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
