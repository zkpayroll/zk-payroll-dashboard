"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  detail?: string;
}

export interface PayrollArchivalEligibilityChecklistProps {
  payrollId: string;
  items: ChecklistItem[];
  archivalEligible: boolean;
}

export function PayrollArchivalEligibilityChecklist({
  payrollId,
  items,
  archivalEligible,
}: PayrollArchivalEligibilityChecklistProps) {
  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;
  const percentComplete = Math.round((completedCount / totalCount) * 100);

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-4"
      data-testid="payroll-archival-eligibility-checklist"
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Archival Eligibility - {payrollId}
        </h3>
        <p className="text-xs text-gray-600 mt-1">
          {completedCount} of {totalCount} criteria met ({percentComplete}%)
        </p>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div
          className={`h-2 rounded-full transition-all ${
            archivalEligible ? "bg-green-500" : "bg-amber-500"
          }`}
          style={{ width: `${percentComplete}%` }}
          aria-hidden="true"
        />
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-2 p-2 rounded hover:bg-gray-50"
            data-testid={`checklist-item-${item.id}`}
          >
            {item.completed ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div className="flex-1">
              <p
                className={`text-xs font-medium ${
                  item.completed ? "text-gray-900" : "text-gray-600"
                }`}
              >
                {item.label}
              </p>
              {item.detail && (
                <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {archivalEligible && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-green-700">
            This payroll meets all archival eligibility requirements and can be
            archived.
          </p>
        </div>
      )}

      {!archivalEligible && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-amber-700">
            Complete all criteria above to make this payroll eligible for
            archival.
          </p>
        </div>
      )}
    </div>
  );
}

export default PayrollArchivalEligibilityChecklist;
