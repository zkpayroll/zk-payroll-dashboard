"use client";

import { AlertTriangle, HelpCircle, X } from "lucide-react";
import { useContractErrorDrawer } from "@/stores/contractErrorDrawer";
import { Button } from "@/components/ui/button";

/**
 * Drawer that explains a payroll/treasury contract error in plain language
 * and offers safe remediation steps. Never renders raw transaction payloads
 * or contract call arguments — only the resolved help content.
 */
export function ContractErrorDrawer() {
  const { isOpen, help, close } = useContractErrorDrawer();

  if (!isOpen || !help) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={close}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-error-drawer-title"
        className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-lg z-50 overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" />
            <h2 id="contract-error-drawer-title" className="text-lg font-semibold text-gray-900">
              {help.title}
            </h2>
          </div>
          <button
            onClick={close}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close error help drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-mono text-red-700 border border-red-200">
              {help.code}
            </span>
            <p className="text-sm text-gray-600 mt-3">{help.summary}</p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">What you can do</h3>
            <ul className="space-y-2">
              {help.remediation.map((step, idx) => (
                <li key={idx} className="text-sm text-gray-600 flex gap-2">
                  <span className="text-indigo-600 flex-shrink-0">{idx + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">
            No sensitive payroll data or wallet payloads are shown in this drawer.
          </p>
        </div>
      </div>
    </>
  );
}

export function ContractErrorHelpButton({
  error,
  label = "View error help",
}: {
  error: unknown;
  label?: string;
}) {
  const { openForError } = useContractErrorDrawer();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => openForError(error)}
      className="gap-1.5"
    >
      <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
      {label}
    </Button>
  );
}

export default ContractErrorDrawer;
