'use client';

import React from 'react';
import {
  calculatePeriodHealth,
  PayrollPeriodMetrics,
  PeriodHealthStatus,
} from '@/lib/payroll/periodHealth';
import { Activity, AlertTriangle, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';

interface PeriodHealthSummaryCardProps {
  metrics: PayrollPeriodMetrics;
  onResolveBlockers?: () => void;
  className?: string;
}

const statusBadgeStyles: Record<PeriodHealthStatus, string> = {
  healthy: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  critical: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20',
};

const statusIcons: Record<PeriodHealthStatus, React.ReactNode> = {
  healthy: <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
  critical: <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />,
};

export const PeriodHealthSummaryCard: React.FC<PeriodHealthSummaryCardProps> = ({
  metrics,
  onResolveBlockers,
  className = '',
}) => {
  const health = calculatePeriodHealth(metrics);

  return (
    <div className={`bg-card text-card-foreground border rounded-lg p-5 shadow-sm space-y-4 ${className}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold text-base tracking-tight">{health.periodLabel}</h3>
            <p className="text-xs text-muted-foreground">
              Period Health &amp; Readiness Summary
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadgeStyles[health.status]}`}
          >
            {statusIcons[health.status]}
            {health.statusBadgeText}
          </span>
          <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-accent text-accent-foreground rounded">
            Score: {health.healthScore}/100
          </span>
        </div>
      </div>

      <p className="text-xs text-foreground/90">{health.summaryMessage}</p>

      {/* Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-1">
        <div className="bg-muted/50 p-2.5 rounded border text-center">
          <div className="text-xs text-muted-foreground">Total Batches</div>
          <div className="text-base font-bold mt-0.5">{metrics.totalBatchesCount}</div>
        </div>

        <div className="bg-muted/50 p-2.5 rounded border text-center">
          <div className="text-xs text-muted-foreground">Pending Approvals</div>
          <div className="text-base font-bold mt-0.5">{metrics.pendingApprovalsCount}</div>
        </div>

        <div className="bg-muted/50 p-2.5 rounded border text-center">
          <div className="text-xs text-muted-foreground">Unresolved Exceptions</div>
          <div className="text-base font-bold mt-0.5">{metrics.unresolvedExceptionsCount}</div>
        </div>

        <div className="bg-muted/50 p-2.5 rounded border text-center">
          <div className="text-xs text-muted-foreground">Days to Cutoff</div>
          <div className="text-base font-bold mt-0.5 flex items-center justify-center gap-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {metrics.daysUntilCutoff}d
          </div>
        </div>
      </div>

      {/* Funding Readiness Progress Bar */}
      <div>
        <div className="flex justify-between text-xs mb-1 font-medium">
          <span>Treasury Funding Readiness</span>
          <span>{metrics.fundingReadinessPercentage}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            role="progressbar"
            aria-valuenow={metrics.fundingReadinessPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            className={`h-full transition-all duration-300 ${
              metrics.fundingReadinessPercentage >= 80
                ? 'bg-green-500'
                : metrics.fundingReadinessPercentage >= 50
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, metrics.fundingReadinessPercentage))}%` }}
          />
        </div>
      </div>

      {/* Blockers & Recommendations */}
      {health.blockers.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 rounded p-3 text-xs space-y-1.5">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Active Period Blockers ({health.blockers.length})
          </div>
          <ul className="list-disc list-inside space-y-1 pl-1">
            {health.blockers.map((b, idx) => (
              <li key={idx}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {onResolveBlockers && health.blockers.length > 0 && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onResolveBlockers}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            Resolve Active Blockers
          </button>
        </div>
      )}
    </div>
  );
};
