import { create } from "zustand";
import type { ComplianceEvidencePointer, EvidencePointerType } from "@/types/models";
import { MOCK_COMPLIANCE_EVIDENCE_POINTERS } from "@/lib/api/mockData";
import { validateEvidencePointerReference } from "@/lib/validation/evidencePointer";

export interface AddEvidencePointerInput {
  reviewCaseId: string;
  payrollRunId: string;
  pointerType: EvidencePointerType;
  reference: string;
  description: string;
  createdBy: string;
}

export interface AddEvidencePointerResult {
  success: boolean;
  pointer: ComplianceEvidencePointer;
}

function generatePointerId(): string {
  return `cep_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

interface EvidencePointerStore {
  pointers: ComplianceEvidencePointer[];
  setPointers: (pointers: ComplianceEvidencePointer[]) => void;
  addPointer: (input: AddEvidencePointerInput) => AddEvidencePointerResult;
  getByReviewCase: (reviewCaseId: string) => ComplianceEvidencePointer[];
  getByPayrollRun: (payrollRunId: string) => ComplianceEvidencePointer[];
}

export const useEvidencePointerStore = create<EvidencePointerStore>((set, get) => ({
  pointers: MOCK_COMPLIANCE_EVIDENCE_POINTERS,

  setPointers: (pointers) => set({ pointers }),

  addPointer: (input) => {
    const validation = validateEvidencePointerReference(input.pointerType, input.reference);

    const pointer: ComplianceEvidencePointer = {
      id: generatePointerId(),
      reviewCaseId: input.reviewCaseId,
      payrollRunId: input.payrollRunId,
      pointerType: input.pointerType,
      reference: validation.normalized,
      description: input.description,
      status: validation.isValid ? "valid" : "invalid",
      validationError: validation.message ?? undefined,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
    };

    set((state) => ({ pointers: [pointer, ...state.pointers] }));

    return { success: validation.isValid, pointer };
  },

  getByReviewCase: (reviewCaseId) => {
    return get().pointers.filter((p) => p.reviewCaseId === reviewCaseId);
  },

  getByPayrollRun: (payrollRunId) => {
    return get().pointers.filter((p) => p.payrollRunId === payrollRunId);
  },
}));
