import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  EmployeeImportRecord,
  DuplicateCluster,
  DuplicateResolution,
  ImportSession,
  EmployeeImportStore,
} from "@/types/import";

// ─── Hash helper (same algorithm as observability/redaction.ts) ────────────

const DEFAULT_SALT = "zk_payroll_import_salt_v1_2026";

export function hashEmployeeRef(employeeId: string): string {
  if (!employeeId) return "emp_ref_none";
  const str = `${DEFAULT_SALT}:${employeeId}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 16777619);
    h2 ^= code;
    h2 = Math.imul(h2, 310031007);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `emp_ref_${part1}${part2}`;
}

// ─── Redaction helper ──────────────────────────────────────────────────────

const SENSITIVE_FIELDS = ["name", "email", "salary", "ssn", "address"];

export function redactRecord(record: EmployeeImportRecord) {
  return {
    refHash: hashEmployeeRef(record.rowId),
    department: record.department,
    hireDate: record.hireDate,
    differingFields: [] as string[],
  };
}

/**
 * Compute which fields differ between a primary record and a comparison record.
 */
export function computeDifferingFields(
  primary: EmployeeImportRecord,
  comparison: EmployeeImportRecord
): string[] {
  const fields: string[] = [];
  const compareKeys = ["name", "email", "department", "salary", "hireDate", "employeeId"] as const;
  for (const key of compareKeys) {
    if (primary[key] !== comparison[key]) {
      fields.push(key);
    }
  }
  return fields;
}

// ─── Initial session state ────────────────────────────────────────────────

const initialSession: ImportSession = {
  status: "idle",
  records: [],
  duplicateClusters: [],
  uniqueCount: 0,
  unresolvedCriticalCount: 0,
  canFinalize: false,
};

// ─── Store ─────────────────────────────────────────────────────────────────

export const useEmployeeImportStore = create<EmployeeImportStore>()(
  persist(
    (set, get) => ({
      session: { ...initialSession },

      startImport: (records: EmployeeImportRecord[]) => {
        set({
          session: {
            ...initialSession,
            status: "parsing",
            records,
          },
        });
      },

      setDuplicateClusters: (clusters: DuplicateCluster[]) => {
        const unresolvedCritical = clusters.filter(
          (c) => c.blocksImport && c.resolution === null
        );
        const recordCount = get().session.records.length;
        const duplicateRecordIds = new Set(
          clusters.flatMap((c) => c.records.map((r) => r.rowId))
        );

        set({
          session: {
            ...get().session,
            status: clusters.length > 0 ? "review_duplicates" : "ready",
            duplicateClusters: clusters,
            uniqueCount: recordCount - duplicateRecordIds.size + clusters.length,
            unresolvedCriticalCount: unresolvedCritical.length,
            canFinalize: unresolvedCritical.length === 0,
          },
        });
      },

      resolveCluster: (
        clusterId: string,
        resolution: DuplicateResolution,
        notes?: string
      ) => {
        const session = get().session;
        const updatedClusters = session.duplicateClusters.map((c) => {
          if (c.id !== clusterId) return c;
          return {
            ...c,
            resolution,
            reviewNotes: notes,
          };
        });

        const unresolvedCritical = updatedClusters.filter(
          (c) => c.blocksImport && c.resolution === null
        );

        set({
          session: {
            ...session,
            duplicateClusters: updatedClusters,
            unresolvedCriticalCount: unresolvedCritical.length,
            canFinalize: unresolvedCritical.length === 0,
            status: unresolvedCritical.length === 0 ? "ready" : "review_duplicates",
          },
        });
      },

      isImportBlocked: () => {
        return get().session.unresolvedCriticalCount > 0;
      },

      finalizeImport: () => {
        const { session } = get();
        if (!session.canFinalize) return false;

        set({
          session: {
            ...session,
            status: "importing",
          },
        });

        // In a real implementation, this would trigger the actual import API call.
        // For now, we mark it as completed.
        set({
          session: {
            ...get().session,
            status: "completed",
          },
        });

        return true;
      },

      resetImport: () => {
        set({ session: { ...initialSession } });
      },
    }),
    { name: "zk-payroll-employee-import" }
  )
);

// ─── Sensitive field check ─────────────────────────────────────────────────

export function isSensitiveImportField(field: string): boolean {
  return SENSITIVE_FIELDS.includes(field.toLowerCase());
}

export { SENSITIVE_FIELDS };
