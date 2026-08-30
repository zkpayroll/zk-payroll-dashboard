import type { UserRole } from "@/types";
import { MOCK_COMPANIES } from "@/lib/api/mockData";

export type RoleGroupKey = UserRole | "complianceReviewer";

export interface RoleMember {
  id: string;
  name: string;
  walletAddress: string;
  addedAt: string;
}

export interface RoleGroup {
  key: RoleGroupKey;
  label: string;
  description: string;
  members: RoleMember[];
}

export const ROLE_GROUP_LABELS: Record<RoleGroupKey, string> = {
  admin: "Admins",
  operator: "Operators",
  auditor: "Auditors",
  complianceReviewer: "Compliance Reviewers",
};

export const ROLE_GROUP_DESCRIPTIONS: Record<RoleGroupKey, string> = {
  admin: "Full access, including treasury controls and company setup.",
  operator: "Can execute and review payroll runs; no treasury access.",
  auditor: "Read-only access to compliance and audit-ledger exports.",
  complianceReviewer: "Reviews compliance evidence bundles and audit requests.",
};

const company = MOCK_COMPANIES[0];

/**
 * Mock directory of accounts holding each payroll role. In the absence of a
 * dedicated roles API this mirrors the addresses already used elsewhere in
 * the app (company admin, seeded operator/auditor accounts) so the viewer
 * reflects data consistent with the rest of the dashboard.
 */
function buildRoleDirectory(): RoleGroup[] {
  const groups: Record<RoleGroupKey, RoleMember[]> = {
    admin: company?.admin
      ? [
          {
            id: "role_admin_001",
            name: "Primary Admin",
            walletAddress: company.admin,
            addedAt: "2025-01-05T09:00:00Z",
          },
        ]
      : [],
    operator: [
      {
        id: "role_operator_001",
        name: "Payroll Operator",
        walletAddress: "GBOPS7643QOPERATOR234567890123456789012345678901234567",
        addedAt: "2025-01-10T09:00:00Z",
      },
    ],
    auditor: [
      {
        id: "role_auditor_001",
        name: "External Auditor",
        walletAddress: "GAUDIT9643QAUDITOR234567890123456789012345678901234567",
        addedAt: "2025-01-12T09:00:00Z",
      },
    ],
    complianceReviewer: [],
  };

  return (Object.keys(groups) as RoleGroupKey[]).map((key) => ({
    key,
    label: ROLE_GROUP_LABELS[key],
    description: ROLE_GROUP_DESCRIPTIONS[key],
    members: groups[key],
  }));
}

export interface RoleDirectoryResult {
  groups: RoleGroup[];
}

/**
 * Simulated read-only fetch for the role directory. Returns a resolved
 * promise so the viewer can exercise real loading/error UI states without
 * depending on a live backend endpoint.
 */
export async function fetchRoleDirectory(): Promise<RoleDirectoryResult> {
  return { groups: buildRoleDirectory() };
}
