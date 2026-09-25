"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PayrollRun, ReconciliationOutcome } from "@/types/models";
import {
  isReconciliationOutcome,
  RECONCILIATION_STATUS_LABELS,
  resolveReconciliationStatus,
} from "@/lib/reconciliation/status";

export type ReconciliationBadgeStatus = ReconciliationOutcome;

type BadgeVariant =
  | "success"
  | "warning"
  | "info"
  | "error"
  | "secondary";

interface ReconciliationStatusConfig {
  label: string;
  description: string;
  variant: BadgeVariant;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const RECONCILIATION_CONFIG: Record<
  ReconciliationBadgeStatus,
  ReconciliationStatusConfig
> = {
  matched: {
    label: "Matched",
    description: "All expected payments were reconciled.",
    variant: "success",
    icon: CheckCircle2,
  },
  pending: {
    label: "Pending",
    description: "Reconciliation is still in progress. Check again after settlement.",
    variant: "info",
    icon: Clock,
  },
  mismatched: {
    label: "Mismatched",
    description: "Reconciliation found a mismatch. Open the payroll run for details.",
    variant: "warning",
    icon: AlertTriangle,
  },
  failed: {
    label: "Failed",
    description: "Reconciliation could not complete. Open the payroll run to review and retry.",
    variant: "error",
    icon: XCircle,
  },
  manually_reviewed: {
    label: "Manually reviewed",
    description: "A reviewer acknowledged this reconciliation outcome.",
    variant: "secondary",
    icon: Eye,
  },
};

export interface ReconciliationStatusBadgeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  status: ReconciliationBadgeStatus;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export function ReconciliationStatusBadge({
  status,
  showIcon = true,
  size = "sm",
  className,
  ...props
}: ReconciliationStatusBadgeProps) {
  const resolvedStatus = isReconciliationOutcome(status) ? status : "pending";
  const config = RECONCILIATION_CONFIG[resolvedStatus];
  const Icon = config.icon;
  const sizeClass = size === "md" ? "px-2.5 py-1 text-sm" : "px-2.5 py-0.5 text-xs";

  return (
    <Badge
      {...props}
      variant={config.variant}
      className={`inline-flex items-center gap-1 font-medium rounded-full ${sizeClass} ${className || ""}`}
      role="status"
      aria-label={`Reconciliation: ${config.label}`}
      title={config.description}
      data-testid="reconciliation-status-badge"
    >
      {showIcon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      <span>{config.label}</span>
    </Badge>
  );
}

interface ReconciliationBadgeProps {
  payrollRun: PayrollRun;
  variant?: "compact" | "detailed";
}

export function ReconciliationBadge({
  payrollRun,
  variant = "compact",
}: ReconciliationBadgeProps) {
  const status = resolveReconciliationStatus(payrollRun);

  if (variant === "detailed") {
    return (
      <div className="space-y-2">
        <ReconciliationStatusBadge status={status} size="md" />
        <p className="text-xs text-gray-600">
          Open the payroll run for reconciliation progress and reviewer context.
        </p>
      </div>
    );
  }

  return <ReconciliationStatusBadge status={status} />;
}

export function ReconciliationSummary({ payrollRun }: { payrollRun: PayrollRun }) {
  const details = payrollRun.reconciliationDetails;
  const status = resolveReconciliationStatus(payrollRun);

  if (!details) return null;

  const percentage =
    details.totalCount > 0
      ? Math.round((details.processedCount / details.totalCount) * 100)
      : 0;
  const statusLabel = RECONCILIATION_STATUS_LABELS[status];

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Reconciliation Progress</span>
        <span className="font-medium">
          {details.processedCount}/{details.totalCount} · {statusLabel}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${
            status === "matched"
              ? "bg-green-600"
              : status === "mismatched"
                ? "bg-amber-600"
                : status === "failed"
                  ? "bg-red-600"
                  : "bg-blue-600"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">{percentage}% complete</p>
    </div>
  );
}
