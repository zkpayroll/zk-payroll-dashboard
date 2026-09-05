import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ArchivedRunStatus =
  | "archived"
  | "finalized"
  | "verified"
  | "disputed"
  | "completed";

export type AuditAvailability = "available" | "pending" | "unavailable";

export interface ArchivedPayrollRun {
  id: string;
  payrollRunId: string;
  employerName: string;
  employerId: string;
  payPeriod: string;
  asset: string;
  status: ArchivedRunStatus;
  auditAvailability: AuditAvailability;
  totalAmount: number;
  employeeCount: number;
  executedAt: string;
  transactionHash: string;
  bundleId?: string;
  receiptId?: string;
  isDisputed: boolean;
  disputeReason?: string;
  isArchived: boolean;
  archivedAt?: string;
  archivedBy?: string;
  notes?: string;
}

export type ArchiveFilterStatus = "all" | ArchivedRunStatus;
export type ArchiveFilterAudit = "all" | AuditAvailability;

export interface ArchiveStoreState {
  runs: ArchivedPayrollRun[];
  searchQuery: string;
  periodFilter: string;
  assetFilter: string;
  employerFilter: string;
  statusFilter: ArchiveFilterStatus;
  auditFilter: ArchiveFilterAudit;
  hidePrivateData: boolean;
  selectedRunId: string | null;

  setSearchQuery: (query: string) => void;
  setPeriodFilter: (period: string) => void;
  setAssetFilter: (asset: string) => void;
  setEmployerFilter: (employer: string) => void;
  setStatusFilter: (status: ArchiveFilterStatus) => void;
  setAuditFilter: (audit: ArchiveFilterAudit) => void;
  toggleHidePrivateData: () => void;
  setHidePrivateData: (hide: boolean) => void;
  setSelectedRunId: (id: string | null) => void;
  archiveRun: (id: string) => boolean;
  unarchiveRun: (id: string) => void;
  getFilteredRuns: () => ArchivedPayrollRun[];
  resetFilters: () => void;
  setRuns: (runs: ArchivedPayrollRun[]) => void;
  reset: () => void;
}

export const MOCK_ARCHIVED_RUNS: ArchivedPayrollRun[] = [
  {
    id: "arc_001",
    payrollRunId: "tx_002",
    employerName: "ZK Payroll Inc.",
    employerId: "company_001",
    payPeriod: "2025-01",
    asset: "USDC",
    status: "archived",
    auditAvailability: "available",
    totalAmount: 9500,
    employeeCount: 2,
    executedAt: "2025-01-31T09:00:00Z",
    transactionHash: "def789ghi01234567890abcdef1234567890abcdef123456",
    bundleId: "CEB-2025-01-003",
    receiptId: "rcpt_2025_01_001",
    isDisputed: false,
    isArchived: true,
    archivedAt: "2025-02-01T10:00:00Z",
    archivedBy: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    notes: "January 2025 standard monthly payroll run.",
  },
  {
    id: "arc_002",
    payrollRunId: "tx_001",
    employerName: "ZK Payroll Inc.",
    employerId: "company_001",
    payPeriod: "2025-02",
    asset: "USDC",
    status: "finalized",
    auditAvailability: "available",
    totalAmount: 9500,
    employeeCount: 2,
    executedAt: "2025-02-28T09:01:00Z",
    transactionHash: "abc123def4567890abcdef1234567890abcdef123456",
    bundleId: "CEB-2025-02-001",
    receiptId: "rcpt_2025_02_001a",
    isDisputed: false,
    isArchived: true,
    archivedAt: "2025-03-01T11:30:00Z",
    archivedBy: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    notes: "February 2025 verified settlement.",
  },
  {
    id: "arc_003",
    payrollRunId: "mar_001",
    employerName: "ZK Payroll Inc.",
    employerId: "company_001",
    payPeriod: "2026-07",
    asset: "USDC & XLM",
    status: "archived",
    auditAvailability: "available",
    totalAmount: 21700,
    employeeCount: 3,
    executedAt: "2026-07-02T10:15:00Z",
    transactionHash: "abc123usdc_tx_001_and_xlm_tx_001",
    bundleId: "CEB-2026-07-002",
    receiptId: "rcpt_2026_07_usdc",
    isDisputed: false,
    isArchived: true,
    archivedAt: "2026-07-03T08:15:00Z",
    archivedBy: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    notes: "Q3 2026 Multi-Asset Payroll Run finalized & archived.",
  },
  {
    id: "arc_004",
    payrollRunId: "tx_disputed_01",
    employerName: "Accra Remote Collective",
    employerId: "company_002",
    payPeriod: "2025-03",
    asset: "EURC",
    status: "disputed",
    auditAvailability: "pending",
    totalAmount: 14200,
    employeeCount: 4,
    executedAt: "2025-03-31T14:20:00Z",
    transactionHash: "disputed_tx_9981247192849102",
    isDisputed: true,
    disputeReason: "Salary commitment mismatch under investigation by compliance team.",
    isArchived: false,
    notes: "Disputed run — flagged as unsafe to archive until resolution.",
  },
  {
    id: "arc_005",
    payrollRunId: "tx_legacy_05",
    employerName: "Lagos Payroll Cooperative",
    employerId: "company_003",
    payPeriod: "2024-12",
    asset: "XLM",
    status: "completed",
    auditAvailability: "unavailable",
    totalAmount: 18500,
    employeeCount: 5,
    executedAt: "2024-12-30T10:00:00Z",
    transactionHash: "xlm_legacy_tx_0059128391203",
    isDisputed: false,
    isArchived: true,
    archivedAt: "2024-12-31T18:00:00Z",
    notes: "Legacy payroll record archived without ZK audit bundle.",
  },
];

