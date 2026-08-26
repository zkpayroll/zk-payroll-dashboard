import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  applyBatchDiffFilter,
  computeBatchDiff,
  formatBatchAmount,
  summarizeBatchDiff,
  REDACTED_PLACEHOLDER,
  type BatchRow,
} from "@/lib/payroll/batchDiff";
import { BATCH_DIFF_FIXTURES, getBatchDiffFixture } from "@/lib/payroll/batchDiffFixtures";
import BatchDiffView from "@/components/features/batches/BatchDiffView";

const WALLET_A = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const WALLET_B = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

function row(overrides: Partial<BatchRow> = {}): BatchRow {
  return {
    employeeId: "emp_001",
    name: "Alice",
    walletAddress: WALLET_A,
    assetCode: "USDC",
    salaryCommitment: "0xcommit_a",
    salaryAmount: 1000,
    ...overrides,
  };
}

describe("computeBatchDiff", () => {
  it("detects additions", () => {
    const diff = computeBatchDiff(
      [row(), row({ employeeId: "emp_002" })],
      [row()],
    );

    expect(diff).toHaveLength(2);
    const added = diff.find((e) => e.employeeId === "emp_002");
    expect(added?.changeType).toBe("added");
    expect(added?.changedFields).toContain("walletAddress");
    expect(added?.isBlocked).toBe(false);
  });

  it("detects removals of previously approved recipients as blocked", () => {
    const diff = computeBatchDiff([row()], [row(), row({ employeeId: "emp_003" })]);

    const removed = diff.find((e) => e.employeeId === "emp_003");
    expect(removed?.changeType).toBe("removed");
    expect(removed?.isBlocked).toBe(true);
  });

  it("detects wallet changes without blocking approval", () => {
    const diff = computeBatchDiff(
      [row({ walletAddress: WALLET_B })],
      [row({ walletAddress: WALLET_A })],
    );

    const entry = diff[0];
    expect(entry.changeType).toBe("edited");
    expect(entry.changedFields).toEqual(["walletAddress"]);
    expect(entry.isBlocked).toBe(false);
  });

  it("detects asset changes and commitment changes separately", () => {
    const diff = computeBatchDiff(
      [row({ employeeId: "emp_001", assetCode: "EURC" }), row({ employeeId: "emp_002", salaryCommitment: "0xrotated" })],
      [row({ employeeId: "emp_001" }), row({ employeeId: "emp_002" })],
    );

    const assetChange = diff.find((e) => e.employeeId === "emp_001");
    expect(assetChange?.changedFields).toEqual(["assetCode"]);

    // A rotated commitment invalidates the prior approval.
    const commitmentChange = diff.find((e) => e.employeeId === "emp_002");
    expect(commitmentChange?.changedFields).toEqual(["salaryCommitment"]);
    expect(commitmentChange?.isBlocked).toBe(true);
  });

  it("marks identical rows unchanged", () => {
    const diff = computeBatchDiff([row()], [row()]);
    expect(diff[0]?.changeType).toBe("unchanged");
    expect(diff[0]?.changedFields).toHaveLength(0);
  });
});

describe("summarizeBatchDiff / filters / redaction helpers", () => {
  const entries = computeBatchDiff(
    [
      row(),
      row({ employeeId: "emp_002" }),
      row({ employeeId: "emp_004", name: "Kofi", salaryCommitment: "0xrotated" }),
    ],
    [
      row(),
      row({ employeeId: "emp_003", name: "Ama" }),
      row({ employeeId: "emp_004", name: "Kofi" }),
    ],
  );

  it("summarizes additions, removals, edits, unchanged, and blocked counts", () => {
    const summary = summarizeBatchDiff(entries);
    expect(summary.additions).toBe(1);
    expect(summary.removals).toBe(1);
    expect(summary.edits).toBe(1);
    expect(summary.unchanged).toBe(1);
    expect(summary.blocked).toBe(2);
    expect(summary.total).toBe(4);
  });

  it("filters changed, unchanged, and blocked rows", () => {
    expect(applyBatchDiffFilter(entries, "changed")).toHaveLength(3);
    expect(applyBatchDiffFilter(entries, "unchanged")).toHaveLength(1);
    expect(applyBatchDiffFilter(entries, "blocked")).toHaveLength(2);
    expect(applyBatchDiffFilter(entries, "all")).toHaveLength(4);
  });

  it("redacts private amounts unless explicitly allowed", () => {
    expect(formatBatchAmount(1234, false)).toBe(REDACTED_PLACEHOLDER);
    expect(formatBatchAmount(1234, true)).toBe("$1,234");
    expect(formatBatchAmount(undefined, true)).toBe("—");
  });

  it("provides fixtures for the common diff cases including empty and large diffs", () => {
    const keys = BATCH_DIFF_FIXTURES.map((f) => f.key);
    expect(keys).toContain("empty");
    expect(keys).toContain("additions");
    expect(keys).toContain("removals");
    expect(keys).toContain("wallet-change");

    const large = getBatchDiffFixture("large");
    expect(large.currentRows.length).toBeGreaterThan(200);

    const empty = getBatchDiffFixture("empty");
    const emptySummary = summarizeBatchDiff(
      computeBatchDiff(empty.currentRows, empty.approvedRows),
    );
    expect(emptySummary.additions + emptySummary.removals + emptySummary.edits).toBe(0);
    // Every key resolves through the getter.
    for (const fixture of BATCH_DIFF_FIXTURES) {
      expect(getBatchDiffFixture(fixture.key).key).toBe(fixture.key);
    }
  });
});

