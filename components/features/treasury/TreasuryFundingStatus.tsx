"use client";

import { useMemo } from "react";
import {
  Wallet,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { MOCK_TREASURY_BALANCE, MOCK_PAYROLL_RUNS, MOCK_COMPANIES } from "@/lib/api/mockData";
import { getNextUpcoming } from "@/lib/payroll/scheduleUtils";

interface TreasuryFundingStatusProps {
  showDetails?: boolean;
  className?: string;
}

type ReadinessLevel = "ready" | "low_buffer" | "insufficient";

export default function TreasuryFundingStatus({
  showDetails = false,
  className = "",
}: TreasuryFundingStatusProps) {
  const { balance, projectedPayroll, lastFunded } = MOCK_TREASURY_BALANCE;
  const company = MOCK_COMPANIES[0];

  const nextRun = useMemo(() => getNextUpcoming(MOCK_PAYROLL_RUNS), []);

  const readiness: ReadinessLevel = useMemo(() => {
    if (balance < projectedPayroll) return "insufficient";
    if (balance - projectedPayroll < 25000) return "low_buffer";
    return "ready";
  }, [balance, projectedPayroll]);

  const readinessConfig = {
    ready: {
      icon: CheckCircle2,
      label: "Treasury Funded",
      description: "Sufficient balance for upcoming payroll",
      containerClass: "bg-green-50 border-green-200",
      iconClass: "text-green-600",
      textClass: "text-green-800",
      subtextClass: "text-green-700",
    },
    low_buffer: {
      icon: AlertTriangle,
      label: "Low Buffer",
      description: "Balance is adequate but buffer is below recommended threshold",
      containerClass: "bg-amber-50 border-amber-200",
      iconClass: "text-amber-600",
      textClass: "text-amber-800",
      subtextClass: "text-amber-700",
    },
    insufficient: {
      icon: AlertTriangle,
      label: "Insufficient Funds",
      description: "Projected payroll exceeds available treasury balance",
      containerClass: "bg-red-50 border-red-200",
      iconClass: "text-red-600",
      textClass: "text-red-800",
      subtextClass: "text-red-700",
    },
  };

  const config = readinessConfig[readiness];
  const StatusIcon = config.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-lg border p-4 ${config.containerClass} ${className}`}
    >
      <div className="flex items-start gap-3">
        <StatusIcon className={`w-5 h-5 mt-0.5 shrink-0 ${config.iconClass}`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-semibold ${config.textClass}`}>
              {config.label}
            </p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/60 ${config.textClass}`}>
              ${balance.toLocaleString()} USDC
            </span>
          </div>
          <p className={`text-sm mt-0.5 ${config.subtextClass}`}>
            {config.description}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <div className="flex items-center gap-1.5">
              <DollarSign className={`w-3.5 h-3.5 ${config.iconClass}`} aria-hidden="true" />
              <span className={config.subtextClass}>
                <span className="font-medium">Projected:</span> ${projectedPayroll.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {balance >= projectedPayroll ? (
                <TrendingUp className="w-3.5 h-3.5 text-green-600" aria-hidden="true" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
              )}
              <span className={config.subtextClass}>
                <span className="font-medium">After payroll:</span>{" "}
                {balance >= projectedPayroll ? "$" : "-$"}
                {Math.abs(balance - projectedPayroll).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Wallet className={`w-3.5 h-3.5 ${config.iconClass}`} aria-hidden="true" />
              <span className={config.subtextClass}>
                Last funded: {new Date(lastFunded).toLocaleDateString()}
              </span>
            </div>
          </div>

          {nextRun && (
            <div className={`mt-2 text-xs ${config.subtextClass} opacity-80`}>
              Next scheduled run: {new Date(nextRun.timestamp).toLocaleDateString()} &middot; $
              {nextRun.totalAmount.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {showDetails && company && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-20">
          <div className="flex items-center gap-2 text-xs">
            <span className={`font-mono ${config.subtextClass} opacity-70 truncate`}>
              Treasury: {company.treasury}
            </span>
          </div>
          <div className="mt-1.5 flex gap-2">
            {readiness === "insufficient" && (
              <a
                href="/treasury"
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors`}
              >
                Fund Treasury
              </a>
            )}
            <a
              href="/treasury"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-white/60 hover:bg-white transition-colors ${config.textClass}`}
            >
              View Treasury
            </a>
          </div>
        </div>
      )}
    </div>
  );
}