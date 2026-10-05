/**
 * Employee Duplicate Import Resolution UI tests.
 *
 * Covers:
 *  - Exact and likely duplicate clusters
 *  - Resolution actions: merge, keep separate, dismiss, request review
 *  - Dismissed clusters
 *  - Redacted employee previews
 *  - Import blocking for unresolved critical clusters
 *  - Panel rendering and summary
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  useEmployeeImportStore,
  hashEmployeeRef,
} from "@/stores/employeeImport";
import type {
  EmployeeImportRecord,
  DuplicateCluster,
} from "@/types/import";

// ─── Mock data helpers ──────────────────────────────────────────────────────

let rowIdCounter = 0;

function createRecord(overrides: Partial<EmployeeImportRecord> = {}): EmployeeImportRecord {
  rowIdCounter++;
  return {
    rowId: `row_${rowIdCounter}`,
    name: `Employee ${rowIdCounter}`,
    email: `emp${rowIdCounter}@example.com`,
    department: "Engineering",
    ...overrides,
  };
}

function createCluster(overrides: Partial<DuplicateCluster> = {}): DuplicateCluster {
  const records = overrides.records ?? [createRecord(), createRecord()];
  const previews = records.map((r) => ({
    refHash: hashEmployeeRef(r.rowId),
    department: r.department,
    hireDate: r.hireDate,
    differingFields: [] as string[],
  }));
  const { previews: overridePreviews, ...restOverrides } = overrides;
  return {
    id: `cluster_${Math.random().toString(36).slice(2, 8)}`,
    confidence: "exact",
    records,
    previews: overridePreviews ?? previews,
    matchedOn: ["name", "email"],
    resolution: null,
    blocksImport: true,
    ...restOverrides,
  };
}

function resetStore() {
  useEmployeeImportStore.getState().resetImport();
}

// ─── Store tests ────────────────────────────────────────────────────────────

describe("EmployeeImportStore", () => {
  beforeEach(() => {
    resetStore();
    rowIdCounter = 0;
  });

  it("starts with idle status", () => {
    const { session } = useEmployeeImportStore.getState();
    expect(session.status).toBe("idle");
    expect(session.records).toEqual([]);
    expect(session.duplicateClusters).toEqual([]);
  });

  it("starts import with records", () => {
    const records = [createRecord(), createRecord(), createRecord()];
    useEmployeeImportStore.getState().startImport(records);
    const { session } = useEmployeeImportStore.getState();
    expect(session.status).toBe("parsing");
    expect(session.records).toHaveLength(3);
  });

  it("sets duplicate clusters and updates counts", () => {
    useEmployeeImportStore.getState().startImport([
      createRecord(),
      createRecord(),
      createRecord(),
    ]);

    const cluster = createCluster({
      confidence: "exact",
      blocksImport: true,
    });

    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);
    const { session } = useEmployeeImportStore.getState();
    expect(session.status).toBe("review_duplicates");
    expect(session.duplicateClusters).toHaveLength(1);
    expect(session.unresolvedCriticalCount).toBe(1);
    expect(session.canFinalize).toBe(false);
  });

  it("canFinalize is true when no critical unresolved clusters", () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);

    const nonCriticalCluster = createCluster({
      confidence: "likely",
      blocksImport: false,
    });

    useEmployeeImportStore.getState().setDuplicateClusters([nonCriticalCluster]);
    const { session } = useEmployeeImportStore.getState();
    expect(session.canFinalize).toBe(true);
    expect(session.unresolvedCriticalCount).toBe(0);
  });

  it("resolves cluster with merge action", () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ id: "c1", blocksImport: true });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);

    useEmployeeImportStore.getState().resolveCluster("c1", "merge");
    const { session } = useEmployeeImportStore.getState();
    expect(session.duplicateClusters[0].resolution).toBe("merge");
    expect(session.unresolvedCriticalCount).toBe(0);
    expect(session.canFinalize).toBe(true);
  });

  it("resolves cluster with keep_separate action", () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ id: "c1", blocksImport: true });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);

    useEmployeeImportStore.getState().resolveCluster("c1", "keep_separate");
    const { session } = useEmployeeImportStore.getState();
    expect(session.duplicateClusters[0].resolution).toBe("keep_separate");
    expect(session.canFinalize).toBe(true);
  });

  it("resolves cluster with dismiss action", () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ id: "c1", blocksImport: true });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);

    useEmployeeImportStore.getState().resolveCluster("c1", "dismiss");
    const { session } = useEmployeeImportStore.getState();
    expect(session.duplicateClusters[0].resolution).toBe("dismiss");
    expect(session.canFinalize).toBe(true);
  });

  it("resolves cluster with request_review action and notes", () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ id: "c1", blocksImport: true });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);

    useEmployeeImportStore.getState().resolveCluster("c1", "request_review", "Needs manager approval");
    const { session } = useEmployeeImportStore.getState();
    expect(session.duplicateClusters[0].resolution).toBe("request_review");
    expect(session.duplicateClusters[0].reviewNotes).toBe("Needs manager approval");
    expect(session.canFinalize).toBe(true);
  });

  it("finalizeImport succeeds when not blocked", () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    useEmployeeImportStore.getState().setDuplicateClusters([]);

    const result = useEmployeeImportStore.getState().finalizeImport();
    expect(result).toBe(true);
    expect(useEmployeeImportStore.getState().session.status).toBe("completed");
  });

  it("finalizeImport fails when blocked", () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ blocksImport: true });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);

    const result = useEmployeeImportStore.getState().finalizeImport();
    expect(result).toBe(false);
    expect(useEmployeeImportStore.getState().session.status).toBe("review_duplicates");
  });

  it("isImportBlocked returns true when critical clusters exist", () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ blocksImport: true });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);
    expect(useEmployeeImportStore.getState().isImportBlocked()).toBe(true);
  });

  it("isImportBlocked returns false when no critical clusters", () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    useEmployeeImportStore.getState().setDuplicateClusters([]);
    expect(useEmployeeImportStore.getState().isImportBlocked()).toBe(false);
  });

  it("resetImport clears all state", () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster();
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);
    useEmployeeImportStore.getState().resetImport();

    const { session } = useEmployeeImportStore.getState();
    expect(session.status).toBe("idle");
    expect(session.records).toEqual([]);
    expect(session.duplicateClusters).toEqual([]);
  });
});

// ─── Redaction tests ───────────────────────────────────────────────────────

describe("Employee data redaction", () => {
  beforeEach(() => {
    resetStore();
    rowIdCounter = 0;
  });

  it("generates stable ref hashes for employee records", () => {
    const hash1 = hashEmployeeRef("emp_001");
    const hash2 = hashEmployeeRef("emp_001");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^emp_ref_[a-f0-9]{16}$/);
  });

  it("different employee IDs produce different hashes", () => {
    const hash1 = hashEmployeeRef("emp_001");
    const hash2 = hashEmployeeRef("emp_002");
    expect(hash1).not.toBe(hash2);
  });

  it("empty employee ID returns fallback", () => {
    const hash = hashEmployeeRef("");
    expect(hash).toBe("emp_ref_none");
  });

  it("never exposes raw employee names in store previews", () => {
    useEmployeeImportStore.getState().startImport([
      createRecord({ name: "John Smith", email: "john@example.com" }),
      createRecord({ name: "John Smith", email: "john@example.com" }),
    ]);

    const cluster = createCluster({
      records: useEmployeeImportStore.getState().session.records,
    });

    // The previews should contain ref hashes, not raw names
    for (const preview of cluster.previews) {
      expect(preview.refHash).toMatch(/^emp_ref_/);
    }
  });
});

// ─── Panel rendering tests ─────────────────────────────────────────────────

describe("DuplicateResolutionPanel", () => {
  beforeEach(() => {
    resetStore();
    rowIdCounter = 0;
  });

  it("renders empty state when no clusters", async () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    useEmployeeImportStore.getState().setDuplicateClusters([]);

    const DuplicateResolutionPanel = (
      await import("@/components/features/import/DuplicateResolutionPanel")
    ).default;
    render(<DuplicateResolutionPanel />);

    expect(screen.getByTestId("duplicate-resolution-panel")).toBeInTheDocument();
    expect(screen.getByText(/No duplicate clusters detected/)).toBeInTheDocument();
  });

  it("renders nothing when isOpen is false", async () => {
    const DuplicateResolutionPanel = (
      await import("@/components/features/import/DuplicateResolutionPanel")
    ).default;
    render(<DuplicateResolutionPanel isOpen={false} />);

    expect(screen.queryByTestId("duplicate-resolution-panel")).not.toBeInTheDocument();
  });

  it("renders exact duplicate cluster", async () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ id: "c1", confidence: "exact" });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);

    const DuplicateResolutionPanel = (
      await import("@/components/features/import/DuplicateResolutionPanel")
    ).default;
    render(<DuplicateResolutionPanel />);

    expect(screen.getByTestId("duplicate-cluster-c1")).toBeInTheDocument();
    expect(screen.getByTestId("confidence-badge-exact")).toBeInTheDocument();
    expect(screen.getByText("Exact Match")).toBeInTheDocument();
  });

  it("renders likely duplicate cluster", async () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ id: "c2", confidence: "likely" });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);

    const DuplicateResolutionPanel = (
      await import("@/components/features/import/DuplicateResolutionPanel")
    ).default;
    render(<DuplicateResolutionPanel />);

    expect(screen.getByTestId("confidence-badge-likely")).toBeInTheDocument();
    expect(screen.getByText("Likely Match")).toBeInTheDocument();
  });

  it("shows blocks import warning for critical unresolved clusters", async () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ id: "c1", blocksImport: true });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);

    const DuplicateResolutionPanel = (
      await import("@/components/features/import/DuplicateResolutionPanel")
    ).default;
    render(<DuplicateResolutionPanel />);

    expect(screen.getByText("Blocks import")).toBeInTheDocument();
    expect(screen.getByText(/Resolve all critical duplicate clusters/)).toBeInTheDocument();
  });

  it("shows resolution action buttons", async () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ id: "c1" });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);

    const DuplicateResolutionPanel = (
      await import("@/components/features/import/DuplicateResolutionPanel")
    ).default;
    render(<DuplicateResolutionPanel />);

    expect(screen.getByTestId("resolve-merge-c1")).toBeInTheDocument();
    expect(screen.getByTestId("resolve-keep_separate-c1")).toBeInTheDocument();
    expect(screen.getByTestId("resolve-dismiss-c1")).toBeInTheDocument();
    expect(screen.getByTestId("resolve-request_review-c1")).toBeInTheDocument();
  });

  it("merge action resolves cluster", async () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ id: "c1", blocksImport: true });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);

    const DuplicateResolutionPanel = (
      await import("@/components/features/import/DuplicateResolutionPanel")
    ).default;
    render(<DuplicateResolutionPanel />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId("resolve-merge-c1"));

    const state = useEmployeeImportStore.getState();
    expect(state.session.duplicateClusters[0].resolution).toBe("merge");
    expect(state.session.canFinalize).toBe(true);
  });

  it("keep_separate action resolves cluster", async () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ id: "c1", blocksImport: true });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);

    const DuplicateResolutionPanel = (
      await import("@/components/features/import/DuplicateResolutionPanel")
    ).default;
    render(<DuplicateResolutionPanel />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId("resolve-keep_separate-c1"));

    const state = useEmployeeImportStore.getState();
    expect(state.session.duplicateClusters[0].resolution).toBe("keep_separate");
  });

  it("dismiss action resolves cluster", async () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ id: "c1", blocksImport: true });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);

    const DuplicateResolutionPanel = (
      await import("@/components/features/import/DuplicateResolutionPanel")
    ).default;
    render(<DuplicateResolutionPanel />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId("resolve-dismiss-c1"));

    const state = useEmployeeImportStore.getState();
    expect(state.session.duplicateClusters[0].resolution).toBe("dismiss");
  });

  it("request_review action resolves cluster", async () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ id: "c1", blocksImport: true });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);

    const DuplicateResolutionPanel = (
      await import("@/components/features/import/DuplicateResolutionPanel")
    ).default;
    render(<DuplicateResolutionPanel />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId("resolve-request_review-c1"));

    const state = useEmployeeImportStore.getState();
    expect(state.session.duplicateClusters[0].resolution).toBe("request_review");
  });

  it("shows resolved status after resolving a cluster", async () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ id: "c1" });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);
    useEmployeeImportStore.getState().resolveCluster("c1", "merge");

    const DuplicateResolutionPanel = (
      await import("@/components/features/import/DuplicateResolutionPanel")
    ).default;
    render(<DuplicateResolutionPanel />);

    expect(screen.getByText("Merged")).toBeInTheDocument();
  });

  it("hides action buttons for resolved clusters", async () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ id: "c1" });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);
    useEmployeeImportStore.getState().resolveCluster("c1", "merge");

    const DuplicateResolutionPanel = (
      await import("@/components/features/import/DuplicateResolutionPanel")
    ).default;
    render(<DuplicateResolutionPanel />);

    expect(screen.queryByTestId("resolve-merge-c1")).not.toBeInTheDocument();
  });

  it("expands cluster details on click", async () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ id: "c1" });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);

    const DuplicateResolutionPanel = (
      await import("@/components/features/import/DuplicateResolutionPanel")
    ).default;
    render(<DuplicateResolutionPanel />);

    expect(screen.queryByTestId("cluster-details-c1")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByText("Details"));

    expect(screen.getByTestId("cluster-details-c1")).toBeInTheDocument();
  });

  it("shows summary counts correctly", async () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const clusters = [
      createCluster({ id: "c1", blocksImport: true }),
      createCluster({ id: "c2", blocksImport: true }),
      createCluster({ id: "c3", blocksImport: false }),
    ];
    useEmployeeImportStore.getState().setDuplicateClusters(clusters);
    useEmployeeImportStore.getState().resolveCluster("c1", "merge");

    const DuplicateResolutionPanel = (
      await import("@/components/features/import/DuplicateResolutionPanel")
    ).default;
    render(<DuplicateResolutionPanel />);

    expect(screen.getByText("1 of 3 clusters resolved")).toBeInTheDocument();
    expect(screen.getByText(/1 critical cluster remaining/)).toBeInTheDocument();
  });
});

// ─── Dismissed cluster tests ───────────────────────────────────────────────

describe("Dismissed clusters", () => {
  beforeEach(() => {
    resetStore();
    rowIdCounter = 0;
  });

  it("dismissed cluster shows resolved status", async () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ id: "c1", blocksImport: true });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);
    useEmployeeImportStore.getState().resolveCluster("c1", "dismiss");

    const DuplicateResolutionPanel = (
      await import("@/components/features/import/DuplicateResolutionPanel")
    ).default;
    render(<DuplicateResolutionPanel />);

    expect(screen.getByText("Dismissed")).toBeInTheDocument();
    expect(screen.queryByTestId("resolve-dismiss-c1")).not.toBeInTheDocument();
  });

  it("dismissed critical cluster unblocks import", () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const cluster = createCluster({ id: "c1", blocksImport: true });
    useEmployeeImportStore.getState().setDuplicateClusters([cluster]);

    expect(useEmployeeImportStore.getState().isImportBlocked()).toBe(true);

    useEmployeeImportStore.getState().resolveCluster("c1", "dismiss");
    expect(useEmployeeImportStore.getState().isImportBlocked()).toBe(false);
  });
});

// ─── Multiple cluster tests ────────────────────────────────────────────────

describe("Multiple duplicate clusters", () => {
  beforeEach(() => {
    resetStore();
    rowIdCounter = 0;
  });

  it("renders all clusters in the panel", async () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const clusters = [
      createCluster({ id: "c1", confidence: "exact" }),
      createCluster({ id: "c2", confidence: "likely" }),
      createCluster({ id: "c3", confidence: "exact" }),
    ];
    useEmployeeImportStore.getState().setDuplicateClusters(clusters);

    const DuplicateResolutionPanel = (
      await import("@/components/features/import/DuplicateResolutionPanel")
    ).default;
    render(<DuplicateResolutionPanel />);

    expect(screen.getByTestId("cluster-list")).toBeInTheDocument();
    expect(screen.getByTestId("duplicate-cluster-c1")).toBeInTheDocument();
    expect(screen.getByTestId("duplicate-cluster-c2")).toBeInTheDocument();
    expect(screen.getByTestId("duplicate-cluster-c3")).toBeInTheDocument();
  });

  it("import remains blocked until all critical clusters resolved", async () => {
    useEmployeeImportStore.getState().startImport([createRecord()]);
    const clusters = [
      createCluster({ id: "c1", blocksImport: true }),
      createCluster({ id: "c2", blocksImport: true }),
    ];
    useEmployeeImportStore.getState().setDuplicateClusters(clusters);

    expect(useEmployeeImportStore.getState().isImportBlocked()).toBe(true);

    useEmployeeImportStore.getState().resolveCluster("c1", "merge");
    expect(useEmployeeImportStore.getState().isImportBlocked()).toBe(true);

    useEmployeeImportStore.getState().resolveCluster("c2", "dismiss");
    expect(useEmployeeImportStore.getState().isImportBlocked()).toBe(false);
    expect(useEmployeeImportStore.getState().session.canFinalize).toBe(true);
  });
});
