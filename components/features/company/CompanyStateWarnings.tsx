"use client";

import { useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileWarning,
  Info,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useCompanyWarningsStore } from "@/stores/companyWarnings";
import type { CompanyWarning, WarningSeverity } from "@/stores/companyWarnings";

const SEVERITY_CONFIG: Record<WarningSeverity, { container: string; icon: React.ReactNode; titleColor: string; badge: string }> = {
  info: {
    container: "bg-blue-50 border-blue-200",
    icon: <Info className="w-5 h-5 text-blue-600 shrink-0" />,
    titleColor: "text-blue-800",
    badge: "bg-blue-100 text-blue-700",
  },
  warning: {
    container: "bg-amber-50 border-amber-200",
    icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
    titleColor: "text-amber-800",
    badge: "bg-amber-100 text-amber-700",
  },
  critical: {
    container: "bg-red-50 border-red-200",
    icon: <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />,
    titleColor: "text-red-800",
    badge: "bg-red-100 text-red-700",
  },
};

function WarningCard({ warning, onDismiss }: { warning: CompanyWarning; onDismiss: () => void }) {
  const config = SEVERITY_CONFIG[warning.severity];

  return (
    <div className={`rounded-lg border p-4 ${config.container}`} role="alert">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{config.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`text-sm font-semibold ${config.titleColor}`}>{warning.title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badge}`}>
              {warning.severity}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{warning.message}</p>

          {warning.nextSteps.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Next steps:</p>
              <ol className="space-y-1">
                {warning.nextSteps.map((step, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {warning.blockedActions.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileWarning className="w-3.5 h-3.5" />
              <span>Blocked: {warning.blockedActions.length} action(s)</span>
            </div>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 p-1 hover:bg-white/50 rounded text-muted-foreground"
          aria-label={`Dismiss ${warning.title}`}
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function CompanyStateWarnings() {
  const {
    companyState,
    lastChecked,
    evaluateWarnings,
    dismissWarning,
    dismissAllWarnings,
    getActiveWarnings,
    hasBlockingWarnings,
    setCompanyState,
  } = useCompanyWarningsStore();

  const activeWarnings = getActiveWarnings();
  const blocking = hasBlockingWarnings();

  useEffect(() => {
    evaluateWarnings();
  }, [evaluateWarnings]);

  if (activeWarnings.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
        <div>
          <p className="text-sm font-medium text-green-800">Company is in good standing</p>
          <p className="text-xs text-green-700 mt-0.5">No warnings or blocked actions detected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {blocking && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Company actions are blocked</p>
            <p className="text-sm text-red-700 mt-0.5">
              Critical issues must be resolved before payroll can proceed.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Company Warnings ({activeWarnings.length})
        </h3>
        <button
          onClick={dismissAllWarnings}
          className="text-xs text-muted-foreground hover:underline"
        >
          Dismiss all
        </button>
      </div>

      <div className="space-y-3">
        {activeWarnings.map((warning) => (
          <WarningCard
            key={warning.id}
            warning={warning}
            onDismiss={() => dismissWarning(warning.id)}
          />
        ))}
      </div>

      {lastChecked && (
        <p className="text-xs text-muted-foreground">
          Last evaluated: {new Date(lastChecked).toLocaleString()}
        </p>
      )}
    </div>
  );
}
