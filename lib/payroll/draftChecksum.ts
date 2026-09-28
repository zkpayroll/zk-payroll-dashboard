import type { Employee } from "@/types/models";

/**
 * Create a stable digest for the payroll contents shown during review.
 * The serialized employee data is used only as Web Crypto input and is never
 * returned, logged, or persisted by this helper.
 */
export async function createPayrollDraftChecksum(
  employeeIds: string[],
  employees: Employee[],
  totalAmount: number,
): Promise<string> {
  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    throw new Error("Payroll draft could not be validated. Review the draft before continuing.");
  }

  const selected = new Set(employeeIds);
  const rows = employees
    .filter((employee) => selected.has(employee.id))
    .map((employee) => ({
      id: employee.id,
      address: employee.address,
      salaryCommitment: employee.salaryCommitment,
      active: employee.isActive,
      status: employee.status ?? null,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  if (rows.length !== selected.size || rows.some((row) => !row.address || !row.salaryCommitment)) {
    throw new Error("One or more payroll records are unavailable. Refresh the draft before continuing.");
  }

  const payload = JSON.stringify({
    version: 1,
    selectedEmployeeIds: [...employeeIds].sort(),
    rows,
    totalAmount,
    assetCode: "USDC",
  });
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(payload),
  );

  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

/** No reviewed digest (or a changed digest) must be treated as a mismatch. */
export function matchesReviewedPayrollDraft(
  reviewedChecksum: string | null | undefined,
  currentChecksum: string,
): boolean {
  return Boolean(reviewedChecksum) && reviewedChecksum === currentChecksum;
}
