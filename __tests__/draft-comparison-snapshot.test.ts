import { describe, expect, it } from "vitest";

import {
  type BatchRow,
  computeBatchDiff,
  summarizeBatchDiff,
} from "@/lib/payroll/batchDiff";
import {
  assertDraftComparison,
  compareDraftRevisions,
  DRAFT_COMPARISON_REFERENCE_NOW,
  DraftComparisonError,
  summarizeDraftComparisonForAudit,
  type DraftRevisionInput,
} from "@/src/payroll/draftComparisonSnapshot";

const NOW = DRAFT_COMPARISON_REFERENCE_NOW;
const RUN_ID = "run-001";

function makeRow(overrides: Partial<BatchRow> = {}): BatchRow {
  return {
    employeeId: "emp_001",
    name: "Alice",
    walletAddress: "GDQP2KQY4W37MZK7H6KJZQWEQB8U9LLTKYM3QZS4W37N2AB5C6D7E8F9G0H1J2K3",
    assetCode: "USDC",
    salaryCommitment: "0xcommit001",
    salaryAmount: 5000,
    ...overrides,
  };
}

function makeRevision(
  overrides: Partial<DraftRevisionInput> = {},
): DraftRevisionInput {
  return {
    revisionId: "rev-2",
    payrollRunId: RUN_ID,
    revisionNumber: 2,
    rows: [makeRow()],
    updatedAt: "2026-01-01T01:00:00.000Z",
    ...overrides,
  };
}

