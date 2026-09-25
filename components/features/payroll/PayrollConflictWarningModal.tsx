"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw, ArrowRight, ShieldAlert, Check } from "lucide-react";
import type { PayrollConflictWarningState } from "@/hooks/usePayrollConflictWarning";
import { cn } from "@/lib/utils";

export interface PayrollConflictWarningModalProps {
  state: PayrollConflictWarningState;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function PayrollConflictWarningModal({
  state,
  isOpen,
  onClose,
  title = "Payroll Data Conflict Detected",
}: PayrollConflictWarningModalProps) {
  const {
    conflictDetails,
    isResolving,
    error,
    resolveWithRemote,
    confirmOverwrite,
  } = state;

  const [acknowledgeOverwrite, setAcknowledgeOverwrite] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const safeActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setAcknowledgeOverwrite(false);
      setLocalError(null);
      // Focus safe action by default to prevent accidental destructive overwrite
      setTimeout(() => {
        safeActionRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isResolving) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isResolving, onClose]);

  if (!isOpen || !conflictDetails) return null;

  const handleReload = async () => {
    setLocalError(null);
    const ok = await resolveWithRemote();
    if (ok) {
      onClose();
    }
  };

  const handleOverwrite = async () => {
    if (!acknowledgeOverwrite) {
      setLocalError("Please confirm that you want to overwrite remote changes.");
      return;
    }
    setLocalError(null);
    const ok = await confirmOverwrite();
    if (ok) {
      onClose();
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
      aria-describedby="conflict-dialog-desc"
      data-testid="payroll-conflict-warning-modal"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="conflict-dialog-title"
              className="text-base font-semibold text-gray-900"
            >
              {title}
            </h2>
            <p
              id="conflict-dialog-desc"
              className="mt-1 text-xs sm:text-sm text-gray-600"
            >
              Another user or background process has updated this payroll period
              since you loaded it. Overwriting may lose concurrent approvals,
              dispute fixes, or status changes.
            </p>
          </div>
        </div>

        {/* Conflict Differences Preview */}
        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Conflict Details
          </h3>
          <p className="mt-1 text-xs text-amber-900 font-medium">
            {conflictDetails.changeDescription}
          </p>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-gray-200 bg-white p-2.5">
              <span className="font-semibold text-gray-500 block">Your Loaded Version</span>
              <div className="mt-1 space-y-0.5 text-gray-700">
                <p>Status: <span className="font-medium text-gray-900">{conflictDetails.baseStatus ?? "Unknown"}</span></p>
                <p>Updated: <span className="font-medium text-gray-900">{conflictDetails.baseUpdatedAt ? new Date(conflictDetails.baseUpdatedAt).toLocaleTimeString() : "Initial"}</span></p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5">
              <span className="font-semibold text-amber-800 block">Remote Published Version</span>
              <div className="mt-1 space-y-0.5 text-gray-700">
                <p>Status: <span className="font-medium text-amber-950">{conflictDetails.remoteStatus ?? "Modified"}</span></p>
                <p>Updated: <span className="font-medium text-amber-950">{conflictDetails.remoteUpdatedAt ? new Date(conflictDetails.remoteUpdatedAt).toLocaleTimeString() : "Recent"}</span></p>
                {conflictDetails.remoteEditor && (
                  <p>By: <span className="font-medium text-amber-950">{conflictDetails.remoteEditor}</span></p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Overwrite Confirmation Checkbox */}
        <div className="mt-4 rounded-lg border border-red-100 bg-red-50/60 p-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledgeOverwrite}
              onChange={(e) => {
                setAcknowledgeOverwrite(e.target.checked);
                setLocalError(null);
              }}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              aria-describedby="overwrite-warning-text"
            />
            <span id="overwrite-warning-text" className="text-xs text-red-900">
              I acknowledge that overwriting will force my version and replace remote changes made by other operators.
            </span>
          </label>
        </div>

        {/* Error message */}
        {(error || localError) && (
          <div
            role="alert"
            className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error || localError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isResolving}
            className="inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
          >
            Keep local draft
          </button>

          <button
            type="button"
            onClick={() => void handleOverwrite()}
            disabled={!acknowledgeOverwrite || isResolving}
            className="inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Overwrite remote changes
          </button>

          <button
            ref={safeActionRef}
            type="button"
            onClick={() => void handleReload()}
            disabled={isResolving}
            className="inline-flex min-h-[44px] sm:min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-4 w-4", isResolving && "animate-spin")}
              aria-hidden="true"
            />
            {isResolving ? "Reloading..." : "Reload latest version"}
          </button>
        </div>
      </div>
    </div>
  );
}
