import { describe, expect, it } from "vitest";

import {
  assertNoDuplicatePayout,
  DEFAULT_DUPLICATE_PAYOUT_POLICY,
  detectDuplicatePayout,
  DuplicatePayoutError,
  isDuplicatePayout,
  type CandidatePayout,
  type PayoutHistoryEntry,
} from "@/src/payroll/duplicatePayoutDetection";
import type { PaymentInstruction } from "@/types/models";

const PERIOD = "2026-10";

function makeInstruction(
  overrides: Partial<PaymentInstruction> = {},
): PaymentInstruction {
  return {
    id: "INS-1001",
    employeeId: "emp_001",
    recipientAddress: "GDQP2KQY4W37MZK7H6KJZQWEQB8U9LLTKYM3QZS4W37N2AB5C6D7E8F9G0H1J2K3",
    amount: 2500,
    asset: "USDC",
    ...overrides,
  };
}

function makeHistoryEntry(
  overrides: Partial<PayoutHistoryEntry> = {},
): PayoutHistoryEntry {
  return {
    runId: "run-001",
    status: "verified",
    periodKey: PERIOD,
    ...overrides,
  };
}

function makeCandidate(
  overrides: Partial<CandidatePayout> = {},
): CandidatePayout {
  return {
    runId: "run-002",
    periodKey: PERIOD,
    instructions: [makeInstruction()],
    ...overrides,
  };
}

