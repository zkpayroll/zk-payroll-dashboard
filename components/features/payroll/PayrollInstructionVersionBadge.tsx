"use client";

import { Info } from "lucide-react";
import {
  getInstructionVersionStatus,
  type InstructionVersionState,
} from "@/src/payroll/instructionVersion";

interface PayrollInstructionVersionBadgeProps {
  /** Version of the currently saved (active) payroll policy, or null. */
  version: number | null;
  /** Version snapshotted when the run draft started, or null when unsnapshotted. */
  draftVersion: number | null;
}

const STYLES: Record<InstructionVersionState, { pill: string; icon: string }> = {
  current: {
    pill: "bg-indigo-50 text-indigo-700 border-indigo-200",
    icon: "text-indigo-400",
  },
  stale: {
    pill: "bg-amber-50 text-amber-800 border-amber-300",
    icon: "text-amber-500",
  },
  unconfigured: {
    pill: "bg-gray-50 text-gray-600 border-gray-200",
    icon: "text-gray-400",
  },
};

/**
 * Small version pill showing which payroll instruction (compiled policy
 * payload) governs the current run (#534). Renders only counts and version
 * metadata — never amounts or employee data — and is announced to screen
 * readers via the tooltip's accessible name.
 */
export function PayrollInstructionVersionBadge({
  version,
  draftVersion,
}: PayrollInstructionVersionBadgeProps) {
  const status = getInstructionVersionStatus(version, draftVersion);
  if (status.state === "unconfigured") return null;

  const { pill, icon } = STYLES[status.state];

  return (
    <span
      data-testid="instruction-version-badge"
      data-state={status.state}
      title={status.detail ?? undefined}
      aria-label={`Payroll instructions ${status.label}. ${status.detail}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold cursor-help ${pill}`}
    >
      <Info className={`h-3 w-3 ${icon}`} aria-hidden="true" />
      <span className="font-mono">{status.label}</span>
      {status.state === "stale" && <span aria-hidden="true">·</span>}
      {status.state === "stale" && <span>drafted</span>}
    </span>
  );
}

export default PayrollInstructionVersionBadge;
