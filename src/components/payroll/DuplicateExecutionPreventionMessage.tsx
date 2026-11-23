"use client";

import React, { useState } from "react";
import { AlertCircle, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DuplicateExecutionPreventionMessageProps {
  payrollId: string;
  previousExecutionTime: string;
  previousExecutionHash?: string;
  preventionReason: string;
  className?: string;
  onDismiss?: () => void;
  onViewPrevious?: () => void;
}

export function DuplicateExecutionPreventionMessage({
  payrollId,
  previousExecutionTime,
  previousExecutionHash,
  preventionReason,
  className,
  onDismiss,
  onViewPrevious,
}: DuplicateExecutionPreventionMessageProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  if (isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const handleCopyHash = () => {
    if (previousExecutionHash) {
      navigator.clipboard.writeText(previousExecutionHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="duplicate-execution-prevention-message"
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border border-orange-300 bg-orange-50 p-4 text-orange-900 shadow-sm sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3 flex-1">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-200 text-orange-800">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
        </span>

        <div className="space-y-2 flex-1">
          <h3 className="text-sm font-semibold text-orange-950">
            Duplicate execution detected
          </h3>

          <p className="text-xs text-orange-800 sm:text-sm">
            {preventionReason}
          </p>

          <div className="space-y-1.5 text-xs">
            <div>
              <p className="font-medium text-orange-950">Payroll ID:</p>
              <code className="bg-orange-100 px-2 py-1 rounded text-orange-900 font-mono text-xs block mt-0.5">
                {payrollId}
              </code>
            </div>

            <div>
              <p className="font-medium text-orange-950">Previous execution:</p>
              <p className="text-orange-800 mt-0.5">
                {new Date(previousExecutionTime).toLocaleString()}
              </p>
            </div>

            {previousExecutionHash && (
              <div>
                <p className="font-medium text-orange-950">Execution hash:</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="bg-orange-100 px-2 py-1 rounded text-orange-900 font-mono text-xs flex-1 truncate">
                    {previousExecutionHash}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyHash}
                    title={copiedHash ? "Copied!" : "Copy hash"}
                    className="p-1 rounded hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0 sm:flex-col sm:flex-shrink-0">
        {onViewPrevious && (
          <button
            type="button"
            onClick={onViewPrevious}
            className="inline-flex min-h-[44px] sm:min-h-[36px] items-center justify-center rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-orange-900 shadow-xs hover:bg-orange-100/60 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 w-full sm:w-auto"
          >
            View previous
          </button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss message"
          className="inline-flex min-h-[44px] sm:min-h-[36px] min-w-[44px] sm:min-w-[36px] items-center justify-center rounded-lg text-orange-700 hover:bg-orange-200/50 focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default DuplicateExecutionPreventionMessage;
