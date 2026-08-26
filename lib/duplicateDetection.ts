import type { Employee } from "@/types/models";

/**
 * Duplicate employee-id / wallet-address detection for payroll draft input
 * (issue #366).
 *
 * Kept as a pure function so the grouping rules are testable without
 * rendering the warning panel, and so the same predicate can back any other
 * screen that assembles a payroll draft from an employee list.
 */

export type DuplicateWarningKind = "id" | "address";

export interface DuplicateWarningGroup {
  kind: DuplicateWarningKind;
  /** The id or address value that repeats. */
  value: string;
  /** The draft rows sharing that value, in the order they appear in the input. */
  employees: Employee[];
}

/**
 * Groups employees that share the same `id` or the same `address` (wallet).
 *
 * A shared `id` almost always means the same row was added to the draft
 * twice (e.g. a bulk-select or CSV-merge bug). A shared `address` across
 * *different* employee ids is a distinct, more serious case — it means two
 * employee records would be paid to the same wallet, which is worth
 * flagging even though the ids themselves are unique.
 */
export function findDuplicateEmployeeWarnings(
  employees: Employee[],
): DuplicateWarningGroup[] {
  const groups: DuplicateWarningGroup[] = [];

  const byId = groupBy(employees, (e) => e.id);
  Array.from(byId.entries()).forEach(([id, rows]) => {
    if (rows.length > 1) {
      groups.push({ kind: "id", value: id, employees: rows });
    }
  });

  const byAddress = groupBy(employees, (e) => e.address);
  Array.from(byAddress.entries()).forEach(([address, rows]) => {
    // Only flag as an address duplicate when the underlying employee ids
    // differ — two rows that already matched on id are reported once, as
    // an id duplicate, not twice.
    const distinctIds = new Set(rows.map((r: Employee) => r.id));
    if (rows.length > 1 && distinctIds.size > 1) {
      groups.push({ kind: "address", value: address, employees: rows });
    }
  });

  return groups;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue; // blank/missing values aren't meaningful duplicates
    const existing = map.get(k);
    if (existing) {
      existing.push(item);
    } else {
      map.set(k, [item]);
    }
  }
  return map;
}
