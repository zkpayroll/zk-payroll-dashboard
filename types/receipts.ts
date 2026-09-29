import type { AuditSafeReceipt, UserRole } from "@/types/models";

export type ExportMode = "redacted" | "audit-scoped" | "full";

export type DisclosureStatus = "pending" | "acknowledged";

export type DownloadStep = "select-mode" | "disclosure" | "confirm" | "complete";

export interface RedactedReceipt {
  receiptId: string;
  payrollRunId: string;
  timestamp: string;
  totalDisbursed: string;
  recipientCount: number;
  status: AuditSafeReceipt["status"];
  receiptHash: string;
}

export interface AuditScopedReceipt {
  receiptId: string;
  payrollRunId: string;
  timestamp: string;
  totalDisbursed: number;
  recipientCount: number;
  recipientCommitments: string[];
  status: AuditSafeReceipt["status"];
  receiptHash: string;
  signature: string;
}

export interface ReceiptDownloadConfig {
  receiptId: string;
  exportMode: ExportMode;
  role: UserRole;
}

export interface ExportModeOption {
  mode: ExportMode;
  label: string;
  description: string;
  requiredRoles: UserRole[];
  disclosureWarning: string;
}

export const EXPORT_MODE_OPTIONS: ExportModeOption[] = [
  {
    mode: "redacted",
    label: "Redacted Export",
    description:
      "Safe for sharing. Amounts are masked and no individual recipient data is included.",
    requiredRoles: ["admin", "operator", "auditor"],
    disclosureWarning: "",
  },
  {
    mode: "audit-scoped",
    label: "Audit-Scoped Export",
    description:
      "Includes commitment hashes and signatures for compliance verification. Restricted to auditors and admins.",
    requiredRoles: ["admin", "auditor"],
    disclosureWarning:
      "This export contains cryptographic commitment hashes and signatures. Handle in accordance with your data classification policy.",
  },
  {
    mode: "full",
    label: "Full Admin Export",
    description:
      "Unredacted receipt with all payroll data. Admin-only and logged for compliance.",
    requiredRoles: ["admin"],
    disclosureWarning:
      "This export contains full unredacted payroll data including amounts, recipient details, and transaction signatures. Downloading this export is recorded in the audit log. Only share through encrypted channels.",
  },
];

export const DISCLOSURE_WARNINGS: Record<ExportMode, string> = {
  redacted: "",
  "audit-scoped":
    "This export contains cryptographic commitment hashes and digital signatures. Ensure handling complies with your organization's data classification and retention policies.",
  full:
    "WARNING: This export contains unredacted payroll data including individual salary amounts, wallet addresses, and transaction signatures. This download will be logged in the compliance audit trail. Do not transmit via unencrypted channels.",
};
