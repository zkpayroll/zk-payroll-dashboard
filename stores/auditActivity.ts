import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuditActionType =
  | "key_granted"
  | "key_revoked"
  | "request_approved"
  | "request_rejected"
  | "export_prepared"
  | "export_downloaded";

export interface AuditActivityEntry {
  id: string;
  action: AuditActionType;
  actor: string;
  actorOrg?: string;
  targetName: string;
  targetOrg?: string;
  scope?: "read-only" | "full-audit";
  timestamp: string;
  summary: string;
}

export const MOCK_AUDIT_ACTIVITIES: AuditActivityEntry[] = [
  {
    id: "aud_001",
    action: "key_granted",
    actor: "Current Admin",
    actorOrg: "ZK Payroll Inc.",
    targetName: "Sarah Chen",
    targetOrg: "Deloitte",
    scope: "full-audit",
    timestamp: "2025-01-15T10:00:00Z",
    summary: "Full-audit view key granted to Sarah Chen (Deloitte) for annual compliance review.",
  },
  {
    id: "aud_002",
    action: "key_granted",
    actor: "Current Admin",
    actorOrg: "ZK Payroll Inc.",
    targetName: "James Okafor",
    targetOrg: "KPMG",
    scope: "read-only",
    timestamp: "2025-06-01T08:00:00Z",
    summary: "Read-only view key granted to James Okafor (KPMG) for transaction volume review.",
  },
  {
    id: "aud_003",
    action: "request_approved",
    actor: "Current Admin",
    actorOrg: "ZK Payroll Inc.",
    targetName: "Elena Rodriguez",
    targetOrg: "EY",
    scope: "read-only",
    timestamp: "2025-06-21T10:00:00Z",
    summary: "Audit access request from Elena Rodriguez (EY) approved. View key issued.",
  },
  {
    id: "aud_004",
    action: "request_rejected",
    actor: "Current Admin",
    actorOrg: "ZK Payroll Inc.",
    targetName: "David Kim",
    targetOrg: "Independent",
    scope: "full-audit",
    timestamp: "2025-05-11T09:45:00Z",
    summary: "Audit access request from David Kim (Independent) rejected. Scope not justified.",
  },
  {
    id: "aud_005",
    action: "key_revoked",
    actor: "Current Admin",
    actorOrg: "ZK Payroll Inc.",
    targetName: "James Okafor",
    targetOrg: "KPMG",
    scope: "read-only",
    timestamp: "2025-11-15T14:30:00Z",
    summary: "View key for James Okafor (KPMG) revoked. Access immediately invalidated.",
  },
  {
    id: "aud_006",
    action: "request_approved",
    actor: "Current Admin",
    actorOrg: "ZK Payroll Inc.",
    targetName: "Michael Chang",
    targetOrg: "PwC",
    scope: "full-audit",
    timestamp: "2025-06-26T10:30:00Z",
    summary: "Audit access request from Michael Chang (PwC) approved for Q1-Q2 annual review.",
  },
];

interface AuditActivityState {
  activities: AuditActivityEntry[];
  addActivity: (entry: AuditActivityEntry) => void;
  setActivities: (activities: AuditActivityEntry[]) => void;
}

export const useAuditActivityStore = create<AuditActivityState>()(
  persist(
    (set) => ({
      activities: [],
      addActivity: (entry) =>
        set((state) => ({
          activities: [...state.activities, entry],
        })),
      setActivities: (activities) => set({ activities }),
    }),
    { name: "zk-payroll-audit-activity" }
  )
);
