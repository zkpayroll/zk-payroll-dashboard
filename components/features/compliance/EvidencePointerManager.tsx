"use client";

import { useMemo, useState } from "react";
import {
  FileSearch,
  Link2,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldOff,
} from "lucide-react";
import { toast } from "sonner";
import { useEvidencePointerStore } from "@/stores/evidencePointers";
import EmptyState from "@/components/ui/EmptyState";
import type { ComplianceEvidencePointer, EvidencePointerType } from "@/types/models";

const POINTER_TYPE_LABELS: Record<EvidencePointerType, string> = {
  url: "URL",
  ipfs: "IPFS CID",
  "document-hash": "Document Hash",
  "case-reference": "Case Reference",
};

const POINTER_TYPE_PLACEHOLDERS: Record<EvidencePointerType, string> = {
  url: "https://example.com/evidence/case-4471",
  ipfs: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
  "document-hash": "0x8f3a1c9d4e5b6a7f8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
  "case-reference": "EXT-CASE-2025-4471",
};

function StatusBadge({ status }: { status: ComplianceEvidencePointer["status"] }) {
  if (status === "valid") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
        Valid
      </span>
    );
  }
  if (status === "invalid") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <XCircle className="w-3 h-3" aria-hidden="true" />
        Invalid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
      <Clock className="w-3 h-3" aria-hidden="true" />
      Pending
    </span>
  );
}

function EvidencePointerForm() {
  const addPointer = useEvidencePointerStore((s) => s.addPointer);

  const [reviewCaseId, setReviewCaseId] = useState("");
  const [payrollRunId, setPayrollRunId] = useState("");
  const [pointerType, setPointerType] = useState<EvidencePointerType>("url");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);

  const isSubmittable =
    reviewCaseId.trim().length > 0 &&
    payrollRunId.trim().length > 0 &&
    reference.trim().length > 0 &&
    description.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubmittable) return;

    const result = addPointer({
      reviewCaseId: reviewCaseId.trim(),
      payrollRunId: payrollRunId.trim(),
      pointerType,
      reference,
      description: description.trim(),
      createdBy: "Current User",
    });

    if (result.success) {
      setLastError(null);
      toast.success("Evidence pointer added", {
        description: `Attached to case ${result.pointer.reviewCaseId}.`,
      });
      setReviewCaseId("");
      setPayrollRunId("");
      setReference("");
      setDescription("");
    } else {
      setLastError(result.pointer.validationError ?? "Invalid reference.");
      toast.error("Evidence pointer rejected", {
        description: result.pointer.validationError ?? "Invalid reference.",
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4"
      aria-label="Add evidence pointer"
    >
      <h3 className="text-sm font-semibold text-gray-900">Attach evidence pointer</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="review-case-id" className="block text-xs font-medium text-gray-700 mb-1">
            Review case ID
          </label>
          <input
            id="review-case-id"
            type="text"
            value={reviewCaseId}
            onChange={(e) => setReviewCaseId(e.target.value)}
            placeholder="case_2025_02_014"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            required
          />
        </div>

        <div>
          <label htmlFor="payroll-run-id" className="block text-xs font-medium text-gray-700 mb-1">
            Payroll period / run ID
          </label>
          <input
            id="payroll-run-id"
            type="text"
            value={payrollRunId}
            onChange={(e) => setPayrollRunId(e.target.value)}
            placeholder="tx_001"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="pointer-type" className="block text-xs font-medium text-gray-700 mb-1">
          Pointer type
        </label>
        <select
          id="pointer-type"
          value={pointerType}
          onChange={(e) => setPointerType(e.target.value as EvidencePointerType)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          {(Object.keys(POINTER_TYPE_LABELS) as EvidencePointerType[]).map((type) => (
            <option key={type} value={type}>
              {POINTER_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="reference" className="block text-xs font-medium text-gray-700 mb-1">
          Reference
        </label>
        <input
          id="reference"
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={POINTER_TYPE_PLACEHOLDERS[pointerType]}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          required
        />
        <p className="mt-1 text-[11px] text-gray-500 flex items-center gap-1">
          <ShieldOff className="w-3 h-3" aria-hidden="true" />
          Only a reference is stored — never the evidence content itself.
        </p>
      </div>

      <div>
        <label htmlFor="description" className="block text-xs font-medium text-gray-700 mb-1">
          Description
        </label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Signed dispute resolution memo"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          required
        />
      </div>

      {lastError && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {lastError}
        </div>
      )}

      <button
        type="submit"
        disabled={!isSubmittable}
        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 transition-colors"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        Add pointer
      </button>
    </form>
  );
}

function PointerCard({ pointer }: { pointer: ComplianceEvidencePointer }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/30 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
            {POINTER_TYPE_LABELS[pointer.pointerType]}
          </span>
        </div>
        <StatusBadge status={pointer.status} />
      </div>

      <p className="text-sm text-gray-700">{pointer.description}</p>

      <p className="text-xs font-mono text-gray-500 truncate" title={pointer.reference}>
        {pointer.reference}
      </p>

      {pointer.status === "invalid" && pointer.validationError && (
        <p className="text-xs text-red-600">{pointer.validationError}</p>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gray-200/80 text-[11px] text-gray-500">
        <span>Payroll run: {pointer.payrollRunId}</span>
        <span>{new Date(pointer.createdAt).toLocaleString()}</span>
      </div>
    </div>
  );
}

function EvidencePointerManager() {
  const pointers = useEvidencePointerStore((s) => s.pointers);
  const [caseFilter, setCaseFilter] = useState<string>("all");

  const reviewCaseIds = useMemo(
    () => Array.from(new Set(pointers.map((p) => p.reviewCaseId))).sort(),
    [pointers],
  );

  const groupedByCase = useMemo(() => {
    const filtered =
      caseFilter === "all" ? pointers : pointers.filter((p) => p.reviewCaseId === caseFilter);

    const groups = new Map<string, ComplianceEvidencePointer[]>();
    for (const pointer of filtered) {
      const existing = groups.get(pointer.reviewCaseId) ?? [];
      existing.push(pointer);
      groups.set(pointer.reviewCaseId, existing);
    }
    return groups;
  }, [pointers, caseFilter]);

  return (
    <div className="space-y-6" data-testid="evidence-pointer-manager">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Evidence Pointer Manager</h2>
        <p className="text-sm text-gray-500 mt-1">
          Attach and validate references to compliance evidence without exposing its contents.
        </p>
      </div>

      <EvidencePointerForm />

      {pointers.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="No evidence pointers yet"
          description="Attach a pointer above to link a review case to its supporting evidence."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label htmlFor="case-filter" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Review case:
            </label>
            <select
              id="case-filter"
              value={caseFilter}
              onChange={(e) => setCaseFilter(e.target.value)}
              className="text-xs rounded-lg border border-gray-300 bg-white px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">All cases</option>
              {reviewCaseIds.map((caseId) => (
                <option key={caseId} value={caseId}>
                  {caseId}
                </option>
              ))}
            </select>
          </div>

          {Array.from(groupedByCase.entries()).map(([reviewCaseId, casePointers]) => (
            <div key={reviewCaseId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-900">{reviewCaseId}</h3>
                <p className="text-xs text-gray-500">
                  {casePointers.length} pointer{casePointers.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {casePointers.map((pointer) => (
                  <PointerCard key={pointer.id} pointer={pointer} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EvidencePointerManager;
