"use client";

import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

export type SuspensionStatus = "active" | "suspended" | "pending_reinstatement";

export interface EmployeeSuspensionPayoutStatusViewProps {
  employeeReference: string;
  status: SuspensionStatus;
  suspensionDate?: string;
  reinstatementDate?: string;
  reason?: string;
}

export function EmployeeSuspensionPayoutStatusView({
  employeeReference,
  status,
  suspensionDate,
  reinstatementDate,
  reason,
}: EmployeeSuspensionPayoutStatusViewProps) {
  const statusConfig = {
    active: {
      icon: CheckCircle2,
      label: "Active",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      textColor: "text-green-700",
    },
    suspended: {
      icon: AlertCircle,
      label: "Suspended",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      textColor: "text-red-700",
    },
    pending_reinstatement: {
      icon: Clock,
      label: "Pending reinstatement",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      textColor: "text-amber-700",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4 ${config.textColor}`}
      data-testid={`employee-suspension-status-${status}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold">
            {employeeReference} - {config.label}
          </h3>
          {suspensionDate && (
            <p className="text-xs mt-1">
              Suspension date: <span className="font-mono">{suspensionDate}</span>
            </p>
          )}
          {reinstatementDate && (
            <p className="text-xs mt-1">
              Reinstatement date: <span className="font-mono">{reinstatementDate}</span>
            </p>
          )}
          {reason && <p className="text-xs mt-2">{reason}</p>}
        </div>
      </div>
    </div>
  );
}

export default EmployeeSuspensionPayoutStatusView;
