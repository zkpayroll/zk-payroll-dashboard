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
import {
  RECONCILIATION_FALLBACK_STATUS,
  RECONCILIATION_STATUS_BADGE_SPECS,
} from "@/src/payroll/statusBadges";

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

/** Glyphs for the reconciliation outcomes, keyed by the contract's statuses. */
const RECONCILIATION_STATUS_ICONS: Record<
  string,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  matched: CheckCircle2,
  pending: Clock,
  mismatched: AlertTriangle,
  failed: XCircle,
  manually_reviewed: Eye,
};

/**
 * Labels, colour variants, and tooltips come from the shared contract in
 * @/src/payroll/statusBadges so the visual regression suite can hold the
 * colours, words, and contrast of every outcome to one declared standard.
 */
const RECONCILIATION_CONFIG: Record<
  ReconciliationBadgeStatus,
  ReconciliationStatusConfig
> = Object.fromEntries(
  RECONCILIATION_STATUS_BADGE_SPECS.map((spec) => [
    spec.status,
    {
      label: spec.label,
      description: spec.description ?? "",
      variant: spec.variant as BadgeVariant,
      icon: RECONCILIATION_STATUS_ICONS[spec.status],
    },
  ]),
) as Record<ReconciliationBadgeStatus, ReconciliationStatusConfig>;

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
  const resolvedStatus = isReconciliationOutcome(status) ? status : RECONCILIATION_FALLBACK_STATUS;
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
