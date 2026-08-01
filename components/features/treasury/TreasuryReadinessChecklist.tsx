"use client";

import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { useTreasuryReadiness } from "@/hooks/useTreasuryReadiness";
import type { ReadinessItem, ReadinessStatus } from "@/lib/treasury/readiness";

const STATUS_LABEL: Record<ReadinessStatus, string> = {
  pass: "Ready",
  warning: "Needs attention",
  failed: "Blocked",
};

const STATUS_ICON: Record<ReadinessStatus, typeof CheckCircle2> = {
  pass: CheckCircle2,
  warning: AlertCircle,
  failed: XCircle,
};

const STATUS_TONE: Record<ReadinessStatus, string> = {
  pass: "bg-green-50 text-green-700 border-green-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

const OVERALL_COPY: Record<
  ReadinessStatus,
  { label: string; description: string }
> = {
  pass: {
    label: "Treasury is ready for payroll",
    description:
      "All readiness checks pass. You can proceed with payroll submission.",
  },
  warning: {
    label: "Treasury has warnings",
    description:
      "Payroll can still be submitted, but we recommend resolving the warnings first.",
  },
  failed: {
    label: "Treasury is blocked",
    description:
      "Payroll submission is blocked. Address the failed checks below before continuing.",
  },
};

export interface TreasuryReadinessChecklistProps {
  /** Optional override for the projected payroll amount. */
  projectedPayroll?: number;
  /** Optional override for the treasury balance. */
  balance?: number;
  /** Optional className for the outer section. */
  className?: string;
}

function ChecklistRow({ item }: { item: ReadinessItem }) {
  const Icon = STATUS_ICON[item.status];
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${STATUS_TONE[item.status]}`}
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-gray-900">{item.title}</p>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[item.status]}`}
            role="status"
            aria-label={`Status: ${STATUS_LABEL[item.status]}`}
          >
            {STATUS_LABEL[item.status]}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-600">{item.description}</p>
        {item.recoveryHref && item.recoveryLabel && (
          <Link
            href={item.recoveryHref}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            aria-label={`${item.recoveryLabel} for ${item.title}`}
          >
            {item.recoveryLabel}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        )}
      </div>
    </li>
  );
}

/**
 * Pre-payroll treasury readiness checklist.
 *
 * Renders five checks (balance, asset, network, wallet, permissions) along
 * with an overall banner. The component subscribes directly to wallet and
 * company stores, so it updates automatically when the user connects a wallet,
 * switches network, or completes company setup.
 */
export function TreasuryReadinessChecklist({
  projectedPayroll,
  balance,
  className = "",
}: TreasuryReadinessChecklistProps) {
  const readiness = useTreasuryReadiness({ projectedPayroll, balance });
  const OverallIcon = STATUS_ICON[readiness.overall];
  const overall = OVERALL_COPY[readiness.overall];

  return (
    <section
      aria-labelledby="treasury-readiness-heading"
      data-testid="treasury-readiness"
      className={`bg-white rounded-lg shadow-sm ${className}`}
    >
      <header
        className={`flex items-start gap-3 rounded-t-lg border-b p-4 ${STATUS_TONE[readiness.overall]}`}
      >
        <OverallIcon className="h-5 w-5 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h3
            id="treasury-readiness-heading"
            className="text-sm font-semibold"
          >
            {overall.label}
          </h3>
          <p className="mt-0.5 text-xs">{overall.description}</p>
        </div>
      </header>

      <ul
        className="divide-y divide-gray-100 px-4"
        aria-label="Treasury readiness checks"
      >
        {readiness.items.map((item) => (
          <ChecklistRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

export default TreasuryReadinessChecklist;
