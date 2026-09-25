import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  MOCK_SNAPSHOTS,
  validateSnapshotLockReadiness,
  getSnapshotSafeDiff,
} from "@/lib/sdk/snapshots";
import {
  SNAPSHOT_PRIVACY_NOTICE,
  buildSnapshotPrivacySummary,
  containsRawSalaryLeak,
} from "@/lib/privacy/snapshots";
import SnapshotList from "@/src/components/snapshots/SnapshotList";
import SnapshotDiff from "@/src/components/snapshots/SnapshotDiff";
import SnapshotDetail from "@/src/components/snapshots/SnapshotDetail";
import SnapshotLockApproval from "@/src/components/snapshots/SnapshotLockApproval";

const validSnapshot = MOCK_SNAPSHOTS.find((s) => s.id === "snap_valid_001")!;
const staleSnapshot = MOCK_SNAPSHOTS.find((s) => s.id === "snap_stale_001")!;
const blockedSnapshot = MOCK_SNAPSHOTS.find((s) => s.id === "snap_blocked_001")!;
const failedSnapshot = MOCK_SNAPSHOTS.find((s) => s.id === "snap_failed_001")!;
const lockedSnapshot = MOCK_SNAPSHOTS.find((s) => s.id === "snap_locked_001")!;

describe("validateSnapshotLockReadiness — SDK blocking logic", () => {
  it("allows lock approval for a valid pending snapshot", () => {
    const v = validateSnapshotLockReadiness(validSnapshot);
    expect(v.canApproveLock).toBe(true);
    expect(v.isStale).toBe(false);
    expect(v.isDiffValid).toBe(true);
    expect(v.hasBlockedRows).toBe(false);
    expect(v.isBlocked).toBe(false);
  });

  it("blocks lock approval for a stale snapshot", () => {
    const v = validateSnapshotLockReadiness(staleSnapshot);
    expect(v.canApproveLock).toBe(false);
    expect(v.isStale).toBe(true);
    expect(v.isBlocked).toBe(true);
    expect(v.blockedReason).toMatch(/stale/i);
  });

  it("blocks lock approval when diff has blocked rows", () => {
    const v = validateSnapshotLockReadiness(blockedSnapshot);
    expect(v.canApproveLock).toBe(false);
    expect(v.hasBlockedRows).toBe(true);
    expect(v.isBlocked).toBe(true);
  });

  it("blocks lock approval when diff validation fails", () => {
    const v = validateSnapshotLockReadiness(failedSnapshot);
    expect(v.canApproveLock).toBe(false);
    expect(v.isDiffValid).toBe(false);
    expect(v.isBlocked).toBe(true);
  });

  it("does not allow re-locking an already locked snapshot", () => {
    const v = validateSnapshotLockReadiness(lockedSnapshot);
    expect(v.canApproveLock).toBe(false);
    expect(v.nextSteps).toMatch(/already locked/i);
  });
});

describe("getSnapshotSafeDiff — safe metadata diff", () => {
  it("exposes snapshot version, period, employee count, merkle root", () => {
    const diff = getSnapshotSafeDiff(validSnapshot);
    const labels = diff.fields.map((f) => f.label);
    expect(labels).toContain("Snapshot version");
    expect(labels).toContain("Payroll period");
    expect(labels).toContain("Employee count");
    expect(labels).toContain("Merkle root");
  });

  it("never exposes raw salary values in diff JSON", () => {
    const diff = getSnapshotSafeDiff(validSnapshot);
    const text = JSON.stringify(diff);
    expect(text).not.toMatch(/3500|2800|3200|15000/);
  });
});

