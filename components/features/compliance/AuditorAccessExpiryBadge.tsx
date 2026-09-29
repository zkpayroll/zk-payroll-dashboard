"use client";

import { AlertTriangle, CheckCircle2, Clock, HelpCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  evaluateAuditorAccessExpiry,
  type AuditorAccessExpiryState,
} from "@/lib/date/auditorAccessExpiry";
import type { ViewKey } from "@/types";

const STATE_CONFIG: Record<
  AuditorAccessExpiryState,
  { icon: LucideIcon; className: string }
> = {
  active: {
    icon: CheckCircle2,
    className: "bg-green-50 text-green-700 border-green-200",
  },
  expiring_soon: {
    icon: Clock,
    className: "bg-amber-50 text-amber-800 border-amber-200",
  },
  expired: {
    icon: AlertTriangle,
    className: "bg-red-50 text-red-700 border-red-200",
  },
  unknown: {
    icon: HelpCircle,
    className: "bg-gray-100 text-gray-700 border-gray-200",
  },
};

export interface AuditorAccessExpiryBadgeProps {
  viewKey: Pick<ViewKey, "expiresAt" | "isActive" | "revokedAt">;
  now?: number;
  warningWindowMs?: number;
}

export default function AuditorAccessExpiryBadge({
  viewKey,
  now = Date.now(),
  warningWindowMs,
}: AuditorAccessExpiryBadgeProps) {
  const evaluation = evaluateAuditorAccessExpiry(
    viewKey,
    now,
    warningWindowMs,
  );
  const config = STATE_CONFIG[evaluation.state];
  const Icon = config.icon;

  return (
    <span
      role="status"
      data-testid={`auditor-access-expiry-${evaluation.state}`}
      title={evaluation.message}
      aria-label={`Auditor access status: ${evaluation.label}. ${evaluation.message}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {evaluation.label}
    </span>
  );
}