describe("compareDraftRevisions (#677)", () => {
  it("treats a missing approved revision as first approval with all current rows added", () => {
    const current = makeRevision({
      rows: [
        makeRow({ employeeId: "emp_001" }),
        makeRow({
          employeeId: "emp_002",
          name: "Bob",
          salaryCommitment: "0xcommit002",
          salaryAmount: 3000,
        }),
      ],
    });

    const result = compareDraftRevisions({
      payrollRunId: RUN_ID,
      current,
      approved: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { snapshot } = result;
    expect(snapshot.approvedRevisionId).toBe(null);
    expect(snapshot.currentRevisionId).toBe("rev-2");
    expect(snapshot.comparedAt).toBe(NOW);
    expect(snapshot.summary.additions).toBe(2);
    expect(snapshot.summary.removals).toBe(0);
    expect(snapshot.requiresReapproval).toBe(false);
    expect(snapshot.blockedEmployeeIds).toEqual([]);
    expect(snapshot.totals.approvedTotal).toBe(0);
    expect(snapshot.totals.currentTotal).toBe(8000);
    expect(snapshot.totals.delta).toBe(8000);
    expect(snapshot.entries.every((e) => e.changeType === "added")).toBe(true);
  });

  it("reuses computeBatchDiff/summarizeBatchDiff and marks commitment edits as blocked", () => {
    const approved = makeRevision({
      revisionId: "rev-1",
      revisionNumber: 1,
      rows: [makeRow({ employeeId: "emp_001", salaryCommitment: "0xcommitA" })],
    });
    const current = makeRevision({
      revisionId: "rev-2",
      revisionNumber: 2,
      rows: [
        makeRow({
          employeeId: "emp_001",
          salaryCommitment: "0xcommitB",
          salaryAmount: 5500,
        }),
      ],
    });

    const result = compareDraftRevisions({
      payrollRunId: RUN_ID,
      current,
      approved,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { snapshot } = result;
    const expectedEntries = computeBatchDiff(current.rows as BatchRow[], approved.rows as BatchRow[]);
    const expectedSummary = summarizeBatchDiff(expectedEntries);

    expect(snapshot.entries).toEqual(expectedEntries);
    expect(snapshot.summary).toEqual(expectedSummary);
    expect(snapshot.summary.edits).toBe(1);
    expect(snapshot.summary.blocked).toBe(1);
    expect(snapshot.requiresReapproval).toBe(true);
    expect(snapshot.blockedEmployeeIds).toEqual(["emp_001"]);
    expect(snapshot.totals.approvedTotal).toBe(5000);
    expect(snapshot.totals.currentTotal).toBe(5500);
    expect(snapshot.totals.delta).toBe(500);
  });

  it("detects additions, removals, and unchanged rows with correct blocked set", () => {
    const approved = makeRevision({
      revisionId: "rev-1",
      revisionNumber: 1,
      rows: [
        makeRow({ employeeId: "emp_001" }),
        makeRow({ employeeId: "emp_002", salaryCommitment: "0xcommit002" }),
      ],
    });
    const current = makeRevision({
      revisionId: "rev-2",
      revisionNumber: 2,
      rows: [
        makeRow({ employeeId: "emp_001" }), // unchanged
        makeRow({
          employeeId: "emp_003",
          name: "Carol",
          salaryCommitment: "0xcommit003",
          salaryAmount: 4000,
        }), // added
      ],
    });

    const result = compareDraftRevisions({
      payrollRunId: RUN_ID,
      current,
      approved,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { snapshot } = result;
    expect(snapshot.summary.additions).toBe(1);
    expect(snapshot.summary.removals).toBe(1);
    expect(snapshot.summary.unchanged).toBe(1);
    expect(snapshot.blockedEmployeeIds).toEqual(["emp_002"]);
    expect(snapshot.requiresReapproval).toBe(true);
    expect(snapshot.totals.approvedTotal).toBe(10000);
    expect(snapshot.totals.currentTotal).toBe(9000);
    expect(snapshot.totals.delta).toBe(-1000);
  });

  it("returns draft_missing when current is null or undefined", () => {
    const missing = compareDraftRevisions({
      payrollRunId: RUN_ID,
      current: null,
    });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error.code).toBe("draft_missing");
    expect(missing.error.message).toBe(
      "Comparison failed: the current draft revision is missing.",
    );
    expect(missing.error.remediation).toBe(
      "Reload the payroll draft and try the comparison again.",
    );

    const undefinedCurrent = compareDraftRevisions({
      payrollRunId: RUN_ID,
      current: undefined,
    });
    expect(undefinedCurrent.ok).toBe(false);
    if (undefinedCurrent.ok) return;
    expect(undefinedCurrent.error.code).toBe("draft_missing");
  });

  it("returns draft_invalid for malformed rows, mismatch, or bad revision number", () => {
    const badRows = compareDraftRevisions({
      payrollRunId: RUN_ID,
      current: makeRevision({ rows: [{ employeeId: "emp_001" } as BatchRow] }),
    });
    expect(badRows.ok).toBe(false);
    if (badRows.ok) return;
    expect(badRows.error.code).toBe("draft_invalid");

    const wrongRun = compareDraftRevisions({
      payrollRunId: RUN_ID,
      current: makeRevision({ payrollRunId: "run-999" }),
    });
    expect(wrongRun.ok).toBe(false);
    if (wrongRun.ok) return;
    expect(wrongRun.error.code).toBe("draft_invalid");
    expect(wrongRun.error.message).toContain("different payroll run");

    const badRevision = compareDraftRevisions({
      payrollRunId: RUN_ID,
      current: makeRevision({ revisionNumber: 0 }),
    });
    expect(badRevision.ok).toBe(false);
    if (badRevision.ok) return;
    expect(badRevision.error.code).toBe("draft_invalid");
  });

  it("returns draft_stale when expected revision differs or approved is ahead", () => {
    const staleExpected = compareDraftRevisions({
      payrollRunId: RUN_ID,
      current: makeRevision({ revisionNumber: 2 }),
      expectedRevisionNumber: 5,
    });
    expect(staleExpected.ok).toBe(false);
    if (staleExpected.ok) return;
    expect(staleExpected.error.code).toBe("draft_stale");
    expect(staleExpected.error.remediation).toContain("latest revision");

    const approvedAhead = compareDraftRevisions({
      payrollRunId: RUN_ID,
      current: makeRevision({ revisionNumber: 2 }),
      approved: makeRevision({ revisionId: "rev-3", revisionNumber: 3 }),
    });
    expect(approvedAhead.ok).toBe(false);
    if (approvedAhead.ok) return;
    expect(approvedAhead.error.code).toBe("draft_stale");
  });

  it("is deterministic and never leaks sensitive data in audit summary", () => {
    const current = makeRevision();
    const approved = makeRevision({
      revisionId: "rev-1",
      revisionNumber: 1,
      rows: [makeRow({ salaryCommitment: "0xA", salaryAmount: 1000 })],
    });
    const request = {
      payrollRunId: RUN_ID,
      current,
      approved,
      now: "2026-06-01T12:00:00.000Z",
    };

    const first = compareDraftRevisions(request);
    const second = compareDraftRevisions(request);
    expect(first).toEqual(second);

    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.snapshot.comparedAt).toBe("2026-06-01T12:00:00.000Z");
    expect(current.rows).toEqual([makeRow()]);

    const audit = summarizeDraftComparisonForAudit(first.snapshot);
    expect(Object.keys(audit)).not.toContain("entries");
    expect(Object.keys(audit)).not.toContain("blockedEmployeeIds");
    expect(audit.payrollRunId).toBe(RUN_ID);
    expect(audit.currentRevisionId).toBe("rev-2");
    expect(audit.approvedRevisionId).toBe("rev-1");
    expect(audit.requiresReapproval).toBe(true);
    expect(audit.additions).toBe(0);
    expect(audit.removals).toBe(0);
    expect(audit.edits).toBe(1);
    expect(audit.total).toBe(1);
  });
});

describe("assertDraftComparison (#677)", () => {
  it("returns the snapshot when comparison succeeds", () => {
    const snapshot = assertDraftComparison({
      payrollRunId: RUN_ID,
      current: makeRevision(),
    });

    expect(snapshot.currentRevisionId).toBe("rev-2");
    expect(snapshot.requiresReapproval).toBe(false);
  });

  it("throws DraftComparisonError with code and remediation when it fails", () => {
    expect(() =>
      assertDraftComparison({
        payrollRunId: RUN_ID,
        current: null,
      }),
    ).toThrow(DraftComparisonError);

    try {
      assertDraftComparison({
        payrollRunId: RUN_ID,
        current: makeRevision({ payrollRunId: "run-other" }),
      });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(DraftComparisonError);
      const typed = error as DraftComparisonError;
      expect(typed.name).toBe("DraftComparisonError");
      expect(typed.code).toBe("draft_invalid");
      expect(typed.remediation).toBe(
        "Open the correct payroll run and compare its draft.",
      );
      expect(typed.message).toContain("different payroll run");
    }
  });
});
