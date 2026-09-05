import * as React from "react";
import { CheckCircle2, Clock, XCircle, HelpCircle, AlertCircle, MessageSquareWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type StatusType =
  | "verified"
  | "pending"
  | "failed"
  | "cancelled"
  | "active"
  | "inactive"
  | "approved"
  | "rejected"
  | "correction_requested"
  | "completed"
  | "in_progress"
  | "not_started"
  | string;

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: StatusType;
  showIcon?: boolean;
}

interface StatusConfig {
  label: string;
  variant: "success" | "warning" | "destructive" | "secondary" | "info" | "default" | "error";
  icon?: React.ComponentType<any>;
}

const statusConfigs: Record<string, StatusConfig> = {
  // Payroll / Transaction statuses
  verified: {
    label: "Verified",
    variant: "success",
    icon: CheckCircle2,
  },
  pending: {
    label: "Pending",
    variant: "warning",
    icon: Clock,
  },
  failed: {
    label: "Failed",
    variant: "error",
    icon: XCircle,
  },
  cancelled: {
    label: "Cancelled",
    variant: "secondary",
    icon: XCircle,
  },

  // Employee directory statuses
  active: {
    label: "Active",
    variant: "success",
  },
  inactive: {
    label: "Inactive",
    variant: "secondary",
  },

  // Import statuses
  approved: {
    label: "Approved",
    variant: "success",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
    icon: XCircle,
  },
  correction_requested: {
    label: "Correction Requested",
    variant: "warning",
    icon: MessageSquareWarning,
  },

  // Onboarding statuses
  completed: {
    label: "Completed",
    variant: "success",
    icon: CheckCircle2,
  },
  in_progress: {
    label: "In Progress",
    variant: "warning",
    icon: Clock,
  },
  not_started: {
    label: "Not Started",
    variant: "default",
    icon: AlertCircle,
  },
};

const getFallbackConfig = (status: string): StatusConfig => {
  if (!status) {
    return {
      label: "Unknown",
      variant: "secondary",
      icon: HelpCircle,
    };
  }

  const cleanStatus = status
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return {
    label: cleanStatus,
    variant: "secondary",
    icon: HelpCircle,
  };
};

export function StatusBadge({
  status,
  showIcon = true,
  className,
  ...props
}: StatusBadgeProps) {
  const normalizedStatus = status ? status.toLowerCase() : "";
  const config = statusConfigs[normalizedStatus] || getFallbackConfig(status);
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full border transition-colors ${className || ""}`}
      role="status"
      aria-label={`Status: ${config.label}`}
      {...props}
    >
      {showIcon && Icon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      <span>{config.label}</span>
    </Badge>
  );
}

export default StatusBadge;
