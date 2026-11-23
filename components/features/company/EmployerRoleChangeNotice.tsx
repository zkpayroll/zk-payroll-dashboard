"use client";

import { useMemo } from "react";
import { AlertTriangle, ArrowRightLeft, Info, ShieldCheck } from "lucide-react";
import {
  describeEmployerRoleChange,
  type EmployerRoleChangeImpact,
} from "@/lib/company/employerRoleChange";

export interface EmployerRoleChangeNoticeProps {
  previousRole: unknown;
  nextRole: unknown;
  /** Path the user is on when the change is detected. */
  currentPath?: string;
  /** Called with the fallback path when the current page is no longer accessible. */
  onNavigate?: (href: string) => void;
  /** Called when the user chooses to refresh their session to apply the new role. */
  onRefreshSession?: () => void;
  className?: string;
}

function AccessList({
  title,
  items,
  tone,
  testId,
}: {
  title: string;
  items: string[];
  tone: "gained" | "lost";
  testId: string;
}) {
  if (items.length === 0) return null;
  return (
    <div data-testid={testId}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h4>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li
            key={item}
            className={`rounded-full border px-2 py-0.5 text-xs ${
              tone === "gained"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function toneFor(impact: EmployerRoleChangeImpact) {
  if (impact.kind === "demotion" || !impact.currentPathAllowed) {
    return {
      container: "border-amber-300 bg-amber-50",
      Icon: AlertTriangle,
      iconClass: "text-amber-600",
      role: "alert" as const,
    };
  }
  if (impact.kind === "promotion") {
    return {
      container: "border-emerald-300 bg-emerald-50",
      Icon: ShieldCheck,
      iconClass: "text-emerald-600",
      role: "status" as const,
    };
  }
  return {
    container: "border-indigo-200 bg-indigo-50",
    Icon: ArrowRightLeft,
    iconClass: "text-indigo-600",
    role: "status" as const,
  };
}

/**
 * Explains an employer role change (issue #896): what changed, which areas
 * and actions were gained or lost, and what to do next. Renders nothing when
 * the role is unchanged. Shows only role and navigation labels — never
 * wallet addresses or payroll data.
 */
export default function EmployerRoleChangeNotice({
  previousRole,
  nextRole,
  currentPath,
  onNavigate,
  onRefreshSession,
  className = "",
}: EmployerRoleChangeNoticeProps) {
  const result = useMemo(
    () => describeEmployerRoleChange(previousRole, nextRole, currentPath),
    [previousRole, nextRole, currentPath],
  );

  if (!result.ok) {
    return (
      <div
        role="alert"
        data-testid="employer-role-change-error"
        className={`flex gap-3 rounded-lg border border-red-300 bg-red-50 p-4 ${className}`}
      >
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-red-900">Role change could not be applied</p>
          <p className="mt-1 text-sm text-red-800">{result.message}</p>
        </div>
      </div>
    );
  }

  const { impact } = result;
  if (impact.kind === "unchanged") return null;

  const tone = toneFor(impact);
  const Icon = tone.Icon;

  return (
    <section
      role={tone.role}
      aria-labelledby="employer-role-change-heading"
      data-testid="employer-role-change-notice"
      data-role-change-kind={impact.kind}
      className={`space-y-3 rounded-lg border p-4 ${tone.container} ${className}`}
    >
      <div className="flex gap-3">
        <Icon className={`h-5 w-5 shrink-0 ${tone.iconClass}`} aria-hidden="true" />
        <div>
          <h3 id="employer-role-change-heading" className="text-sm font-semibold text-gray-900">
            {impact.headline}
          </h3>
          <p className="mt-1 text-sm text-gray-700">{impact.message}</p>
        </div>
      </div>

      <AccessList
        title="Now available"
        items={[...impact.gainedNavigation, ...impact.gainedCapabilities]}
        tone="gained"
        testId="employer-role-change-gained"
      />
      <AccessList
        title="No longer available"
        items={[...impact.lostNavigation, ...impact.lostCapabilities]}
        tone="lost"
        testId="employer-role-change-lost"
      />

      <div className="flex flex-wrap gap-2 pt-1">
        {impact.redirectTo && (
          <button
            type="button"
            onClick={() => onNavigate?.(impact.redirectTo as string)}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Go to dashboard
          </button>
        )}
        {impact.requiresSessionRefresh && (
          <button
            type="button"
            onClick={() => onRefreshSession?.()}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh session
          </button>
        )}
      </div>
    </section>
  );
}
