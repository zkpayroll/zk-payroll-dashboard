"use client";

import React from "react";
import { Lock, AlertCircle } from "lucide-react";

export type LockState =
  | "signing"
  | "submission"
  | "confirmation"
  | "reconciliation"
  | null;

interface PayrollLockIndicatorProps {
  lockState: LockState;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
}

const LOCK_CONFIG: Record<
  Exclude<LockState, null>,
  { label: string; description: string; color: string; bgColor: string }
> = {
  signing: {
    label: "Signing",
    description:
      "Payroll is awaiting wallet signature. Data is locked to prevent unsafe edits.",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  submission: {
    label: "Submitting",
    description:
      "Payroll is being submitted to the blockchain. Data is locked to prevent unsafe edits.",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  confirmation: {
    label: "Confirming",
    description:
      "Payroll submission is being confirmed on-chain. Data is locked to prevent unsafe edits.",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
  reconciliation: {
    label: "Reconciling",
    description:
      "Payroll is undergoing reconciliation. Data is locked to prevent unsafe edits.",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
};

/**
 * Displays a lock indicator when a payroll run is in a locked state.
 * Lock states prevent unsafe edits during critical operations:
 * - signing: Awaiting wallet signature
 * - submission: Being submitted to blockchain
 * - confirmation: Awaiting confirmation
 * - reconciliation: Undergoing reconciliation
 */
export function PayrollLockIndicator({
  lockState,
  showLabel = true,
  size = "md",
  showTooltip = true,
}: PayrollLockIndicatorProps) {
  if (!lockState) return null;

  const config = LOCK_CONFIG[lockState];
  const sizeClasses = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const iconSize = sizeClasses[size];
  const badgePadding =
    size === "sm"
      ? "px-1.5 py-0.5"
      : size === "md"
        ? "px-2 py-1"
        : "px-3 py-1.5";
  const fontSize =
    size === "sm" ? "text-[10px]" : size === "md" ? "text-xs" : "text-sm";

  const content = (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium border border-current/20 ${config.bgColor} ${config.color} ${badgePadding} ${fontSize}`}
    >
      <Lock className={`${iconSize} shrink-0`} aria-hidden="true" />
      {showLabel && <span>{config.label}</span>}
    </span>
  );

  if (!showTooltip) return content;

  return (
    <div className="group relative inline-block">
      {content}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1.5 text-xs text-white bg-gray-900 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
        <p>{config.description}</p>
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  );
}

interface PayrollLockBannerProps {
  lockState: LockState;
}

/**
 * Full-width banner that displays when payroll is locked.
 * Used at the top of payroll detail pages.
 */
export function PayrollLockBanner({ lockState }: PayrollLockBannerProps) {
  if (!lockState) return null;

  const config = LOCK_CONFIG[lockState];

  return (
    <div
      className={`rounded-lg border ${config.bgColor} border-current/20 p-4 flex items-start gap-3`}
    >
      <Lock
        className={`w-5 h-5 ${config.color} mt-0.5 shrink-0`}
        aria-hidden="true"
      />
      <div className="flex-1">
        <h3 className={`font-semibold text-sm ${config.color}`}>
          Payroll in {config.label} State
        </h3>
        <p className={`text-sm mt-1 ${config.color} opacity-90`}>
          {config.description} Do not close the browser or disconnect your
          wallet.
        </p>
      </div>
    </div>
  );
}

interface PayrollLockOverlayProps {
  lockState: LockState;
}

/**
 * Overlay component that disables interaction during lock states.
 * Can be placed over editable sections to prevent unsafe edits.
 */
export function PayrollLockOverlay({ lockState }: PayrollLockOverlayProps) {
  if (!lockState) return null;

  const config = LOCK_CONFIG[lockState];

  return (
    <div className="absolute inset-0 bg-black/5 backdrop-blur-[1px] rounded-lg flex items-center justify-center z-40 cursor-not-allowed">
      <div className="flex flex-col items-center gap-2 pointer-events-none">
        <Lock className={`w-6 h-6 ${config.color}`} />
        <p className={`text-xs font-medium ${config.color}`}>{config.label}</p>
      </div>
    </div>
  );
}
