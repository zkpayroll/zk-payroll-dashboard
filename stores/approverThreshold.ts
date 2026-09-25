import { create } from "zustand";
import type { ApproverThresholdPolicy, ApproverThresholdRotationRequest } from "@/types/models";
import {
  MOCK_APPROVER_THRESHOLD_POLICY,
  MOCK_BATCHES_ON_CURRENT_POLICY,
} from "@/lib/api/mockData";
import { validateApproverThreshold } from "@/lib/validation/approverThreshold";

function generateRequestId(): string {
  return `atr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export interface ProposeRotationResult {
  success: boolean;
  request: ApproverThresholdRotationRequest | null;
  error: string | null;
}

interface ApproverThresholdStore {
  currentPolicy: ApproverThresholdPolicy;
  batchesOnCurrentPolicy: string[];
  pendingRequest: ApproverThresholdRotationRequest | null;
  proposeRotation: (proposedRequiredApprovals: number, createdBy: string) => ProposeRotationResult;
  confirmRotation: () => void;
  cancelRotation: () => void;
}

export const useApproverThresholdStore = create<ApproverThresholdStore>((set, get) => ({
  currentPolicy: MOCK_APPROVER_THRESHOLD_POLICY,
  batchesOnCurrentPolicy: MOCK_BATCHES_ON_CURRENT_POLICY,
  pendingRequest: null,

  proposeRotation: (proposedRequiredApprovals, createdBy) => {
    const { currentPolicy, batchesOnCurrentPolicy } = get();
    const validation = validateApproverThreshold(proposedRequiredApprovals, currentPolicy.requiredApprovals);

    if (!validation.isValid) {
      return { success: false, request: null, error: validation.message };
    }

    const request: ApproverThresholdRotationRequest = {
      id: generateRequestId(),
      companyId: currentPolicy.companyId,
      currentPolicy,
      proposedRequiredApprovals,
      affectedBatchIds: [...batchesOnCurrentPolicy],
      status: "pending",
      createdAt: new Date().toISOString(),
      createdBy,
    };

    set({ pendingRequest: request });
    return { success: true, request, error: null };
  },

  confirmRotation: () => {
    const { pendingRequest, currentPolicy } = get();
    if (!pendingRequest) return;

    const nextPolicy: ApproverThresholdPolicy = {
      companyId: currentPolicy.companyId,
      version: currentPolicy.version + 1,
      requiredApprovals: pendingRequest.proposedRequiredApprovals,
      effectiveFrom: new Date().toISOString(),
      createdBy: pendingRequest.createdBy,
    };

    set({
      currentPolicy: nextPolicy,
      // Batches locked to the policy version being replaced keep their
      // requirement — the new policy starts with no locked batches yet.
      batchesOnCurrentPolicy: [],
      pendingRequest: null,
    });
  },

  cancelRotation: () => {
    set({ pendingRequest: null });
  },
}));
