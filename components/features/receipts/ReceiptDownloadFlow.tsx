"use client";

import { useState, useMemo } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileText,
  Info,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  useReceiptDownloadStore,
  canAccessExportMode,
  getReceiptForMode,
  MOCK_RECEIPTS,
} from "@/stores/receipts";
import {
  EXPORT_MODE_OPTIONS,
  DISCLOSURE_WARNINGS,
  type ExportMode,
} from "@/types/receipts";
import type { AuditSafeReceipt, UserRole } from "@/types/models";
import { ROLE_LABELS } from "@/lib/auth/roles";

interface ReceiptDownloadFlowProps {
  receipt?: AuditSafeReceipt;
  userRole: UserRole;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ReceiptDownloadFlow({
  receipt,
  userRole,
}: ReceiptDownloadFlowProps) {
  const {
    exportMode,
    disclosureStatus,
    currentStep,
    isDownloading,
    downloadError,
    setExportMode,
    acknowledgeDisclosure,
    setStep,
    startDownload,
    completeDownload,
    failDownload,
    reset,
  } = useReceiptDownloadStore();

  const [showReceiptId, setShowReceiptId] = useState(false);

  const activeReceipt = receipt ?? MOCK_RECEIPTS[0];

  const modeOption = useMemo(
    () => EXPORT_MODE_OPTIONS.find((o) => o.mode === exportMode)!,
    [exportMode],
  );

  const accessibleModes = useMemo(
    () =>
      EXPORT_MODE_OPTIONS.filter((o) =>
        canAccessExportMode(userRole, o.mode),
      ),
    [userRole],
  );

  const canProceed = canAccessExportMode(userRole, exportMode);

  const handleModeSelect = (mode: ExportMode) => {
    if (!canAccessExportMode(userRole, mode)) {
      toast.error(`Access denied: ${ROLE_LABELS[userRole]} role cannot use ${EXPORT_MODE_OPTIONS.find((o) => o.mode === mode)?.label}.`);
      return;
    }
    setExportMode(mode);
  };

  const handleProceedFromMode = () => {
    if (!canProceed) {
      toast.error("You do not have permission to use this export mode.");
      return;
    }
    if (exportMode === "redacted") {
      setStep("confirm");
    } else {
      setStep("disclosure");
    }
  };

  const handleConfirmDownload = async () => {
    startDownload();
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const exportedData = getReceiptForMode(activeReceipt, exportMode);
      const filename = `receipt-${activeReceipt.receiptId}-${exportMode}.json`;
      downloadJson(filename, exportedData);
      completeDownload();
      toast.success("Receipt downloaded successfully.");
    } catch {
      failDownload("Download failed. Please try again.");
      toast.error("Download failed. Please try again.");
    }
  };

  const maskedId = showReceiptId
    ? activeReceipt.receiptId
    : activeReceipt.receiptId.slice(0, 6) + "****";

