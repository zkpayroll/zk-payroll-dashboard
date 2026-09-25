"use client";

import React, { useEffect, useState } from "react";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  Ban,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import {
  ToastContainer,
  Toast,
  ToastHeader,
  ToastTitle,
  ToastDescription,
  ToastActions,
} from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  useNetworkStatusStore,
  type NetworkRetryOperation,
} from "@/stores/networkStatus";
import { useHelpDrawer, HELP_CONTENT } from "@/stores/helpDrawer";

function RetryCountdown({ targetTimestamp }: { targetTimestamp: number | null }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => {
    if (!targetTimestamp) return null;
    return Math.max(0, Math.ceil((targetTimestamp - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!targetTimestamp) {
      setSecondsLeft(null);
      return;
    }

    const update = () => {
      const remaining = Math.max(0, Math.ceil((targetTimestamp - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };

    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  if (secondsLeft === null || secondsLeft <= 0) {
    return <span className="font-medium text-amber-700">Retrying now...</span>;
  }

  return (
    <span className="font-medium text-amber-700">
      Next retry in {secondsLeft}s...
    </span>
  );
}

function RetryToastItem({ op }: { op: NetworkRetryOperation }) {
  const { cancelOperation, dismissOperation } = useNetworkStatusStore();
  const { openHelp } = useHelpDrawer();

  const handleOpenRemediation = () => {
    const pageKey = op.remediationPage || "network-remediation";
    const content = HELP_CONTENT[pageKey] || HELP_CONTENT["network-remediation"];
    if (content) {
      openHelp(pageKey, content);
    }
  };

  const getVariant = () => {
    switch (op.status) {
      case "retrying":
        return "retrying";
      case "recovered":
        return "recovered";
      case "exhausted":
        return "exhausted";
      case "cancelled":
        return "cancelled";
      default:
        return "info";
    }
  };

  return (
    <Toast
      variant={getVariant()}
      onDismiss={() => dismissOperation(op.id)}
      data-testid={`retry-toast-${op.id}`}
    >
      <ToastHeader>
        {op.status === "retrying" && (
          <RefreshCw
            className="h-4 w-4 animate-spin text-amber-600 shrink-0 mt-0.5"
            aria-hidden="true"
          />
        )}
        {op.status === "pending" && (
          <Loader2
            className="h-4 w-4 animate-spin text-blue-600 shrink-0 mt-0.5"
            aria-hidden="true"
          />
        )}
        {op.status === "recovered" && (
          <CheckCircle2
            className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5"
            aria-hidden="true"
          />
        )}
        {op.status === "exhausted" && (
          <AlertOctagon
            className="h-4 w-4 text-rose-600 shrink-0 mt-0.5"
            aria-hidden="true"
          />
        )}
        {op.status === "cancelled" && (
          <Ban
            className="h-4 w-4 text-slate-500 shrink-0 mt-0.5"
            aria-hidden="true"
          />
        )}

        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <ToastTitle>{op.operationName}</ToastTitle>
            {op.status === "retrying" && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                Retry {op.attempt} of {op.maxRetries}
              </span>
            )}
            {op.status === "recovered" && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                Recovered
              </span>
            )}
            {op.status === "exhausted" && (
              <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                Exhausted
              </span>
            )}
            {op.status === "cancelled" && (
              <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                Cancelled
              </span>
            )}
          </div>

          {op.description && (
            <p className="text-xs text-gray-500 mt-0.5">{op.description}</p>
          )}
        </div>
      </ToastHeader>

      <ToastDescription>
        {/* Retrying Details */}
        {op.status === "retrying" && (
          <div className="space-y-2 mt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">
                Attempt {op.attempt} failed
                {op.lastError ? `: ${op.lastError}` : "."}
              </span>
              <RetryCountdown targetTimestamp={op.nextRetryAt} />
            </div>

            {/* Idempotency Warning vs Safe Retry */}
            {!op.isIdempotent ? (
              <div
                className="rounded-lg bg-amber-100/90 border border-amber-300 p-2 text-xs text-amber-900 flex items-start gap-2"
                role="alert"
                aria-label="Non-idempotent retry warning"
              >
                <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block text-amber-950">
                    Non-idempotent operation warning
                  </strong>
                  <p className="mt-0.5">
                    {op.idempotencyWarning ||
                      "Retrying this operation may risk duplicate transactions. Please verify ledger confirmation before re-submitting."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-blue-50/80 border border-blue-200 p-1.5 text-xs text-blue-800 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span>Safe retry: Read-only or idempotent query. Automated retry is safe.</span>
              </div>
            )}
          </div>
        )}

        {/* Recovered State */}
        {op.status === "recovered" && (
          <p className="mt-1 text-emerald-800">
            Network connection restored. The operation completed successfully.
          </p>
        )}

        {/* Cancelled State */}
        {op.status === "cancelled" && (
          <p className="mt-1 text-slate-600">
            Retry cancelled by user. No further automated network attempts will be made.
          </p>
        )}

        {/* Exhausted State (Final Failure) */}
        {op.status === "exhausted" && (
          <div className="space-y-2 mt-2">
            <p className="text-rose-900">
              RPC retries exhausted after {op.maxRetries} attempts.
              {op.lastError && (
                <span className="block mt-0.5 text-xs font-mono text-rose-800 bg-rose-100/60 p-1.5 rounded border border-rose-200">
                  {op.lastError}
                </span>
              )}
            </p>
            <p className="text-xs text-rose-800">
              Safe next step: Check network status, review pending transactions, or consult the remediation guide before initiating a new request.
            </p>
          </div>
        )}
      </ToastDescription>

      {/* Action Buttons */}
      <ToastActions>
        {op.status === "retrying" && !op.isIdempotent && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => cancelOperation(op.id, "User cancelled non-idempotent retry")}
            className="h-7 text-xs border-amber-300 text-amber-900 hover:bg-amber-100"
          >
            Cancel retry
          </Button>
        )}

        {op.status === "exhausted" && (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleOpenRemediation}
            className="h-7 text-xs bg-rose-700 hover:bg-rose-800 text-white gap-1"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            {op.remediationActionLabel || "Open Remediation Guide"}
          </Button>
        )}
      </ToastActions>
    </Toast>
  );
}

export function RetryToastCenter() {
  const operations = useNetworkStatusStore((state) => state.operations);

  if (operations.length === 0) {
    return null;
  }

  return (
    <ToastContainer position="bottom-right" data-testid="retry-toast-center">
      {operations.map((op) => (
        <RetryToastItem key={op.id} op={op} />
      ))}
    </ToastContainer>
  );
}

export default RetryToastCenter;
