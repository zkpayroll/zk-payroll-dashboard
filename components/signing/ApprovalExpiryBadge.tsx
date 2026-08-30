"use client";

import { AlertTriangle, CheckCircle2, Clock, FileWarning, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  evaluateApprovalExpiry,
  formatApprovalCountdown,
  type ApprovalExpiryState,
  type ApprovalExpiryInput,
} from "@/lib/date/approvalExpiry";

const STATE_CONFIG: Record<ApprovalExpiryState, { icon: LucideIcon; badgeClass: string }> = {
  active: {
    icon: CheckCircle2,
    badgeClass: "bg-green-50 text-green-700 border-green-200",
  },
  expiring_soon: {
    icon: Clock,
    badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
  },
  expired: {
    icon: AlertTriangle,
    badgeClass: "bg-red-50 text-red-700 border-red-200",
  },
  missing: {
    icon: FileWarning,
    badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
  },
};

export interface ApprovalExpiryBadgeProps {
  /** Approval metadata */
  approval?: ApprovalExpiryInput | null;
  /** Shorthand props for direct usage */
  approvedAt?: string | null;
  expiresAt?: string | null;
  approvalStatus?: string | null;
  hasApproval?: boolean;
  /** Injected clock for deterministic rendering/tests */
  now?: number;
  /** Route for renewal action */
  renewalHref?: string;
  renewalLabel?: string;
}

/**
 * Badge that shows whether payroll approvals are active, expiring soon, expired, or missing.
 * Intended for payroll detail headers so expiry is visible before execution.
 * Privacy-safe: only timestamps/status, no salary amounts.
 */
export function ApprovalExpiryBadge({
  approval,
  approvedAt,
  expiresAt,
  approvalStatus,
  hasApproval,
  now = Date.now(),
  renewalHref = "/payroll/approvals",
  renewalLabel = "Renew approval",
}: ApprovalExpiryBadgeProps) {
  const input: ApprovalExpiryInput = approval ?? { approvedAt, expiresAt, approvalStatus, hasApproval };
  // If caller passed nothing, treat as missing
  const effective: ApprovalExpiryInput =
    !approval && approvedAt === undefined && expiresAt === undefined && approvalStatus === undefined && hasApproval === undefined
      ? { hasApproval: false }
      : input;

  const evaluation = evaluateApprovalExpiry(effective, now);
  const config = STATE_CONFIG[evaluation.state];
  const Icon = config.icon;

  return (
    <div
      data-testid={`approval-expiry-${evaluation.state}`}
      role="status"
      aria-label={`Approval status: ${evaluation.label}`}
      className={`inline-flex max-w-xs flex-col gap-1 rounded-lg border px-2.5 py-1.5 ${config.badgeClass}`}
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {evaluation.label}
        {evaluation.remainingMs !== null && evaluation.remainingMs > 0 && (
          <span className="font-normal tabular-nums">· {formatApprovalCountdown(evaluation.remainingMs)} left</span>
        )}
      </span>
      <span className="text-xs font-normal leading-snug">{evaluation.message}</span>
      {(evaluation.state === "expired" || evaluation.state === "expiring_soon" || evaluation.state === "missing") &&
        renewalHref &&
        renewalLabel && (
          <Link
            href={renewalHref}
            data-testid="approval-renewal-link"
            className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2 hover:no-underline"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            {renewalLabel}
          </Link>
        )}
    </div>
  );
}

export default ApprovalExpiryBadge;