  return (
    <section
      aria-labelledby="receipt-download-heading"
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      data-testid="receipt-download-flow"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-indigo-50">
          <FileText className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2
            id="receipt-download-heading"
            className="text-base font-semibold text-gray-900"
          >
            Receipt Download
          </h2>
          <p className="text-sm text-gray-500">
            Export payroll receipt data with privacy controls.
          </p>
        </div>
      </div>

      {/* ── Receipt Info ────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="font-medium text-gray-700">Receipt:</span>
          <span className="font-mono text-xs">{maskedId}</span>
          <button
            type="button"
            onClick={() => setShowReceiptId(!showReceiptId)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title={showReceiptId ? "Hide receipt ID" : "Reveal receipt ID"}
            aria-label={showReceiptId ? "Hide receipt ID" : "Reveal receipt ID"}
          >
            {showReceiptId ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            activeReceipt.status === "verified"
              ? "bg-green-50 text-green-700"
              : activeReceipt.status === "pending"
                ? "bg-amber-50 text-amber-700"
                : "bg-red-50 text-red-700"
          }`}
        >
          {activeReceipt.status === "verified" && (
            <CheckCircle2 className="w-3 h-3" />
          )}
          {activeReceipt.status}
        </span>
      </div>

      {/* ── Step Indicator ──────────────────────────────────────── */}
      <nav
        aria-label="Download progress"
        className="flex items-center gap-2 mb-6 text-xs"
        data-testid="step-indicator"
      >
        {[
          { key: "select-mode", label: "Mode" },
          { key: "disclosure", label: "Disclosure" },
          { key: "confirm", label: "Confirm" },
          { key: "complete", label: "Done" },
        ].map((step, i, arr) => {
          const stepOrder = ["select-mode", "disclosure", "confirm", "complete"];
          const currentIdx = stepOrder.indexOf(currentStep);
          const stepIdx = stepOrder.indexOf(step.key);
          const isActive = step.key === currentStep;
          const isCompleted = stepIdx < currentIdx;
          return (
            <div key={step.key} className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 font-medium ${
                  isActive
                    ? "text-indigo-600"
                    : isCompleted
                      ? "text-green-600"
                      : "text-gray-400"
                }`}
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : isCompleted
                        ? "bg-green-600 text-white"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isCompleted ? <Check className="w-3 h-3" /> : i + 1}
                </span>
                {step.label}
              </span>
              {i < arr.length - 1 && (
                <span
                  className={`w-6 h-px ${
                    stepIdx < currentIdx ? "bg-green-300" : "bg-gray-200"
                  }`}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Step: Select Mode ───────────────────────────────────── */}
      {currentStep === "select-mode" && (
        <div data-testid="step-select-mode">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Select export mode
          </h3>
          <div className="space-y-3" role="radiogroup" aria-label="Export mode">
            {EXPORT_MODE_OPTIONS.map((option) => {
              const isAllowed = canAccessExportMode(userRole, option.mode);
              const isSelected = exportMode === option.mode;
              return (
                <button
                  key={option.mode}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={!isAllowed}
                  onClick={() => handleModeSelect(option.mode)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200"
                      : isAllowed
                        ? "border-gray-200 bg-white hover:border-gray-300"
                        : "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                  }`}
                  data-testid={`mode-${option.mode}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {option.label}
                      </span>
                      {!isAllowed && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-600">
                          <Lock className="w-2.5 h-2.5" />
                          Restricted
                        </span>
                      )}
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700">
                          Default
                        </span>
                      )}
                    </div>
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>

          {!canProceed && (
            <div
              className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg"
              role="alert"
              data-testid="access-denied"
            >
              <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                Your role ({ROLE_LABELS[userRole]}) does not have permission to
                use the selected export mode. Choose a different mode or contact
                an administrator.
              </p>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleProceedFromMode}
              disabled={!canProceed}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="proceed-from-mode"
            >
              Continue
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Disclosure Warning ────────────────────────────── */}
      {currentStep === "disclosure" && (
        <div data-testid="step-disclosure">
          <div
            className="p-4 rounded-lg border border-amber-200 bg-amber-50"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-amber-800">
                  Disclosure Warning
                </h3>
                <p className="text-sm text-amber-700 mt-1">
                  {DISCLOSURE_WARNINGS[exportMode]}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-600">
                By proceeding you acknowledge that this export contains sensitive
                data and you accept responsibility for handling it in compliance
                with your organization&apos;s data policies.
              </p>
            </div>
          </div>

          <div className="mt-5 flex justify-between">
            <button
              type="button"
              onClick={() => setStep("select-mode")}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              data-testid="back-to-mode"
            >
              Back
            </button>
            <button
              type="button"
              onClick={acknowledgeDisclosure}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
              data-testid="acknowledge-disclosure"
            >
              I acknowledge
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Confirm Download ──────────────────────────────── */}
      {currentStep === "confirm" && (
        <div data-testid="step-confirm">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Confirm download
          </h3>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Receipt ID</span>
              <span className="font-mono text-gray-900 text-xs">
                {activeReceipt.receiptId}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Export Mode</span>
              <span className="text-gray-900">{modeOption.label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Role</span>
              <span className="text-gray-900">{ROLE_LABELS[userRole]}</span>
            </div>
            {exportMode !== "redacted" && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Disclosure</span>
                <span className="text-amber-700 text-xs font-medium">
                  Acknowledged
                </span>
              </div>
            )}
          </div>

          {exportMode !== "redacted" && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">
                {DISCLOSURE_WARNINGS[exportMode]}
              </p>
            </div>
          )}

          <div className="mt-5 flex justify-between">
            <button
              type="button"
              onClick={() =>
                setStep(exportMode === "redacted" ? "select-mode" : "disclosure")
              }
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              data-testid="back-from-confirm"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirmDownload}
              disabled={isDownloading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              data-testid="download-receipt"
            >
              {isDownloading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Receipt
                </>
              )}
            </button>
          </div>

          {downloadError && (
            <div
              className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg"
              role="alert"
              data-testid="download-error"
            >
              <ShieldAlert className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">{downloadError}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Step: Complete ──────────────────────────────────────── */}
      {currentStep === "complete" && (
        <div data-testid="step-complete" className="text-center py-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            Download complete
          </h3>
          <p className="text-xs text-gray-500 mb-5">
            The receipt has been exported as a {modeOption.label.toLowerCase()} file.
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            data-testid="start-new-download"
          >
            Start new download
          </button>
        </div>
      )}
    </section>
  );
}