describe("privacy helpers", () => {
  it("buildSnapshotPrivacySummary contains safe fields and privacy notice", () => {
    const summary = buildSnapshotPrivacySummary(validSnapshot);
    expect(summary).toContain("Period: 2025-03");
    expect(summary).toContain(SNAPSHOT_PRIVACY_NOTICE);
    expect(summary).not.toMatch(/3500/);
  });

  it("containsRawSalaryLeak detects leaked salary amounts", () => {
    expect(containsRawSalaryLeak("Employee paid 3500 USDC", [3500])).toBe(true);
    expect(containsRawSalaryLeak("Merkle root hash only", [3500])).toBe(false);
  });
});

describe("SnapshotList component", () => {
  it("shows loading state", () => {
    render(<SnapshotList initialState="loading" />);
    expect(screen.getByTestId("snapshot-list-loading")).toBeInTheDocument();
  });

  it("shows empty state with privacy notice", () => {
    render(<SnapshotList snapshots={[]} />);
    expect(screen.getByTestId("snapshot-list-empty")).toBeInTheDocument();
    expect(screen.getByText(/No obligation snapshots/i)).toBeInTheDocument();
  });

  it("renders snapshot cards without raw salary values", () => {
    render(<SnapshotList snapshots={[validSnapshot]} />);
    expect(screen.getByTestId("snapshot-card-snap_valid_001")).toBeInTheDocument();
    expect(screen.queryByText("3500")).not.toBeInTheDocument();
  });

  it("marks stale snapshots in the list", () => {
    render(<SnapshotList snapshots={[staleSnapshot]} />);
    expect(screen.getByTestId("snapshot-stale-snap_stale_001")).toBeInTheDocument();
  });
});

describe("SnapshotDiff component", () => {
  it("renders metadata and row diff sections", () => {
    render(<SnapshotDiff snapshot={validSnapshot} />);
    expect(screen.getByTestId("snapshot-diff")).toBeInTheDocument();
    expect(screen.getByTestId("snapshot-row-diff")).toBeInTheDocument();
  });

  it("redacts salary amounts in row diff cells", () => {
    render(<SnapshotDiff snapshot={validSnapshot} />);
    const amountCells = screen.getAllByTestId("snapshot-diff-amount-cell");
    amountCells.forEach((cell) => {
      expect(cell.textContent).toMatch(/REDACTED/i);
      expect(cell.textContent).not.toMatch(/3500|2800/);
    });
  });
});

describe("SnapshotDetail component", () => {
  it("shows blocked banner for stale snapshots", () => {
    render(<SnapshotDetail snapshotId="snap_stale_001" snapshot={staleSnapshot} />);
    expect(screen.getByTestId("snapshot-blocked")).toBeInTheDocument();
  });

  it("disables lock CTA when approval is blocked", () => {
    render(<SnapshotDetail snapshotId="snap_stale_001" snapshot={staleSnapshot} />);
    const cta = screen.getByTestId("snapshot-lock-cta");
    expect(cta).toHaveAttribute("aria-disabled", "true");
  });
});

describe("SnapshotLockApproval component", () => {
  it("shows blocked state for stale snapshots", () => {
    render(
      <SnapshotLockApproval
        snapshotId="snap_stale_001"
        snapshot={staleSnapshot}
        initialState="blocked"
      />,
    );
    expect(screen.getByTestId("snapshot-blocked-state")).toBeInTheDocument();
    expect(screen.getByTestId("snapshot-lock-disabled")).toBeDisabled();
  });

  it("approves lock for valid pending snapshot", async () => {
    render(<SnapshotLockApproval snapshotId="snap_valid_001" snapshot={validSnapshot} />);
    fireEvent.click(screen.getByTestId("snapshot-lock-button"));
    expect(await screen.findByTestId("snapshot-locked-state")).toBeInTheDocument();
  });

  it("shows failure path for invalid diff snapshot", () => {
    render(
      <SnapshotLockApproval
        snapshotId="snap_failed_001"
        snapshot={failedSnapshot}
        initialState="blocked"
      />,
    );
    expect(screen.getByTestId("snapshot-blocked-state")).toBeInTheDocument();
    expect(screen.getByText(/merkle root/i)).toBeInTheDocument();
  });
});
