import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole } from "@/types/models";
import type {
  AuditScopedReceipt,
  DisclosureStatus,
  DownloadStep,
  ExportMode,
  RedactedReceipt,
} from "@/types/receipts";
import { EXPORT_MODE_OPTIONS } from "@/types/receipts";
import type { AuditSafeReceipt } from "@/types/models";

export interface ReceiptDownloadState {
  selectedReceiptId: string | null;
  exportMode: ExportMode;
  disclosureStatus: DisclosureStatus;
  currentStep: DownloadStep;
  isDownloading: boolean;
  downloadError: string | null;

  setReceipt: (receiptId: string | null) => void;
  setExportMode: (mode: ExportMode) => void;
  acknowledgeDisclosure: () => void;
  setStep: (step: DownloadStep) => void;
  startDownload: () => void;
  completeDownload: () => void;
  failDownload: (error: string) => void;
  reset: () => void;
}

const initialState = {
  selectedReceiptId: null as string | null,
  exportMode: "redacted" as ExportMode,
  disclosureStatus: "pending" as DisclosureStatus,
  currentStep: "select-mode" as DownloadStep,
  isDownloading: false,
  downloadError: null as string | null,
};

export function canAccessExportMode(role: UserRole, mode: ExportMode): boolean {
  const option = EXPORT_MODE_OPTIONS.find((o) => o.mode === mode);
  if (!option) return false;
  return option.requiredRoles.includes(role);
}

export function getReceiptForMode(
  receipt: AuditSafeReceipt,
  mode: ExportMode,
): RedactedReceipt | AuditScopedReceipt | AuditSafeReceipt {
  switch (mode) {
    case "redacted":
      return {
        receiptId: receipt.receiptId,
        payrollRunId: receipt.payrollRunId,
        timestamp: receipt.timestamp,
        totalDisbursed: "****",
        recipientCount: receipt.recipientCount,
        status: receipt.status,
        receiptHash: receipt.receiptHash,
      } satisfies RedactedReceipt;
    case "audit-scoped":
      return {
        receiptId: receipt.receiptId,
        payrollRunId: receipt.payrollRunId,
        timestamp: receipt.timestamp,
        totalDisbursed: receipt.totalDisbursed,
        recipientCount: receipt.recipientCount,
        recipientCommitments: receipt.recipientCommitments,
        status: receipt.status,
        receiptHash: receipt.receiptHash,
        signature: receipt.signature,
      } satisfies AuditScopedReceipt;
    case "full":
      return receipt;
  }
}

export const MOCK_RECEIPTS: AuditSafeReceipt[] = [
  {
    receiptId: "rcpt_2025_01_001",
    payrollRunId: "tx_002",
    timestamp: "2025-01-31T09:00:00Z",
    totalDisbursed: 9500,
    recipientCount: 2,
    recipientCommitments: [
      "0xabc123def456",
      "0x789ghi012jkl",
    ],
    status: "verified",
    receiptHash: "0xhash_001",
    signature: "sig_001_xyz",
  },
  {
    receiptId: "rcpt_2025_02_001",
    payrollRunId: "tx_001",
    timestamp: "2025-02-28T09:01:00Z",
    totalDisbursed: 9500,
    recipientCount: 2,
    recipientCommitments: [
      "0xdef456abc789",
      "0x012jkl345mno",
    ],
    status: "verified",
    receiptHash: "0xhash_002",
    signature: "sig_002_abc",
  },
  {
    receiptId: "rcpt_2026_07_usdc",
    payrollRunId: "mar_001",
    timestamp: "2026-07-02T10:15:00Z",
    totalDisbursed: 21700,
    recipientCount: 3,
    recipientCommitments: [
      "0xabc_usdc_001",
      "0xdef_usdc_002",
      "0xghi_usdc_003",
    ],
    status: "pending",
    receiptHash: "0xhash_003",
    signature: "sig_003_qr",
  },
];

export const useReceiptDownloadStore = create<ReceiptDownloadState>()(
  persist(
    (set) => ({
      ...initialState,

      setReceipt: (receiptId) =>
        set({
          selectedReceiptId: receiptId,
          currentStep: "select-mode",
          disclosureStatus: "pending",
          exportMode: "redacted",
          downloadError: null,
        }),

      setExportMode: (mode) => set({ exportMode: mode }),

      acknowledgeDisclosure: () =>
        set({ disclosureStatus: "acknowledged", currentStep: "confirm" }),

      setStep: (step) => set({ currentStep: step }),

      startDownload: () =>
        set({ isDownloading: true, downloadError: null }),

      completeDownload: () =>
        set({
          isDownloading: false,
          currentStep: "complete",
          downloadError: null,
        }),

      failDownload: (error) =>
        set({ isDownloading: false, downloadError: error }),

      reset: () => set(initialState),
    }),
    { name: "zk-payroll-receipt-download" },
  ),
);
