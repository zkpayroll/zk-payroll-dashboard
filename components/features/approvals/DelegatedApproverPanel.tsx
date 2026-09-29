"use client";

import { useState } from "react";
import {
  UserCheck,
  UserPlus,
  Trash2,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useDelegatedApproversStore,
  type DelegatedApprover,
} from "@/stores/delegatedApprovers";
import { validateDelegatedApproverInput } from "@/lib/validation/delegatedApprover";

export interface DelegatedApproverPanelProps {
  /** Optional custom approvers list; defaults to Zustand store state if omitted. */
  approvers?: DelegatedApprover[];
  /** Optional callback triggered after successfully adding an approver. */
  onAddApprover?: (address: string, label?: string) => void;
  /** Optional callback triggered after removing an approver. */
  onRemoveApprover?: (id: string) => void;
  /** Optional title override. */
  title?: string;
  /** Optional description override. */
  description?: string;
}

export function maskAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length > 16) {
    return `${trimmed.slice(0, 8)}...${trimmed.slice(-6)}`;
  }
  return trimmed;
}

export default function DelegatedApproverPanel({
  approvers: propApprovers,
  onAddApprover,
  onRemoveApprover,
  title = "Delegated Approver Management",
  description = "Manage authorized delegated signers and surrogate approvers for payroll runs.",
}: DelegatedApproverPanelProps) {
  const store = useDelegatedApproversStore();
  const currentApprovers = propApprovers ?? store.approvers;

  const [addressInput, setAddressInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const existingAddresses = currentApprovers.map((a) => a.address);
    const validation = validateDelegatedApproverInput(
      addressInput,
      existingAddresses,
    );

    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    const trimmedAddress = addressInput.trim();
    const trimmedLabel = labelInput.trim() || undefined;

    if (onAddApprover) {
      onAddApprover(trimmedAddress, trimmedLabel);
    } else {
      const res = store.addApprover(trimmedAddress, trimmedLabel);
      if (!res.success && res.error) {
        setError(res.error);
        return;
      }
    }

    setAddressInput("");
    setLabelInput("");
    setError(null);
  };

  const handleRemove = (id: string) => {
    if (onRemoveApprover) {
      onRemoveApprover(id);
    } else {
      store.removeApprover(id);
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore copy failure
    }
  };

  return (
    <div className="bg-white border rounded-xl p-5 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-indigo-600" />
            {title}
          </h2>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg text-xs text-indigo-700 font-medium">
          <ShieldCheck className="h-4 w-4 text-indigo-600" />
          <span>{currentApprovers.length} Delegated Approver(s)</span>
        </div>
      </div>

      {/* Add Approver Form */}
      <form onSubmit={handleAdd} className="space-y-3 bg-gray-50 p-4 rounded-lg border">
        <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <UserPlus className="h-4 w-4 text-indigo-600" />
          Add New Delegated Approver
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-7">
            <label
              htmlFor="delegated-approver-address"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Stellar Address or Delegate Identifier <span className="text-red-500">*</span>
            </label>
            <input
              id="delegated-approver-address"
              type="text"
              value={addressInput}
              onChange={(e) => {
                setAddressInput(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. GAYN325M... or delegate-finance-01"
              className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                error ? "border-red-300 focus:ring-red-500" : "border-gray-300"
              }`}
              aria-invalid={!!error}
              aria-describedby={error ? "delegated-approver-error" : undefined}
            />
          </div>

          <div className="sm:col-span-5">
            <label
              htmlFor="delegated-approver-label"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Role / Description (Optional)
            </label>
            <input
              id="delegated-approver-label"
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="e.g. VP Finance Delegate"
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {error && (
          <div
            id="delegated-approver-error"
            role="alert"
            className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button
            type="submit"
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add Delegated Approver
          </Button>
        </div>
      </form>

      {/* Approvers List */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-700">
          Current Delegated Approvers ({currentApprovers.length})
        </h3>

        {currentApprovers.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 border border-dashed rounded-lg">
            <UserCheck className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-xs font-medium text-gray-700">
              No delegated approvers added yet
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Add a trusted Stellar address or delegate identifier above to assign approver capabilities.
            </p>
          </div>
        ) : (
          <div className="divide-y border rounded-lg overflow-hidden bg-white">
            {currentApprovers.map((approver) => (
              <div
                key={approver.id}
                className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded border">
                      {maskAddress(approver.address)}
                    </span>
                    {approver.label && (
                      <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                        {approver.label}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(approver.id, approver.address)}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
                      title="Copy address"
                      aria-label={`Copy address for ${approver.address}`}
                    >
                      {copiedId === approver.id ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="text-[11px] text-gray-500 flex items-center gap-3">
                    <span>
                      Added: {new Date(approver.addedAt).toLocaleDateString()}
                    </span>
                    {approver.addedBy && (
                      <span>Added by: {approver.addedBy}</span>
                    )}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemove(approver.id)}
                  className="text-red-600 border-red-200 hover:bg-red-50 text-xs gap-1.5 shrink-0"
                  aria-label={`Remove approver ${approver.address}`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
