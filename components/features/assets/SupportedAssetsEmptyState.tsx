"use client";

import EmptyState from "@/components/ui/EmptyState";
import { Coins } from "lucide-react";
import Link from "next/link";
import { SUPPORTED_PAYROLL_ASSETS, formatSupportedAssetsList, hasSupportedPayrollAssets } from "@/lib/assets/supportedAssets";

export interface SupportedAssetsEmptyStateProps {
  /** Configured assets to check — empty means payroll creation is blocked. */
  configuredAssets?: Array<{ code: string; issuer?: string }>;
  /** Variant controls copy: generic, treasury, or settings */
  variant?: "generic" | "treasury" | "settings";
  /** Optional override for the primary CTA */
  actionHref?: string;
  actionLabel?: string;
  className?: string;
  /** Compact inline banner instead of full EmptyState card */
  compact?: boolean;
}

/**
 * Empty state shown when no supported payroll assets are configured.
 * Explains why payroll creation is blocked and where to configure assets.
 * Privacy-safe: mentions only asset codes, never payroll amounts or employee data.
 */
export function SupportedAssetsEmptyState({
  configuredAssets,
  variant = "generic",
  actionHref,
  actionLabel,
  className = "",
  compact = false,
}: SupportedAssetsEmptyStateProps) {
  const hasAssets = hasSupportedPayrollAssets(configuredAssets);
  if (hasAssets) return null;

  const screenMap = {
    generic: "supported-assets-empty" as const,
    treasury: "treasury-assets-empty" as const,
    settings: "settings-assets-empty" as const,
  };

  const hrefMap = {
    generic: "/settings/assets",
    treasury: "/treasury",
    settings: "/settings/assets",
  };

  const labelMap = {
    generic: "Configure assets",
    treasury: "Configure treasury assets",
    settings: "Add supported asset",
  };

  const resolvedHref = actionHref ?? hrefMap[variant];
  const resolvedLabel = actionLabel ?? labelMap[variant];

  if (compact) {
    return (
      <div
        role="status"
        aria-label="No supported payroll assets configured"
        data-testid="supported-assets-empty-compact"
        className={`rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 ${className}`}
      >
        <Coins className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800">No supported payroll assets configured</p>
          <p className="text-sm text-amber-700 mt-0.5">
            Payroll creation is blocked. Configure a supported asset ({formatSupportedAssetsList()}) in Settings → Assets to enable payroll batches.
          </p>
          <p className="text-xs text-amber-600 mt-1">
            Supported assets: {SUPPORTED_PAYROLL_ASSETS.map((a) => a.code).join(" · ")} · No payroll funds have been moved.
          </p>
          <Link
            href={resolvedHref}
            className="mt-2 inline-flex px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition-colors"
          >
            {resolvedLabel}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="supported-assets-empty" className={className}>
      <EmptyState
        screen={screenMap[variant]}
        action={{ label: resolvedLabel, href: resolvedHref }}
        secondaryAction={{ label: "View docs", href: "/docs" }}
      />
      <p className="text-center text-xs text-gray-400 mt-2 max-w-sm mx-auto">
        Supported: {formatSupportedAssetsList()} ·{" "}
        <Link href="/treasury" className="underline hover:text-gray-600">
          Go to Treasury
        </Link>
      </p>
      <div
        role="note"
        aria-label="Payroll blocked — no assets"
        className="mt-4 mx-auto max-w-md rounded-md bg-gray-50 border px-3 py-2 text-xs text-gray-600 text-center"
      >
        Payroll batches cannot be created or executed while no supported assets are configured. No salary values are exposed here.
      </div>
    </div>
  );
}

export default SupportedAssetsEmptyState;
