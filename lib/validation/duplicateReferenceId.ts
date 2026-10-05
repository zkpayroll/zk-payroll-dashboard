/**
 * Duplicate employee reference-id detection for onboarding input (issue #431).
 *
 * Kept as a pure function so the grouping rules are testable without a DOM,
 * and so every onboarding surface — the CSV import today, a form tomorrow —
 * shares one definition of "the same reference id appears twice".
 *
 * Reference ids are compared exactly, after trimming. They are identifiers,
 * not display strings: folding case would flag two legitimately distinct ids
 * that differ only in case, which is a worse failure than missing a duplicate
 * the source system would have rejected anyway.
 *
 * Nothing here reads salary, commitment or any other payroll value — the
 * inputs are a row index and an opaque reference id, which is all the warning
 * needs to point a user at the rows to fix.
 */

/** One duplicated reference id and the rows that carry it. */
export interface ReferenceIdOccurrence {
  /** The duplicated reference id, as it appeared once trimmed. */
  referenceId: string;
  /** Row indexes carrying it, ascending, in input order. */
  rowIndexes: number[];
}

/** The slice of an onboarding row this check needs. */
export interface ReferenceIdRow {
  rowIndex: number;
  referenceId?: string | null;
}

/**
 * Groups rows whose reference id repeats, in first-seen order.
 *
 * Blank and missing reference ids are ignored: they are not duplicates of
 * anything, and an optional column absent from a file must not produce a
 * warning. Returns `[]` when every reference id is distinct.
 */
export function findDuplicateReferenceIds(
  rows: readonly ReferenceIdRow[],
): ReferenceIdOccurrence[] {
  const byReferenceId = new Map<string, number[]>();

  for (const row of rows) {
    const referenceId = row.referenceId?.trim();
    if (!referenceId) continue;

    const seen = byReferenceId.get(referenceId);
    if (seen) {
      seen.push(row.rowIndex);
    } else {
      byReferenceId.set(referenceId, [row.rowIndex]);
    }
  }

  const duplicates: ReferenceIdOccurrence[] = [];
  byReferenceId.forEach((rowIndexes, referenceId) => {
    if (rowIndexes.length > 1) {
      duplicates.push({ referenceId, rowIndexes: [...rowIndexes] });
    }
  });

  return duplicates;
}
