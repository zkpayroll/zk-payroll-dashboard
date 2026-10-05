"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  RotateCcw,
  Trash2,
  X,
  Users,
  DollarSign,
  ClipboardList,
  Shield,
  Info,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { usePayrollWizardStore } from "@/stores/payrollWizard";
import { MOCK_EMPLOYEES } from "@/lib/api/mockData";
import { Button } from "@/components/ui/button";

const STEP_LABEL: Record<string, string> = {
  review: "Employee Review",
  proof: "ZK Proof Generation",
  confirm: "Confirmation",
  submit: "Submission",
};

interface DraftRecoveryPanelProps {
  onRestore?: () => void;
  onDismiss?: () => void;
  onDiscard?: () => void;
  showOnMount?: boolean;
  className?: string;
}

type RecoveryState = "idle" | "restoring" | "restored" | "discarded";

export default function DraftRecoveryPanel({
  onRestore,
  onDismiss,
  onDiscard,
  showOnMount = true,
  className = "",
}: DraftRecoveryPanelProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(showOnMount);
  const [state, setState] = useState<RecoveryState>("idle");

  const {
    employeeIds,
    totalAmount,
    currentStep,
    hasDraft,
    restoreDraft,
    clearDraft,
  } = usePayrollWizardStore();

  const draftExists = hasDraft();

  const recoveredEmployeeNames = useMemo(() => {
    if (employeeIds.length === 0) return [];
    return MOCK_EMPLOYEES
      .filter((e) => employeeIds.includes(e.id))
      .map((e) => e.name);
  }, [employeeIds]);


  const recoveredDataSummary = useMemo(() => {
    const items: { label: string; value: string; icon: typeof Users }[] = [];
    if (employeeIds.length > 0) {
      items.push({
        label: "Employees Selected",
        value: `${employeeIds.length} employee${employeeIds.length !== 1 ? "s" : ""}`,
        icon: Users,
      });
    }
    if (totalAmount > 0) {
      items.push({
        label: "Total Amount",
        value: `$${totalAmount.toLocaleString()}`,
        icon: DollarSign,
      });
    }
    items.push({
      label: "Last Step",
      value: STEP_LABEL[currentStep] ?? currentStep,
      icon: ClipboardList,
    });
    return items;
  }, [employeeIds, totalAmount, currentStep]);

  const handleRestore = () => {
    setState("restoring");
    restoreDraft();
    setTimeout(() => {
      setState("restored");
      onRestore?.();
    }, 400);
  };

  const handleDiscard = () => {
    clearDraft();
    setState("discarded");
    onDiscard?.();
  };

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  const handleNavigateToWizard = () => {
    router.push("/payroll/execute");
  };

  useEffect(() => {
    if (!draftExists && visible) {
      setState("idle");
    }
  }, [draftExists, visible]);

  if (!visible || !draftExists) return null;

  if (state === "restored") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`rounded-lg border border-green-200 bg-green-50 p-4 ${className}`}
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-green-800">Draft Restored</p>
              <button
                type="button"
                onClick={() => setVisible(false)}
                className="text-green-400 hover:text-green-600 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-green-700 mt-0.5">
              Your payroll draft has been restored. You can continue where you left off.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={handleNavigateToWizard}
                className="gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Continue in Wizard
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setVisible(false)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === "discarded") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`rounded-lg border border-gray-200 bg-gray-50 p-4 ${className}`}
      >
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-gray-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Draft Discarded</p>
              <button
                type="button"
                onClick={() => setVisible(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-0.5">
              The interrupted payroll draft has been cleared. No data was lost from completed runs.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`rounded-lg border border-amber-200 bg-amber-50 p-5 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <Save className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-900">
              Interrupted Payroll Draft Found
            </h3>
            <p className="text-sm text-amber-700 mt-0.5">
              A payroll draft was automatically saved before the previous session was interrupted.
              Review the recovered data below and choose whether to restore or discard it.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-amber-400 hover:text-amber-600 transition-colors shrink-0 ml-4"
          aria-label="Dismiss draft recovery panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Recovered Data Summary */}
      <div className="mt-4 bg-white rounded-lg border border-amber-100 p-3">
        <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Shield className="w-3 h-3" />
          Recovered Data
        </h4>
        <div className="space-y-2">
          {recoveredDataSummary.map((item) => {
            const ItemIcon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                <ItemIcon className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-gray-600">{item.label}:</span>
                <span className="font-medium text-gray-900">{item.value}</span>
              </div>
            );
          })}
        </div>
        {recoveredEmployeeNames.length > 0 && (
          <div className="mt-2 pt-2 border-t border-amber-100">
            <p className="text-xs text-gray-500">
              Employees: {recoveredEmployeeNames.join(", ")}
            </p>
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="mt-3 flex items-start gap-2 text-xs text-amber-600">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <p>
          Sensitive fields (ZK proof artifacts, transaction hashes, proof errors) are never
          persisted in drafts for security. You may need to re-generate proofs after restoring.
        </p>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-3">
        <Button
          size="sm"
          onClick={handleRestore}
          disabled={state === "restoring"}
          className="gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {state === "restoring" ? "Restoring..." : "Restore Draft"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDiscard}
          className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Discard Draft
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
        >
          Remind Later
        </Button>
      </div>
    </div>
  );
}