describe("BatchDiffView component", () => {
  const approvedRows = [
    row(),
    row({ employeeId: "emp_003", name: "Kofi", walletAddress: WALLET_B }),
  ];
  const currentRows = [
    row({ salaryAmount: 1200 }),
    row({ employeeId: "emp_002", name: "Ama", salaryAmount: 900 }),
  ];

  it("redacts private amounts by default and reveals only after explicit action", () => {
    render(<BatchDiffView currentRows={currentRows} approvedRows={approvedRows} />);

    expect(screen.getAllByText(REDACTED_PLACEHOLDER).length).toBeGreaterThan(0);
    expect(screen.queryByText("$1,200")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("toggle-private-values"));
    expect(screen.getByText("$1,200")).toBeInTheDocument();
    expect(screen.getByText("$900")).toBeInTheDocument();
  });

  it("shows summary counts for additions, removals, edits, and blocked rows", () => {
    render(<BatchDiffView currentRows={currentRows} approvedRows={approvedRows} />);

    expect(screen.getByTestId("diff-summary-additions")).toHaveTextContent("1 added");
    expect(screen.getByTestId("diff-summary-removals")).toHaveTextContent("1 removed");
    expect(screen.getByTestId("diff-summary-edits")).toHaveTextContent("1 edited");
    expect(screen.getByTestId("diff-summary-blocked")).toHaveTextContent("1 blocked");
  });

  it("filters rows by changed, unchanged, and blocked tabs", () => {
    render(<BatchDiffView currentRows={currentRows} approvedRows={approvedRows} />);

    fireEvent.click(screen.getByRole("tab", { name: "Changed" }));
    expect(screen.getAllByTestId("diff-row")).toHaveLength(3);

    fireEvent.click(screen.getByRole("tab", { name: "Blocked" }));
    const blockedRows = screen.getAllByTestId("diff-row");
    expect(blockedRows).toHaveLength(1);
    expect(blockedRows[0]).toHaveTextContent(/Needs re-approval/);

    fireEvent.click(screen.getByRole("tab", { name: "Unchanged" }));
    expect(screen.queryByTestId("diff-row")).not.toBeInTheDocument();
    expect(screen.getByText(/No changes since last approval/i)).toBeInTheDocument();
  });

  it("renders an empty state when both drafts are empty", () => {
    render(<BatchDiffView currentRows={[]} approvedRows={[]} />);

    expect(screen.getByText(/Empty batch/i)).toBeInTheDocument();
    expect(screen.queryByTestId("diff-row")).not.toBeInTheDocument();
  });

  it("handles large diffs inside a scroll region", () => {
    const large = getBatchDiffFixture("large");
    render(<BatchDiffView currentRows={large.currentRows} approvedRows={large.approvedRows} />);

    expect(screen.getByTestId("diff-scroll-region")).toBeInTheDocument();
    expect(screen.getByTestId("diff-summary-additions")).toHaveTextContent("190 added");
    expect(screen.getByTestId("diff-summary-removals")).toHaveTextContent("40 removed");
    expect(screen.getAllByTestId("diff-row").length).toBeGreaterThan(200);
  });

  it("shows before/after values for edited wallets", () => {
    render(
      <BatchDiffView
        currentRows={[row({ walletAddress: WALLET_B })]}
        approvedRows={[row()]}
      />,
    );

    const rowEl = screen.getByTestId("diff-row");
    expect(within(rowEl).getByText(/^GAAZI4/)).toBeInTheDocument();
    expect(within(rowEl).getByText(/^GDQP2K/)).toBeInTheDocument();
  });
});
