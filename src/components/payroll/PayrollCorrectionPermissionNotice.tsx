"use client";

import React, { useState } from "react";
import { Shield, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PermissionDetail {
  permission: string;
  description: string;
  required: boolean;
}

export interface PayrollCorrectionPermissionNoticeProps {
  userRole: string;
  hasPermission: boolean;
  requiredPermissions: PermissionDetail[];
  className?: string;
  onDismiss?: () => void;
}

export function PayrollCorrectionPermissionNotice({
  userRole,
  hasPermission,
  requiredPermissions,
  className,
  onDismiss,
}: PayrollCorrectionPermissionNoticeProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  if (isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const borderColor = hasPermission ? "border-blue-300" : "border-amber-300";
  const bgColor = hasPermission ? "bg-blue-50" : "bg-amber-50";
  const textColor = hasPermission ? "text-blue-900" : "text-amber-900";
  const badgeBgColor = hasPermission ? "bg-blue-200" : "bg-amber-200";
  const badgeTextColor = hasPermission ? "text-blue-800" : "text-amber-800";

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="payroll-correction-permission-notice"
      className={cn(
        `relative rounded-xl border p-4 shadow-sm ${borderColor} ${bgColor} ${textColor}`,
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
            badgeBgColor,
            badgeTextColor,
          )}
        >
          <Shield className="h-4 w-4" aria-hidden="true" />
        </span>

        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold">
                Payroll correction {hasPermission ? "authorized" : "restricted"}
              </h3>
              <p className="text-xs mt-1">
                Role: <span className="font-medium">{userRole}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? "Collapse details" : "Expand details"}
              className="rounded-lg p-1 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-1"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>

          {isExpanded && (
            <div className="space-y-2 border-t border-current border-opacity-20 pt-3 mt-2">
              <p className="text-xs font-semibold">Required permissions:</p>
              <ul className="space-y-1">
                {requiredPermissions.map((perm, idx) => (
                  <li
                    key={idx}
                    data-testid={`permission-item-${idx}`}
                    className="flex items-start gap-2 text-xs"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-xs font-bold mt-0.5",
                        perm.required
                          ? "bg-current bg-opacity-20"
                          : "bg-current bg-opacity-10",
                      )}
                    >
                      {perm.required ? "●" : "○"}
                    </span>
                    <div>
                      <p className="font-medium">{perm.permission}</p>
                      <p className="text-opacity-70">{perm.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasPermission && (
            <p className="text-xs pt-2">
              You have the necessary permissions to perform payroll corrections.
            </p>
          )}

          {!hasPermission && (
            <p className="text-xs pt-2">
              Contact your administrator to request payroll correction permissions.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss notice"
          className={cn(
            "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-1",
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default PayrollCorrectionPermissionNotice;
