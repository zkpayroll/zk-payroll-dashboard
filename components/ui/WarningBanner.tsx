"use client";

import { AlertTriangle, Info, ShieldAlert, XCircle } from "lucide-react";
import type { MismatchSeverity } from "@/stores/contractCapabilities";

interface WarningBannerProps {
  severity: MismatchSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const SEVERITY_STYLES: Record<MismatchSeverity, { container: string; icon: React.ReactNode; titleColor: string }> = {
  info: {
    container: "bg-blue-50 border-blue-200",
    icon: <Info className="w-5 h-5 text-blue-600 shrink-0" />,
    titleColor: "text-blue-800",
  },
  warning: {
    container: "bg-amber-50 border-amber-200",
    icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
    titleColor: "text-amber-800",
  },
  critical: {
    container: "bg-red-50 border-red-200",
    icon: <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />,
    titleColor: "text-red-800",
  },
};

export default function WarningBanner({
  severity,
  title,
  message,
  actionLabel,
  onAction,
  onDismiss,
  className = "",
}: WarningBannerProps) {
  const styles = SEVERITY_STYLES[severity];

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border ${styles.container} ${className}`}
      role="alert"
    >
      <div className="shrink-0 mt-0.5">{styles.icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${styles.titleColor}`}>{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{message}</p>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="mt-2 text-sm font-medium text-blue-600 hover:underline"
          >
            {actionLabel}
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 p-1 hover:bg-white/50 rounded text-muted-foreground"
          aria-label="Dismiss warning"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