describe("detectDuplicatePayout (#682)", () => {
  it("allows a fresh batch with no overlapping history", () => {
    const candidate = makeCandidate({
      instructions: [
        makeInstruction({ id: "INS-2001", employeeId: "emp_901" }),
        makeInstruction({
          id: "INS-2002",
          employeeId: "emp_902",
          recipientAddress:
            "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
        }),
      ],
    });
    const history = [
      makeHistoryEntry({
        instructionIds: ["INS-1000"],
        employeeIds: ["emp_777"],
      }),
    ];

    const report = detectDuplicatePayout(candidate, history);

    expect(report.isDuplicate).toBe(false);
    expect(report.canSend).toBe(true);
    expect(report.findings).toHaveLength(0);
    expect(report.summary).toBe(
      "No duplicate payouts detected. This batch is safe to send.",
    );
  });

  it("blocks when an instruction id was already executed by an active payout", () => {
    const candidate = makeCandidate();
    const history = [
      makeHistoryEntry({ runId: "run-001", instructionIds: ["INS-1001"] }),
    ];

    const report = detectDuplicatePayout(candidate, history);

    expect(report.isDuplicate).toBe(true);
    expect(report.canSend).toBe(false);
    // History-derived collision + the #633 engine's merged collision group.
    expect(
      report.blockers.some((f) => f.kind === "instruction_id_collision"),
    ).toBe(true);
    expect(report.blockers.some((f) => f.kind === "batch_duplicate")).toBe(true);
    const collision = report.blockers.find(
      (f) => f.kind === "instruction_id_collision",
    );
    expect(collision?.relatedRunIds).toEqual(["run-001"]);
    expect(report.summary).toContain("blocker");
  });

  it("blocks when the batch reference is already recorded on an active payout", () => {
    const candidate = makeCandidate({
      batchReference: "BATCH-2026-10-A",
      instructions: [makeInstruction({ reference: "BATCH-2026-10-A" })],
    });
    const history = [
      makeHistoryEntry({ runId: "run-001", batchReference: "batch-2026-10-a" }),
    ];

    const report = detectDuplicatePayout(candidate, history);

    expect(report.canSend).toBe(false);
    const referenceFinding = report.findings.find(
      (f) => f.kind === "reference_collision",
    );
    expect(referenceFinding).toBeDefined();
    expect(referenceFinding?.severity).toBe("blocker");
    expect(referenceFinding?.relatedRunIds).toEqual(["run-001"]);
  });

  it("reports an identical recipient set in the same period as an identical batch", () => {
    const candidate = makeCandidate({
      instructions: [
        makeInstruction({ id: "INS-3001", employeeId: "emp_001" }),
        makeInstruction({ id: "INS-3002", employeeId: "emp_002" }),
      ],
    });
    const history = [
      makeHistoryEntry({
        runId: "run-001",
        employeeIds: ["emp_002", "emp_001"],
      }),
    ];

    const report = detectDuplicatePayout(candidate, history);

    expect(report.canSend).toBe(false);
    const identical = report.findings.find((f) => f.kind === "identical_batch");
    expect(identical).toBeDefined();
    expect(identical?.severity).toBe("blocker");
    expect(identical?.message).toContain("2 recipient(s)");
    expect(identical?.message).toContain(PERIOD);
  });

  it("flags partial recipient overlap as a blocker by default and a warning when policy downgrades it", () => {
    const candidate = makeCandidate({
      instructions: [
        makeInstruction({ id: "INS-4001", employeeId: "emp_001" }),
        makeInstruction({ id: "INS-4002", employeeId: "emp_002" }),
      ],
    });
    const history = [
      makeHistoryEntry({ runId: "run-001", employeeIds: ["emp_001"] }),
    ];

    const blocked = detectDuplicatePayout(candidate, history);
    expect(blocked.canSend).toBe(false);
    expect(
      blocked.findings.some(
        (f) => f.kind === "recipient_overlap" && f.severity === "blocker",
      ),
    ).toBe(true);

    const warned = detectDuplicatePayout(candidate, history, {
      ...DEFAULT_DUPLICATE_PAYOUT_POLICY,
      blockOnRecipientOverlap: false,
    });
    expect(warned.canSend).toBe(true);
    expect(warned.isDuplicate).toBe(true);
    expect(warned.warnings.some((f) => f.kind === "recipient_overlap")).toBe(
      true,
    );
    expect(warned.summary).toContain("warning");
  });

  it("does not treat recipient overlap in a different period as a duplicate", () => {
    const candidate = makeCandidate({ periodKey: "2026-11" });
    const history = [
      makeHistoryEntry({
        runId: "run-001",
        periodKey: "2026-10",
        employeeIds: ["emp_001"],
        instructionIds: ["INS-9999"],
      }),
    ];

    const report = detectDuplicatePayout(candidate, history);

    expect(report.findings.some((f) => f.kind === "recipient_overlap")).toBe(
      false,
    );
    expect(report.canSend).toBe(true);
  });

  it("does not block a retry when the prior payout failed and policy allows retry", () => {
    const candidate = makeCandidate();
    const history = [
      makeHistoryEntry({
        runId: "run-001",
        status: "failed",
        instructionIds: ["INS-1001"],
        employeeIds: ["emp_001"],
      }),
    ];

    const report = detectDuplicatePayout(candidate, history);

    expect(report.isDuplicate).toBe(false);
    expect(report.canSend).toBe(true);

    const strict = detectDuplicatePayout(candidate, history, {
      ...DEFAULT_DUPLICATE_PAYOUT_POLICY,
      allowRetryAfterFailure: false,
    });
    expect(strict.canSend).toBe(false);
  });

  it("treats queued/pending payouts as already sent under the default policy", () => {
    const candidate = makeCandidate();
    const history = [
      makeHistoryEntry({
        runId: "run-001",
        status: "pending",
        instructionIds: ["INS-1001"],
      }),
    ];

    const report = detectDuplicatePayout(candidate, history);

    expect(report.canSend).toBe(false);
    expect(report.blockers.some((f) => f.kind === "instruction_id_collision")).toBe(
      true,
    );
  });

  it("merges intra-batch duplicates from the #633 engine into the report", () => {
    const duplicateInstruction = makeInstruction({
      id: "INS-5001",
      employeeId: "emp_001",
    });
    const candidate = makeCandidate({
      instructions: [
        duplicateInstruction,
        makeInstruction({
          id: "INS-5002",
          employeeId: "emp_001",
          recipientAddress: duplicateInstruction.recipientAddress,
        }),
      ],
    });

    const report = detectDuplicatePayout(candidate, []);

    expect(report.canSend).toBe(false);
    const intraBatch = report.findings.filter((f) => f.kind === "batch_duplicate");
    expect(intraBatch.length).toBeGreaterThan(0);
    expect(intraBatch.some((f) => f.severity === "blocker")).toBe(true);
  });

  it("is pure: repeated calls return equal reports and do not mutate inputs", () => {
    const candidate = makeCandidate();
    const history = [
      makeHistoryEntry({ instructionIds: ["INS-1001"] }),
    ];
    const candidateSnapshot = JSON.parse(JSON.stringify(candidate));
    const historySnapshot = JSON.parse(JSON.stringify(history));

    const first = detectDuplicatePayout(candidate, history);
    const second = detectDuplicatePayout(candidate, history);

    expect(first).toEqual(second);
    expect(candidate).toEqual(candidateSnapshot);
    expect(history).toEqual(historySnapshot);
  });

  it("findings never leak raw salary amounts and mask long addresses", () => {
    const longAddress =
      "GDQP2KQY4W37MZK7H6KJZQWEQB8U9LLTKYM3QZS4W37N2AB5C6D7E8F9G0H1J2K3";
    const candidate = makeCandidate({
      batchReference: longAddress,
      instructions: [makeInstruction({ reference: longAddress })],
    });
    const history = [
      makeHistoryEntry({ runId: "run-001", batchReference: longAddress }),
    ];

    const report = detectDuplicatePayout(candidate, history);

    for (const finding of report.findings) {
      expect(finding.message).not.toMatch(/2,?500|\$2/);
    }
    const referenceFinding = report.findings.find(
      (f) => f.kind === "reference_collision",
    );
    expect(referenceFinding).toBeDefined();
    // The privacy-safe identifying value is masked, never the raw address.
    expect(referenceFinding?.value).not.toBe(longAddress);
    expect(referenceFinding?.value).toContain("…");
  });
});

