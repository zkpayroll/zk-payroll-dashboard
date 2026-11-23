"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { validateDelegatedApproverInput } from "@/lib/validation/delegatedApprover";

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

export type TemporaryDelegationStatus =
  | "scheduled"
  | "active"
  | "expired"
  | "revoked";

export interface TemporaryDelegation {
  id: string;
  address: string;
  label?: string;
  /** ISO timestamp — delegation is not usable before this time. */
  startsAt: string;
  /** ISO timestamp — delegation lapses at this time. */
  expiresAt: string;
  createdAt: string;
  createdBy?: string;
  companyId?: string;
  /** ISO timestamp set when the delegation is manually revoked early. */
  revokedAt?: string;
}

/** Temporary delegations are capped at 30 days to limit blast radius. */
export const MAX_TEMPORARY_DELEGATION_MS = 30 * 24 * 60 * 60 * 1000;

export function getTemporaryDelegationStatus(
  delegation: Pick<TemporaryDelegation, "startsAt" | "expiresAt" | "revokedAt">,
  now: number = Date.now(),
): TemporaryDelegationStatus {
  if (delegation.revokedAt) return "revoked";
  const start = new Date(delegation.startsAt).getTime();
  const end = new Date(delegation.expiresAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return "expired";
  }
  if (now < start) return "scheduled";
  if (now >= end) return "expired";
  return "active";
}

export function isTemporaryDelegationActive(
  delegation: Pick<TemporaryDelegation, "startsAt" | "expiresAt" | "revokedAt">,
  now: number = Date.now(),
): boolean {
  return getTemporaryDelegationStatus(delegation, now) === "active";
}

interface AddTemporaryDelegationInput {
  address: string;
  label?: string;
  startsAt: string;
  expiresAt: string;
  createdBy?: string;
}

interface DelegatedApproversState {
  approvers: DelegatedApprover[];
  temporaryDelegations: TemporaryDelegation[];
  addApprover: (
    address: string,
    label?: string,
    addedBy?: string,
  ) => { success: boolean; error?: string };
  removeApprover: (idOrAddress: string) => void;
  renewApproval: (idOrAddress: string) => void;
  addTemporaryDelegation: (
    input: AddTemporaryDelegationInput,
  ) => { success: boolean; error?: string; delegation?: TemporaryDelegation };
  revokeTemporaryDelegation: (idOrAddress: string) => void;
  reset: () => void;
}

export const useDelegatedApproversStore = create<DelegatedApproversState>()(
  persist(
    (set, get) => ({
      approvers: INITIAL_DELEGATED_APPROVERS,
      temporaryDelegations: [],

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

      renewApproval: (idOrAddress) => {
        const trimmed = idOrAddress.trim();
        set((state) => ({
          approvers: state.approvers.map((a) =>
            a.id === trimmed || a.address.toLowerCase() === trimmed.toLowerCase()
              ? { ...a, addedAt: new Date().toISOString() }
              : a,
          ),
        }));
      },

      addTemporaryDelegation: ({
        address,
        label,
        startsAt,
        expiresAt,
        createdBy = "Executive Admin",
      }) => {
        const trimmedAddress = address.trim();

        const addressValidation = validateDelegatedApproverInput(trimmedAddress);
        if (!addressValidation.isValid) {
          return { success: false, error: addressValidation.error };
        }

        const start = new Date(startsAt).getTime();
        const end = new Date(expiresAt).getTime();
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
          return {
            success: false,
            error:
              "Delegation window requires valid start and end timestamps (ISO format).",
          };
        }
        if (end <= start) {
          return {
            success: false,
            error:
              "Delegation end time must be after the start time. Pick a later expiry.",
          };
        }
        if (end - start > MAX_TEMPORARY_DELEGATION_MS) {
          return {
            success: false,
            error: "Temporary delegations are capped at 30 days. Choose a shorter window.",
          };
        }

        const current = get().temporaryDelegations;
        const isDuplicate = current.some(
          (d) =>
            !d.revokedAt &&
            d.address.toLowerCase() === trimmedAddress.toLowerCase() &&
            new Date(d.expiresAt).getTime() > Date.now(),
        );
        if (isDuplicate) {
          return {
            success: false,
            error:
              "An active temporary delegation already exists for this address. Revoke it first or wait for it to lapse.",
          };
        }

        const delegation: TemporaryDelegation = {
          id: `temp_del_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          address: trimmedAddress,
          label: label?.trim() || undefined,
          startsAt: new Date(start).toISOString(),
          expiresAt: new Date(end).toISOString(),
          createdAt: new Date().toISOString(),
          createdBy,
          companyId: "company_001",
        };

        set({ temporaryDelegations: [delegation, ...current] });
        return { success: true, delegation };
      },

      revokeTemporaryDelegation: (idOrAddress) => {
        const trimmed = idOrAddress.trim();
        set((state) => ({
          temporaryDelegations: state.temporaryDelegations.map((d) =>
            d.id === trimmed ||
            d.address.toLowerCase() === trimmed.toLowerCase()
              ? { ...d, revokedAt: d.revokedAt ?? new Date().toISOString() }
              : d,
          ),
        }));
      },

      reset: () => {
        set({ approvers: INITIAL_DELEGATED_APPROVERS, temporaryDelegations: [] });
      },
    }),
    {
      name: "zk_delegated_approvers_store",
    },
  ),
);
