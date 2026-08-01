"use client";

import { useEffect, useState } from "react";
import { useSession, type SessionState } from "@/hooks/useSession";
import { AlertTriangle, Clock, LogOut, RefreshCw, ShieldAlert, X } from "lucide-react";

interface SessionTimeoutBannerProps {
  /** Called when the user chooses to re-authenticate */
  onReauthenticate?: () => void;
  /** If true, the banner can be dismissed via a close button (dismissed until next check) */
  dismissible?: boolean;
}

/**
 * Displays a warning banner when the session is nearing expiry or has expired.
 * Integrates with the useSession hook to monitor session state.
 * Designed for use on the dashboard and payroll pages.
 */
export function SessionTimeoutBanner({
  onReauthenticate,
  dismissible = true,
}: SessionTimeoutBannerProps) {
  const { sessionState, timeRemaining, formatTimeRemaining, refresh } = useSession();
  const [dismissed, setDismissed] = useState(false);

  // Re-show if state changes to something more severe
  useEffect(() => {
    if (sessionState === "expired" || sessionState === "expiring") {
      setDismissed(false);
    }
  }, [sessionState]);

  if (dismissed || sessionState === "loading" || sessionState === "active") {
    return null;
  }

  const handleReauth = () => {
    if (onReauthenticate) {
      onReauthenticate();
    } else {
      window.location.href = "/login";
    }
  };

  if (sessionState === "expired") {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3"
      >
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-red-800">Session Expired</h4>
          <p className="mt-0.5 text-sm text-red-700">
            Your session has expired. Please log in again to continue using the dashboard.
            Any in-progress payroll drafts have been preserved.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleReauth}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            >
              <LogOut className="h-3.5 w-3.5" />
              Re-authenticate
            </button>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 border border-red-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Check again
            </button>
          </div>
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="shrink-0 text-red-400 hover:text-red-600 transition-colors"
            aria-label="Dismiss session expired banner"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // sessionState === "expiring"
  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3"
    >
      <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-amber-800">
          Session Expiring Soon
        </h4>
        <p className="mt-0.5 text-sm text-amber-700">
          Your session will expire in approximately{" "}
          <strong className="font-semibold">{formatTimeRemaining()}</strong>.
          Please save your work and re-authenticate to avoid disruption.
          In-progress payroll drafts are automatically preserved.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleReauth}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          >
            <LogOut className="h-3.5 w-3.5" />
            Re-authenticate now
          </button>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 border border-amber-300"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Check session
          </button>
        </div>
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-amber-400 hover:text-amber-600 transition-colors"
          aria-label="Dismiss session timeout warning"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
