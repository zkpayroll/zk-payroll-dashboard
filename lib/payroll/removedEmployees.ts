/**
 * Utilities and types for tracking employees removed from draft payrolls (#376).
 *
 * Removals at the draft stage are non-destructive and can be undone before
 * payroll lock. To preserve zero-knowledge privacy, raw salary amounts are
 * never stored or displayed in the removed employee review state.
 */

export interface RemovedEmployeeRecord {
  id: string;
  name: string;
  department?: string;
  walletAddress: string;
  salaryCommitment?: string;
  removedAt: string;
  removalReason?: string;
  draftStage: true;
}

export const MOCK_DRAFT_REMOVED_EMPLOYEES: RemovedEmployeeRecord[] = [
  {
    id: "emp-rem-1",
    name: "Alex Morgan",
    department: "Marketing",
    walletAddress: "GBVFX7N6PQK42H3L6Q2A4L7H3P4Q5R6S7T8U9V0W",
    salaryCommitment: "0x8fae32bc5694a10d9e223bf091234acfe7659102",
    removedAt: "2026-08-27T09:15:00Z",
    removalReason: "Unpaid leave during current cycle",
    draftStage: true,
  },
  {
    id: "emp-rem-2",
    name: "Elena Rostova",
    department: "Engineering",
    walletAddress: "GC7YTR5PQ2L9K4M8N3A6B1C2D3E4F5G6H7I8J9K0",
    salaryCommitment: "0x3f1c84be91027d54aa1902837bcde20948571629",
    removedAt: "2026-08-27T10:05:00Z",
    removalReason: "Pending contractor agreement renewal",
    draftStage: true,
  },
];

let draftRemovedStore: RemovedEmployeeRecord[] = [...MOCK_DRAFT_REMOVED_EMPLOYEES];

export function getDraftRemovedEmployees(): RemovedEmployeeRecord[] {
  return [...draftRemovedStore];
}

export function addDraftRemovedEmployee(record: Omit<RemovedEmployeeRecord, "draftStage">): void {
  const existing = draftRemovedStore.find((r) => r.id === record.id);
  if (!existing) {
    draftRemovedStore.push({
      ...record,
      draftStage: true,
    });
  }
}

export function restoreDraftRemovedEmployee(employeeId: string): RemovedEmployeeRecord | undefined {
  const idx = draftRemovedStore.findIndex((r) => r.id === employeeId);
  if (idx !== -1) {
    const [restored] = draftRemovedStore.splice(idx, 1);
    return restored;
  }
  return undefined;
}

export function resetDraftRemovedEmployees(): void {
  draftRemovedStore = [...MOCK_DRAFT_REMOVED_EMPLOYEES];
}

export function clearDraftRemovedEmployees(): void {
  draftRemovedStore = [];
}

export function formatShortWallet(address: string): string {
  if (!address || address.length <= 12) return address || "—";
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}
