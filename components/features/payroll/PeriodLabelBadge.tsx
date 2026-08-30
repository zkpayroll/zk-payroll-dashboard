"use client";

import { useMemo } from "react";
import { Calendar } from "lucide-react";
import {
  formatPeriodLabel,
  parsePeriod,
  type PeriodFormatStyle,
} from "@/lib/date/periodLabel";

export type PeriodBadgeVariant = "badge" | "pill" | "subtle" | "inline" | "card";
export type PeriodBadgeSize = "xs" | "sm" | "md" | "lg";

export interface PeriodLabelBadgeProps {
  /** Payroll run, transaction, timestamp string, or period ID */
  period?: unknown;
  /** Alias for period */
  run?: unknown;
  /** Alias for period */
  transaction?: unknown;
  /** Visual variant of the period badge */
  variant?: PeriodBadgeVariant;
  /** Size variant */
  size?: PeriodBadgeSize;
  /** Formatting style: "long" (e.g. "February 2025"), "short" (e.g. "Feb 2025"), "id" (e.g. "2025-02") */
  format?: PeriodFormatStyle;
  /** Whether to show the calendar icon */
  showIcon?: boolean;
  /** Whether to prepend a "Period: " prefix */
  showPrefix?: boolean;
  /** Custom prefix text */
  prefix?: string;
  /** Fallback text when period is invalid or missing */
  fallback?: string;
  /** Additional CSS class names */
  className?: string;
}

const SIZE_STYLES: Record<PeriodBadgeSize, { badge: string; icon: string; text: string }> = {
  xs: {
    badge: "px-1.5 py-0.5 text-[11px]",
    icon: "w-3 h-3",
    text: "text-[11px]",
  },
  sm: {
    badge: "px-2 py-0.5 text-xs",
    icon: "w-3.5 h-3.5",
    text: "text-xs",
  },
  md: {
    badge: "px-2.5 py-1 text-xs sm:text-sm",
    icon: "w-4 h-4",
    text: "text-sm",
  },
  lg: {
    badge: "px-3 py-1.5 text-sm sm:text-base font-semibold",
    icon: "w-4.5 h-4.5",
    text: "text-base font-medium",
  },
};

const VARIANT_STYLES: Record<PeriodBadgeVariant, { valid: string; invalid: string }> = {
  badge: {
    valid: "bg-indigo-50 text-indigo-700 border-indigo-200 rounded-md font-medium",
    invalid: "bg-gray-50 text-gray-500 border-dashed border-gray-300 rounded-md",
  },
  pill: {
    valid: "bg-slate-100 text-slate-800 border-slate-200 rounded-full font-medium",
    invalid: "bg-gray-100 text-gray-500 border-dashed border-gray-200 rounded-full",
  },
  subtle: {
    valid: "bg-transparent text-gray-700 border-transparent font-normal",
    invalid: "bg-transparent text-gray-400 border-transparent italic",
  },
  card: {
    valid: "bg-white text-gray-900 border-gray-200 rounded-lg shadow-sm font-medium",
    invalid: "bg-gray-50 text-gray-400 border-dashed border-gray-200 rounded-lg",
  },
  inline: {
    valid: "inline-flex text-gray-700 font-medium",
    invalid: "inline-flex text-gray-400 italic",
  },
};

/**
 * Visual period badge component for consistent period label displays
 * across payroll list and detail screens.
 *
 * Privacy-safe: Renders only human-readable period metadata.
 */
export function PeriodLabelBadge({
  period,
  run,
  transaction,
  variant = "badge",
  size = "sm",
  format = "long",
  showIcon = true,
  showPrefix = false,
  prefix: customPrefix,
  fallback = "Unassigned period",
  className = "",
}: PeriodLabelBadgeProps) {
  const target = period ?? run ?? transaction;

  const parsed = useMemo(() => parsePeriod(target), [target]);
  const sizeConfig = SIZE_STYLES[size] ?? SIZE_STYLES.sm;
  const variantConfig = VARIANT_STYLES[variant] ?? VARIANT_STYLES.badge;

  const effectivePrefix = customPrefix ?? (showPrefix ? "Period: " : "");
  const formattedLabel = useMemo(
    () =>
      formatPeriodLabel(target, {
        fallback,
        format,
        prefix: effectivePrefix,
      }),
    [target, fallback, format, effectivePrefix]
  );

  const isCard = variant === "card";
  const isInline = variant === "inline";

  if (isCard) {
    return (
      <div
        data-testid="period-card"
        aria-label={`Pay Period: ${formattedLabel}`}
        className={`border p-3 sm:p-4 ${variantConfig.valid} ${className}`}
      >
        <div className="flex items-center gap-1.5 text-gray-500 mb-1">
          {showIcon && <Calendar className="w-3.5 h-3.5 text-gray-500 shrink-0" aria-hidden="true" />}
          <span className="text-xs font-medium uppercase tracking-wider">Pay Period</span>
        </div>
        <p className={`text-sm font-medium ${parsed.isValid ? "text-gray-900" : "text-gray-500"}`}>
          {formattedLabel}
        </p>
      </div>
    );
  }

  if (isInline) {
    return (
      <span
        data-testid="period-inline"
        aria-label={`Pay period: ${formattedLabel}`}
        className={`inline-flex items-center gap-1.5 ${sizeConfig.text} ${
          parsed.isValid ? variantConfig.valid : variantConfig.invalid
        } ${className}`}
      >
        {showIcon && <Calendar className={`${sizeConfig.icon} text-gray-400 shrink-0`} aria-hidden="true" />}
        <span>{formattedLabel}</span>
      </span>
    );
  }

  return (
    <span
      data-testid="period-label-badge"
      role="status"
      aria-label={`Pay period: ${formattedLabel}`}
      className={`inline-flex items-center gap-1.5 border transition-colors ${sizeConfig.badge} ${
        parsed.isValid ? variantConfig.valid : variantConfig.invalid
      } ${className}`}
    >
      {showIcon && (
        <Calendar
          className={`${sizeConfig.icon} ${
            parsed.isValid ? "text-indigo-600 shrink-0" : "text-gray-400 shrink-0"
          }`}
          aria-hidden="true"
        />
      )}
      <span className="truncate">{formattedLabel}</span>
    </span>
  );
}

export default PeriodLabelBadge;
