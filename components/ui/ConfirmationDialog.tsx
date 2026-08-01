"use client";

import { useState, ReactNode } from "react";
import { AlertCircle, AlertTriangle, Shield, Loader2, X } from "lucide-react";

interface ConfirmationDialogProps {
  title: string;
  description: string;
  warning?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  icon?: "alert" | "shield" | "warning";
  isOpen: boolean;
  onConfirm: (reason?: string) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  children?: ReactNode;
  showReasonField?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
}

export function ConfirmationDialog({
  title,
  description,
  warning,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning",
  icon = "alert",
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
  children,
  showReasonField = false,
  reasonLabel = "Reason",
  reasonPlaceholder = "Enter reason for confirmation...",
}: ConfirmationDialogProps) {
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(reason || undefined);
    } finally {
      setIsSubmitting(false);
      if (!reason) setReason("");
    }
  };

  const variantStyles = {
    danger: {
      border: "border-red-200",
      background: "bg-red-50",
      icon: "text-red-600",
      title: "text-red-800",
      description: "text-red-700",
      button: "bg-red-600 hover:bg-red-700 text-white",
    },
    warning: {
      border: "border-amber-200",
      background: "bg-amber-50",
      icon: "text-amber-600",
      title: "text-amber-800",
      description: "text-amber-700",
      button: "bg-amber-600 hover:bg-amber-700 text-white",
    },
    info: {
      border: "border-blue-200",
      background: "bg-blue-50",
      icon: "text-blue-600",
      title: "text-blue-800",
      description: "text-blue-700",
      button: "bg-blue-600 hover:bg-blue-700 text-white",
    },
  };

  const iconMap = {
    alert: AlertTriangle,
    shield: Shield,
    warning: AlertCircle,
  };

  const Icon = iconMap[icon];
  const styles = variantStyles[variant];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className={`${styles.background} ${styles.border} rounded-t-lg p-6`}
          role="alert"
          aria-labelledby="confirmation-dialog-title"
          aria-describedby="confirmation-dialog-description"
        >
          <div className="flex items-start gap-3">
            <div className={`${styles.icon} p-2 rounded-lg flex-shrink-0`}>
              <Icon className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <h2 id="confirmation-dialog-title" className={`font-semibold text-lg ${styles.title}`}>{title}</h2>
              <p id="confirmation-dialog-description" className={`text-sm mt-1 ${styles.description}`}>{description}</p>
            </div>
            <button
              onClick={onCancel}
              disabled={isSubmitting || isLoading}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {warning && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-700">{warning}</p>
              </div>
            </div>
          )}

          {showReasonField && (
            <div>
              <label htmlFor="confirmation-reason" className="block text-sm font-medium text-gray-700 mb-2">
                {reasonLabel} <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="confirmation-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonPlaceholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={3}
                disabled={isSubmitting || isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                This reason will be recorded in the audit trail for compliance.
              </p>
            </div>
          )}

          {children}
        </div>

        <div className="flex gap-3 p-6 pt-0 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onCancel}
            disabled={isSubmitting || isLoading}
            className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || isLoading}
            className={`flex-1 px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2 ${styles.button}`}
          >
            {isSubmitting || isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationDialog;
