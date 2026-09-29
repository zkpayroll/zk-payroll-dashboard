"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface DelegatedApprover {
  id: string;
  address: string;
  label?: string;
  addedAt: string;
  addedBy?: string;
  companyId?: string;
}

const INITIAL_DELEGATED_APPROVERS: DelegatedApprover[] = [
  {
    id: "del_app_001",
    address: "GAYN325M3W4R3J2J53X2Z3Q4W5E6R7T8Y9U0I1O2P3A4S5D6F7G8H9J0",
    label: "Treasury Delegate",
    addedAt: "2026-07-20T10:00:00Z",
    addedBy: "Executive Admin",
    companyId: "company_001",
  },
  {
    id: "del_app_002",
    address: "GB7N6543210987654321098765432109876543210987654321098765",
    label: "Compliance Delegate",
    addedAt: "2026-07-22T14:30:00Z",
    addedBy: "Compliance Lead",
    companyId: "company_001",
  },
];

interface DelegatedApproversState {
  approvers: DelegatedApprover[];
  addApprover: (
    address: string,
    label?: string,
    addedBy?: string,
  ) => { success: boolean; error?: string };
  removeApprover: (idOrAddress: string) => void;
  reset: () => void;
}

export const useDelegatedApproversStore = create<DelegatedApproversState>()(
  persist(
    (set, get) => ({
      approvers: INITIAL_DELEGATED_APPROVERS,

      addApprover: (address, label, addedBy = "Executive Admin") => {
        const trimmedAddress = address.trim();
        const current = get().approvers;

        // Duplicate check
        const isDuplicate = current.some(
          (a) => a.address.toLowerCase() === trimmedAddress.toLowerCase(),
        );

        if (isDuplicate) {
          return {
            success: false,
            error: "Duplicate approver address or identifier already exists.",
          };
        }

        const newApprover: DelegatedApprover = {
          id: `del_app_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          address: trimmedAddress,
          label: label?.trim() || undefined,
          addedAt: new Date().toISOString(),
          addedBy,
          companyId: "company_001",
        };

        set({ approvers: [newApprover, ...current] });
        return { success: true };
      },

      removeApprover: (idOrAddress) => {
        const trimmed = idOrAddress.trim();
        set((state) => ({
          approvers: state.approvers.filter(
            (a) =>
              a.id !== trimmed &&
              a.address.toLowerCase() !== trimmed.toLowerCase(),
          ),
        }));
      },

      reset: () => {
        set({ approvers: INITIAL_DELEGATED_APPROVERS });
      },
    }),
    {
      name: "zk_delegated_approvers_store",
    },
  ),
);