const initialState = {
  runs: MOCK_ARCHIVED_RUNS,
  searchQuery: "",
  periodFilter: "all",
  assetFilter: "all",
  employerFilter: "all",
  statusFilter: "all" as ArchiveFilterStatus,
  auditFilter: "all" as ArchiveFilterAudit,
  hidePrivateData: true,
  selectedRunId: null as string | null,
};

export const useArchiveStore = create<ArchiveStoreState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setPeriodFilter: (periodFilter) => set({ periodFilter }),
      setAssetFilter: (assetFilter) => set({ assetFilter }),
      setEmployerFilter: (employerFilter) => set({ employerFilter }),
      setStatusFilter: (statusFilter) => set({ statusFilter }),
      setAuditFilter: (auditFilter) => set({ auditFilter }),
      toggleHidePrivateData: () =>
        set((state) => ({ hidePrivateData: !state.hidePrivateData })),
      setHidePrivateData: (hidePrivateData) => set({ hidePrivateData }),
      setSelectedRunId: (selectedRunId) => set({ selectedRunId }),

      archiveRun: (id) => {
        const run = get().runs.find((r) => r.id === id || r.payrollRunId === id);
        if (!run) return false;
        if (run.isDisputed) {
          return false;
        }

        set((state) => ({
          runs: state.runs.map((r) =>
            r.id === id || r.payrollRunId === id
              ? {
                  ...r,
                  isArchived: true,
                  status: r.status === "disputed" ? r.status : "archived",
                  archivedAt: new Date().toISOString(),
                }
              : r
          ),
        }));
        return true;
      },

      unarchiveRun: (id) => {
        set((state) => ({
          runs: state.runs.map((r) =>
            r.id === id || r.payrollRunId === id
              ? { ...r, isArchived: false }
              : r
          ),
        }));
      },

      getFilteredRuns: () => {
        const {
          runs,
          searchQuery,
          periodFilter,
          assetFilter,
          employerFilter,
          statusFilter,
          auditFilter,
        } = get();

        return runs.filter((run) => {
          // Search Query
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchesId = run.id.toLowerCase().includes(q);
            const matchesRunId = run.payrollRunId.toLowerCase().includes(q);
            const matchesEmployer = run.employerName.toLowerCase().includes(q);
            const matchesPeriod = run.payPeriod.toLowerCase().includes(q);
            const matchesAsset = run.asset.toLowerCase().includes(q);
            const matchesTx = run.transactionHash.toLowerCase().includes(q);

            if (
              !matchesId &&
              !matchesRunId &&
              !matchesEmployer &&
              !matchesPeriod &&
              !matchesAsset &&
              !matchesTx
            ) {
              return false;
            }
          }

          // Period Filter
          if (periodFilter !== "all" && run.payPeriod !== periodFilter) {
            return false;
          }

          // Asset Filter
          if (assetFilter !== "all" && run.asset !== assetFilter) {
            return false;
          }

          // Employer Filter
          if (employerFilter !== "all" && run.employerName !== employerFilter) {
            return false;
          }

          // Status Filter
          if (statusFilter !== "all" && run.status !== statusFilter) {
            return false;
          }

          // Audit Filter
          if (auditFilter !== "all" && run.auditAvailability !== auditFilter) {
            return false;
          }

          return true;
        });
      },

      resetFilters: () =>
        set({
          searchQuery: "",
          periodFilter: "all",
          assetFilter: "all",
          employerFilter: "all",
          statusFilter: "all",
          auditFilter: "all",
        }),

      setRuns: (runs) => set({ runs }),

      reset: () => set(initialState),
    }),
    {
      name: "zk-payroll-archive-store",
    }
  )
);
