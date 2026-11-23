import { AlertOctagon, Lock, Gavel, Undo2, CheckCircle2 } from "lucide-react";
import {
  RECONCILIATION_BLOCKER_CATEGORIES,
  type ReconciliationBlockersByCategory,
  type ReconciliationBlockerCategory,
} from "@/lib/sdk/reconciliation";

const CATEGORY_META: Record<
  ReconciliationBlockerCategory,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  mismatches: { label: "Mismatches", icon: AlertOctagon },
  holds: { label: "Unresolved holds", icon: Lock },
  disputes: { label: "Disputes", icon: Gavel },
  refund_blockers: { label: "Refund blockers", icon: Undo2 },
};

/**
 * Blocking issues grouped by actionable category. Always renders all four
 * categories (even when empty) so maintainers can see at a glance which
 * areas are clear versus which need action.
 */
export function ReconciliationBlockerPanel({
  blockersByCategory,
}: {
  blockersByCategory: ReconciliationBlockersByCategory;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="reconciliation-blocker-panel">
      {RECONCILIATION_BLOCKER_CATEGORIES.map((category) => {
        const meta = CATEGORY_META[category];
        const Icon = meta.icon;
        const blockers = blockersByCategory[category];
        const isClear = blockers.length === 0;

        return (
          <div
            key={category}
            className={`rounded-lg border p-3 ${isClear ? "border-gray-200 bg-gray-50" : "border-red-200 bg-red-50"}`}
            data-testid={`blocker-category-${category}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Icon className={`w-4 h-4 shrink-0 ${isClear ? "text-gray-400" : "text-red-600"}`} aria-hidden="true" />
                <span className="text-xs font-semibold text-gray-900">{meta.label}</span>
              </div>
              {isClear ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Clear
                </span>
              ) : (
                <span className="text-xs font-semibold text-red-700">{blockers.length}</span>
              )}
            </div>
            {!isClear && (
              <ul className="mt-2 space-y-1">
                {blockers.map((blocker, i) => (
                  <li key={i} className="text-xs text-red-700 pl-4 relative before:content-['•'] before:absolute before:left-0">
                    <span className="font-medium">{blocker.payrollRunId}: </span>
                    {blocker.description}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ReconciliationBlockerPanel;
