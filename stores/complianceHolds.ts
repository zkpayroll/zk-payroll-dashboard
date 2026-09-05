import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Hold scope and status types ────────────────────────────────────────────

export type ComplianceHoldScope = "employer" | "period" | "batch" | "employee";

export type ComplianceHoldStatus = "active" | "released";

/**
 * Reason codes categorize the nature of a compliance hold.
 * Each maps to a human-readable message in the banner.
 */
export type ComplianceHoldReasonCode =
  | "regulatory_review"
  | "audit_in_progress"
  | "tax_filing_pending"
  | "jurisdiction_change"
  | "data_discrepancy"
  | "authorization_expired"
  | "manual_freeze";

// ─── Compliance hold model ──────────────────────────────────────────────────

export interface ComplianceHold {
  /** Unique identifier for this hold */
  id: string;
  /** Scope at which this hold applies */
  scope: ComplianceHoldScope;
  /** Reason code categorizing why the hold was placed */
  reasonCode: ComplianceHoldReasonCode;
  /** Human-readable explanation of the hold (safe for display) */
  description: string;
  /** ISO timestamp when the hold was created */
  createdAt: string;
  /** Current status of the hold */
  status: ComplianceHoldStatus;
  /** ISO timestamp when the hold was released, if released */
  releasedAt?: string | null;
  /** Identifier of the user who released the hold, if released */
  releasedBy?: string | null;
  /** Identifier of the entity this hold applies to (e.g. employee hash, batch id, period id) */
  targetRef?: string;
  /** Redacted label for the target entity (never raw employee name or sensitive data) */
  targetLabel?: string;
  /** Actions blocked by this hold */
  blockedActions: string[];
  /** Role required to release this hold */
  releaseAuthorizedRoles: ("admin" | "operator" | "auditor")[];
  /** Release instruction shown to authorized users */
  releaseInstruction: string;
}

// ─── Derived types ──────────────────────────────────────────────────────────

export interface ComplianceHoldFilter {
  scope?: ComplianceHoldScope;
  status?: ComplianceHoldStatus;
  reasonCode?: ComplianceHoldReasonCode;
}

// ─── Helper: safe scope label ───────────────────────────────────────────────

export function formatScopeLabel(scope: ComplianceHoldScope): string {
  switch (scope) {
    case "employer":
      return "Employer-wide";
    case "period":
      return "Pay Period";
    case "batch":
      return "Batch";
    case "employee":
      return "Employee";
  }
}

// ─── Reason code human-readable labels ──────────────────────────────────────

const REASON_LABELS: Record<ComplianceHoldReasonCode, string> = {
  regulatory_review: "Regulatory review in progress",
  audit_in_progress: "Compliance audit in progress",
  tax_filing_pending: "Tax filing pending",
  jurisdiction_change: "Jurisdiction change requires review",
  data_discrepancy: "Data discrepancy detected",
  authorization_expired: "Authorization has expired",
  manual_freeze: "Manually frozen",
};

export function formatReasonLabel(code: ComplianceHoldReasonCode): string {
  return REASON_LABELS[code] ?? code;
}

// ─── Store interface ────────────────────────────────────────────────────────

interface ComplianceHoldsStore {
  holds: ComplianceHold[];
  currentRole: "admin" | "operator" | "auditor" | null;

  /** Set the current user's role (used for authorization checks) */
  setCurrentRole: (role: "admin" | "operator" | "auditor" | null) => void;

  /** Load holds from an external source (e.g. API response) */
  setHolds: (holds: ComplianceHold[]) => void;

  /** Add a single hold */
  addHold: (hold: ComplianceHold) => void;

  /** Release a hold if the current role is authorized */
  releaseHold: (holdId: string, releasedBy: string) => boolean;

  /** Get all active holds */
  getActiveHolds: () => ComplianceHold[];

  /** Get active holds matching a filter */
  getFilteredHolds: (filter: ComplianceHoldFilter) => ComplianceHold[];

  /** Get active holds for a specific scope */
  getHoldsByScope: (scope: ComplianceHoldScope) => ComplianceHold[];

  /** Check if any active hold blocks a specific action */
  isActionBlocked: (action: string) => boolean;

  /** Get all active holds that block a specific action */
  getHoldsBlockingAction: (action: string) => ComplianceHold[];

  /** Check if the current role can release holds */
  canReleaseHolds: () => boolean;

  /** Check if a specific hold can be released by the current role */
  canReleaseHold: (holdId: string) => boolean;

  /** Get the set of all blocked action keys from active holds */
  getAllBlockedActions: () => string[];

  /** Reset the store */
  reset: () => void;
}

// ─── Store implementation ───────────────────────────────────────────────────

const initialState = {
  holds: [] as ComplianceHold[],
  currentRole: null as "admin" | "operator" | "auditor" | null,
};

export const useComplianceHoldsStore = create<ComplianceHoldsStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentRole: (role) => set({ currentRole: role }),

      setHolds: (holds) => set({ holds }),

      addHold: (hold) =>
        set((state) => ({ holds: [...state.holds, hold] })),

      releaseHold: (holdId, releasedBy) => {
        const { holds, currentRole } = get();
        const hold = holds.find((h) => h.id === holdId);
        if (!hold) return false;
        if (hold.status !== "active") return false;
        if (!hold.releaseAuthorizedRoles.includes(currentRole!)) return false;

        set((state) => ({
          holds: state.holds.map((h) =>
            h.id === holdId
              ? {
                  ...h,
                  status: "released" as ComplianceHoldStatus,
                  releasedAt: new Date().toISOString(),
                  releasedBy,
                }
              : h
          ),
        }));
        return true;
      },

      getActiveHolds: () =>
        get().holds.filter((h) => h.status === "active"),

      getFilteredHolds: (filter) => {
        return get().holds.filter((h) => {
          if (h.status !== "active") return false;
          if (filter.scope && h.scope !== filter.scope) return false;
          if (filter.reasonCode && h.reasonCode !== filter.reasonCode)
            return false;
          return true;
        });
      },

      getHoldsByScope: (scope) =>
        get().holds.filter((h) => h.status === "active" && h.scope === scope),

      isActionBlocked: (action) => {
        return get()
          .holds.filter((h) => h.status === "active")
          .some((h) => h.blockedActions.includes(action));
      },

      getHoldsBlockingAction: (action) => {
        return get()
          .holds.filter(
            (h) => h.status === "active" && h.blockedActions.includes(action)
          );
      },

      canReleaseHolds: () => {
        const { currentRole } = get();
        if (!currentRole) return false;
        // Admin can always release; auditor only if a hold explicitly allows it
        return currentRole === "admin";
      },

      canReleaseHold: (holdId) => {
        const { holds, currentRole } = get();
        if (!currentRole) return false;
        const hold = holds.find((h) => h.id === holdId);
        if (!hold || hold.status !== "active") return false;
        return hold.releaseAuthorizedRoles.includes(currentRole);
      },

      getAllBlockedActions: () => {
        const active = get().holds.filter((h) => h.status === "active");
        const blocked = new Set<string>();
        for (const hold of active) {
          for (const action of hold.blockedActions) {
            blocked.add(action);
          }
        }
        return Array.from(blocked);
      },

      reset: () => set(initialState),
    }),
    { name: "zk-payroll-compliance-holds" }
  )
);
