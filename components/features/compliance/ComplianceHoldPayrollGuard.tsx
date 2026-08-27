"use client";

import { useMemo } from "react";
import { ShieldAlert } from "lucide-react";
import {
  useComplianceHoldsStore,
  formatReasonLabel,
  formatScopeLabel,
  type ComplianceHold,
} from "@/stores/complianceHolds";

// ─── Blocked action explanation ─────────────────────────────────────────────

function BlockedActionExplanation({ holds }: { holds: ComplianceHold[] }) {
  if (holds.length === 0) return null;

  return (
    <div
      data-testid="compliance-hold-blocked-explanation"
      className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-600" />
        <p className="text-sm font-medium text-amber-800">
          Action blocked by compliance hold{holds.length > 1 ? "s" : ""}
        </p>
      </div>
      <ul className="space-y-1">
        {holds.map((hold) => (
          <li key={hold.id} className="text-xs text-amber-700 pl-5">
            {formatReasonLabel(hold.reasonCode)} — {formatScopeLabel(hold.scope)} scope
            {hold.targetLabel ? ` (${hold.targetLabel})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── ComplianceHoldPayrollGuard ─────────────────────────────────────────────

export interface ComplianceHoldPayrollGuardProps {
  /** The payroll action key to check (e.g. "run_payroll", "approve_transactions") */
  action: string;
  /** Content to render when the action is not blocked */
  children: React.ReactNode;
  /** Whether to render the children in a disabled state when blocked (default: true) */
  disabledStyle?: boolean;
  /** Custom fallback when the action is blocked */
  blockedFallback?: React.ReactNode;
}

/**
 * Wrapper component that disables and explains when a payroll action
 * is blocked by one or more active compliance holds.
 */
export function ComplianceHoldPayrollGuard({
  action,
  children,
  disabledStyle = true,
  blockedFallback,
}: ComplianceHoldPayrollGuardProps) {
  const holds = useComplianceHoldsStore((s) => s.holds);

  const { isBlocked, blockingHolds } = useMemo(() => {
    const activeHolds = holds.filter((h) => h.status === "active");
    const blocking = activeHolds.filter((h) => h.blockedActions.includes(action));
    return {
      isBlocked: blocking.length > 0,
      blockingHolds: blocking,
    };
  }, [holds, action]);

  if (!isBlocked) {
    return <>{children}</>;
  }

  if (blockedFallback) {
    return (
      <>
        {blockedFallback}
        <BlockedActionExplanation holds={blockingHolds} />
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div
        data-testid={`payroll-action-blocked-${action}`}
        className={
          disabledStyle
            ? "pointer-events-none opacity-50 grayscale"
            : ""
        }
      >
        {children}
      </div>
      <BlockedActionExplanation holds={blockingHolds} />
    </div>
  );
}

// ─── usePayrollActionBlocked hook ───────────────────────────────────────────

/**
 * Hook to check if a payroll action is blocked and get the blocking holds.
 */
export function usePayrollActionBlocked(action: string) {
  const holds = useComplianceHoldsStore((s) => s.holds);

  return useMemo(() => {
    const activeHolds = holds.filter((h) => h.status === "active");
    const blocking = activeHolds.filter((h) => h.blockedActions.includes(action));
    return {
      isBlocked: blocking.length > 0,
      blockingHolds: blocking,
      message: blocking.length > 0
        ? `This action is blocked by ${blocking.length} compliance hold${blocking.length > 1 ? "s" : ""}.`
        : null,
    };
  }, [holds, action]);
}

// ─── Common payroll action keys ─────────────────────────────────────────────

export const PAYROLL_ACTION_KEYS = {
  RUN_PAYROLL: "run_payroll",
  SEND_PAYMENTS: "send_payments",
  APPROVE_TRANSACTIONS: "approve_transactions",
  MODIFY_TREASURY: "modify_treasury",
  EDIT_EMPLOYEES: "edit_employees",
  FINALIZE_BATCH: "finalize_batch",
  IMPORT_EMPLOYEES: "import_employees",
} as const;
