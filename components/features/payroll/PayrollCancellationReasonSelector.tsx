"use client";

import React, { useState } from "react";
import { AlertCircle, HelpCircle, ShieldAlert, CheckCircle2, FileText } from "lucide-react";
import {
  SUPPORTED_CANCELLATION_REASONS,
  getCancellationReason,
  CancellationReasonCode,
} from "@/lib/constants/cancellationReasons";
import { CancellationReasonSelect } from "@/components/payroll/CancellationReasonSelect";

export interface CancellationReasonSelectionPayload {
  reasonCode: CancellationReasonCode | string;
  reasonLabel: string;
  category: string;
  notes?: string;
}

export interface PayrollCancellationReasonSelectorProps {
  selectedReasonCode?: string;
  notes?: string;
  onSelectReason?: (payload: CancellationReasonSelectionPayload) => void;
  onConfirmCancellation?: (payload: CancellationReasonSelectionPayload) => void;
  disabled?: boolean;
  isLoading?: boolean;
  required?: boolean;
  className?: string;
}

export function PayrollCancellationReasonSelector({
  selectedReasonCode = "",
  notes = "",
  onSelectReason,
  onConfirmCancellation,
  disabled = false,
  isLoading = false,
  required = true,
  className = "",
}: PayrollCancellationReasonSelectorProps) {
  const [reasonCode, setReasonCode] = useState<string>(selectedReasonCode);
  const [customNotes, setCustomNotes] = useState<string>(notes);
  const [validationError, setValidationError] = useState<string | null>(null);

  const activeReasonObj = getCancellationReason(reasonCode);
  const isValid = Boolean(reasonCode && activeReasonObj);

  const handleReasonChange = (newCode: string) => {
    setReasonCode(newCode);
    setValidationError(null);
    const reasonObj = getCancellationReason(newCode);
    if (reasonObj && onSelectReason) {
      onSelectReason({
        reasonCode: newCode,
        reasonLabel: reasonObj.label,
        category: reasonObj.category,
        notes: customNotes,
      });
    }
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCustomNotes(val);
    const reasonObj = getCancellationReason(reasonCode);
    if (reasonObj && onSelectReason) {
      onSelectReason({
        reasonCode: reasonCode,
        reasonLabel: reasonObj.label,
        category: reasonObj.category,
        notes: val,
      });
    }
  };

  const handleConfirm = () => {
    if (!isValid) {
      setValidationError("You must select a documented cancellation reason before proceeding.");
      return;
    }

    if (onConfirmCancellation && activeReasonObj) {
      onConfirmCancellation({
        reasonCode,
        reasonLabel: activeReasonObj.label,
        category: activeReasonObj.category,
        notes: customNotes.trim() || undefined,
      });
    }
  };

  return (
    <div
      data-testid="payroll-cancellation-reason-selector"
      className={`p-4 sm:p-5 bg-white border border-red-200 rounded-xl shadow-xs space-y-4 ${className}`}
    >
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
        <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
        <div>
          <h3 className="text-sm font-bold text-gray-900">
            Payroll Cancellation Reason Selector
          </h3>
          <p className="text-xs text-gray-500">
            Operators must select an authorized cancellation category for cryptographic audit logging.
          </p>
        </div>
      </div>

      {/* Cancellation Reason Dropdown */}
      <CancellationReasonSelect
        value={reasonCode}
        onChange={handleReasonChange}
        disabled={disabled || isLoading}
        isLoading={isLoading}
        required={required}
        error={validationError}
        label="Documented Cancellation Reason"
      />

      {/* Additional Audit Notes */}
      <div className="space-y-1.5">
        <label htmlFor="selector-notes" className="block text-xs font-semibold text-gray-700">
          Additional Audit Rationale <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="selector-notes"
          value={customNotes}
          onChange={handleNotesChange}
          disabled={disabled || isLoading}
          data-testid="cancellation-notes-input"
          placeholder="Provide explicit operational context, ticket references, or audit details..."
          rows={2}
          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400 resize-none"
        />
      </div>

      {/* Confirm Button Footer */}
      <div className="pt-2 flex items-center justify-between gap-3 border-t border-gray-100">
        <div className="text-[11px] text-gray-500 flex items-center gap-1">
          <FileText className="w-3.5 h-3.5 text-gray-400" />
          <span>Signed with operator wallet key upon confirmation</span>
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!isValid || disabled || isLoading}
          data-testid="confirm-cancellation-btn"
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Confirm Cancellation Reason
        </button>
      </div>
    </div>
  );
}

export default PayrollCancellationReasonSelector;