describe("isDuplicatePayout (#682)", () => {
  it("returns true when a duplicate signal exists and false otherwise", () => {
    const duplicateCandidate = makeCandidate();
    const duplicateHistory = [
      makeHistoryEntry({ instructionIds: ["INS-1001"] }),
    ];
    expect(isDuplicatePayout(duplicateCandidate, duplicateHistory)).toBe(true);

    const freshCandidate = makeCandidate({
      instructions: [makeInstruction({ id: "INS-7777" })],
    });
    expect(isDuplicatePayout(freshCandidate, [])).toBe(false);
  });
});

describe("assertNoDuplicatePayout (#682)", () => {
  it("returns the report when the batch is safe to send", () => {
    const candidate = makeCandidate({
      instructions: [makeInstruction({ id: "INS-8888" })],
    });

    const report = assertNoDuplicatePayout(candidate, []);

    expect(report.canSend).toBe(true);
  });

  it("throws DuplicatePayoutError carrying the report when blocked", () => {
    const candidate = makeCandidate();
    const history = [
      makeHistoryEntry({ runId: "run-001", instructionIds: ["INS-1001"] }),
    ];

    expect(() => assertNoDuplicatePayout(candidate, history)).toThrow(
      DuplicatePayoutError,
    );

    try {
      assertNoDuplicatePayout(candidate, history);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(DuplicatePayoutError);
      const typed = error as DuplicatePayoutError;
      expect(typed.name).toBe("DuplicatePayoutError");
      expect(typed.report.canSend).toBe(false);
      expect(typed.message).toContain("blocker");
    }
  });

  it("does not throw for warning-only reports (policy downgrade)", () => {
    const candidate = makeCandidate({
      instructions: [
        makeInstruction({ id: "INS-4001", employeeId: "emp_001" }),
        makeInstruction({ id: "INS-4002", employeeId: "emp_002" }),
      ],
    });
    const history = [
      makeHistoryEntry({ runId: "run-001", employeeIds: ["emp_001"] }),
    ];

    const report = assertNoDuplicatePayout(candidate, history, {
      ...DEFAULT_DUPLICATE_PAYOUT_POLICY,
      blockOnRecipientOverlap: false,
    });

    expect(
      report.warnings.some((f) => f.kind === "recipient_overlap"),
    ).toBe(true);
    expect(report.canSend).toBe(true);
  });
});
