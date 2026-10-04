"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Lock,
  FileCheck,
  Receipt,
  Scale,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import type { PeriodCloseChecklist, PeriodCloseChecklistItem } from "@/types/models";

export interface PayrollPeriodCloseChecklistProps {
  checklist: PeriodCloseChecklist;
  onClosePeriod?: (payrollRunId: string) => void;
  isClosed?: boolean;
}

const CATEGORY_ICONS: Record<string, typeof CheckCircle2> = {
  settlement: Scale,
  reconciliation: FileCheck,
  receipt_review: Receipt,
  audit_handoff: Lock,
  holds: ShieldAlert,
  disputes: AlertCircle,
  funding_reservations: Scale,
  audit_references: Lock,
};

export function PayrollPeriodCloseChecklist({
  checklist,
  onClosePeriod,
  isClosed = false,
}: PayrollPeriodCloseChecklistProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const completedCount = checklist.items.filter((item) => item.isSatisfied).length;
  const totalCount = checklist.items.length;
  const percentComplete = Math.round((completedCount / totalCount) * 100);

  const handleConfirmClose = () => {
    setShowConfirm(false);
    onClosePeriod?.(checklist.payrollRunId);
  };

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6"
      data-testid="payroll-period-close-checklist"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-gray-900">
            Payroll Period Close Checklist — {checklist.payrollRunId}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Verify settlement, reconciliation, receipt review, and audit handoff before period close.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isClosed ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              Closed
            </span>
          ) : checklist.canClose ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              Ready to Close
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
              Blocked ({totalCount - completedCount} pending)
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-medium text-gray-700">
          <span>Completion Progress</span>
          <span>{completedCount} of {totalCount} requirements satisfied ({percentComplete}%)</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              checklist.canClose ? "bg-green-600" : "bg-amber-500"
            }`}
            style={{ width: `${percentComplete}%` }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Checklist Grid */}
      <div className="space-y-3">
        {checklist.items.map((item: PeriodCloseChecklistItem) => {
          const IconComponent = CATEGORY_ICONS[item.category] || CheckCircle2;
          return (
            <div
              key={item.category}
              className={`p-3.5 rounded-lg border transition-colors ${
                item.isSatisfied
                  ? "bg-green-50/50 border-green-200"
                  : "bg-amber-50/50 border-amber-200"
              }`}
              data-testid={`checklist-category-${item.category}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {item.isSatisfied ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600" aria-hidden="true" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <IconComponent className="w-4 h-4 text-gray-500" aria-hidden="true" />
                    <span className="text-xs font-semibold text-gray-900">{item.label}</span>
                  </div>

                  {!item.isSatisfied && item.blockers.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {item.blockers.map((blocker, bIdx) => (
                        <p key={bIdx} className="text-xs text-amber-800 font-medium">
                          • {blocker.description}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog / Action Area */}
      {!isClosed && (
        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            disabled={!checklist.canClose}
            onClick={() => setShowConfirm(true)}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-colors ${
              checklist.canClose
                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
            data-testid="close-period-action-button"
          >
            {checklist.canClose ? "Close Payroll Period" : "Resolve Blockers to Close"}
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          className="rounded-lg border-2 border-indigo-200 bg-indigo-50/80 p-5 space-y-3"
          role="alertdialog"
          aria-labelledby="close-dialog-title"
          data-testid="period-close-confirmation-dialog"
        >
          <h4 id="close-dialog-title" className="text-sm font-bold text-indigo-950">
            Confirm Period Finalization
          </h4>
          <p className="text-xs text-indigo-800">
            Closing period <strong>{checklist.payrollRunId}</strong> will finalize settlement receipts and lock audit references. This action preserves privacy while freezing period records.
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="px-3 py-1.5 rounded text-xs font-medium bg-white text-gray-700 border hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClose}
              className="px-3 py-1.5 rounded text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Confirm & Close Period
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PayrollPeriodCloseChecklist;
