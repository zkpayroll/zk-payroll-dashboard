/**
 * Tests — Payroll Draft Provenance Tracking (#723).
 *
 * Three suites:
 *  1. `createDraftContentChecksum` — deterministic, privacy-safe digest with
 *     actionable validation errors.
 *  2. `buildProvenanceEntry` — entry shape, actor defaulting, ordering.
 *  3. `usePayrollDraftsStore` provenance — success path (create + update
 *     record entries), failure path (validation throws, no state change), and
 *     edge cases (default actor, history cap, missing draft is a no-op).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { usePayrollDraftsStore } from "@/stores/payrollDrafts";
import type { PayrollDraft } from "@/stores/payrollDrafts";
import {
  createDraftContentChecksum,
  buildProvenanceEntry,
  MAX_PROVENANCE_ENTRIES,
  SYSTEM_ACTOR,
} from "@/lib/payroll/draftProvenance";

const baseDraft: Omit<PayrollDraft, "id" | "createdAt" | "updatedAt" | "expiresAt" | "status"> = {
  name: "August Payroll - Engineering",
  employeeIds: ["emp_1", "emp_2", "emp_3"],
  totalAmount: 75000,
  payPeriod: "Aug 2025",
  currency: "USDC",
};

function resetStore(): void {
  usePayrollDraftsStore.setState({ drafts: [], activeDraftId: null });
}

// ─── Suite 1: createDraftContentChecksum ───────────────────────────────────

describe("createDraftContentChecksum", () => {
  it("produces a deterministic digest for identical inputs", () => {
    const first = createDraftContentChecksum({ ...baseDraft, totalAmount: 75000 });
    const second = createDraftContentChecksum({ ...baseDraft, totalAmount: 75000 });
    expect(first).toBe(second);
    expect(first).toMatch(/^hash:[0-9a-f]{8}$/);
  });

  it("does not reversibly expose structural fields in the digest", () => {
    const digest = createDraftContentChecksum({ ...baseDraft, totalAmount: 75000 });
    expect(digest).not.toContain("August Payroll");
    expect(digest).not.toContain("75000");
    expect(digest).not.toContain("emp_1");
    expect(digest).not.toContain("USDC");
  });

  it("changes when any structural field changes", () => {
    const input = {
      name: baseDraft.name,
      payPeriod: baseDraft.payPeriod,
      currency: baseDraft.currency,
      employeeCount: baseDraft.employeeIds.length,
      totalAmount: baseDraft.totalAmount,
    };
    const baseline = createDraftContentChecksum(input);
    expect(createDraftContentChecksum({ ...input, totalAmount: 75001 })).not.toBe(baseline);
    expect(createDraftContentChecksum({ ...input, name: "Other Payroll" })).not.toBe(baseline);
    expect(createDraftContentChecksum({ ...input, currency: "XLM" })).not.toBe(baseline);
    expect(createDraftContentChecksum({ ...input, employeeCount: 2 })).not.toBe(baseline);
  });

  // ── Failure path ────────────────────────────────────────────────────────

  it("throws an actionable error when totalAmount is negative", () => {
    expect(() =>
      createDraftContentChecksum({ ...baseDraft, totalAmount: -5 }),
    ).toThrow(/total amount must be a finite, non-negative number/i);
  });

  it("throws an actionable error when totalAmount is not finite", () => {
    expect(() =>
      createDraftContentChecksum({ ...baseDraft, totalAmount: NaN }),
    ).toThrow(/total amount must be a finite, non-negative number/i);
  });

  it("throws an actionable error when name is empty", () => {
    expect(() =>
      createDraftContentChecksum({ ...baseDraft, name: "   " }),
    ).toThrow(/draft name is required to record provenance/i);
  });

  // ── Edge case ───────────────────────────────────────────────────────────

  it("accepts a totalAmount of 0 (empty-batch edge case)", () => {
    const digest = createDraftContentChecksum({ ...baseDraft, totalAmount: 0 });
    expect(digest).toMatch(/^hash:[0-9a-f]{8}$/);
  });
});

// ─── Suite 2: buildProvenanceEntry ─────────────────────────────────────────

describe("buildProvenanceEntry", () => {
  const input = {
    name: baseDraft.name,
    payPeriod: baseDraft.payPeriod,
    currency: baseDraft.currency,
    employeeCount: baseDraft.employeeIds.length,
    totalAmount: baseDraft.totalAmount,
  };

  it("builds a created entry with actor, timestamp, and digest", () => {
    const entry = buildProvenanceEntry("created", "admin@zkpayroll.io", input);
    expect(entry.action).toBe("created");
    expect(entry.actor).toBe("admin@zkpayroll.io");
    expect(entry.contentChecksum).toMatch(/^hash:[0-9a-f]{8}$/);
    expect(entry.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("defaults the actor to SYSTEM_ACTOR when omitted or blank", () => {
    expect(buildProvenanceEntry("created", "", input).actor).toBe(SYSTEM_ACTOR);
    expect(buildProvenanceEntry("created", undefined as unknown as string, input).actor).toBe(
      SYSTEM_ACTOR,
    );
    expect(buildProvenanceEntry("created", "   ", input).actor).toBe(SYSTEM_ACTOR);
  });

  it("records an updated entry distinctly from a created entry", () => {
    const created = buildProvenanceEntry("created", "admin@zkpayroll.io", input);
    const updated = buildProvenanceEntry("updated", "admin@zkpayroll.io", input);
    expect(created.action).toBe("created");
    expect(updated.action).toBe("updated");
    // Same content, same actor → same digest; entries differ only by action.
    expect(created.contentChecksum).toBe(updated.contentChecksum);
  });
});

// ─── Suite 3: usePayrollDraftsStore provenance ─────────────────────────────

describe("usePayrollDraftsStore provenance", () => {
  beforeEach(resetStore);

  // ── Success path ────────────────────────────────────────────────────────

  it("addDraft records a created provenance entry", () => {
    const { addDraft, getDraftProvenance } = usePayrollDraftsStore.getState();
    const draft = addDraft(baseDraft, { actor: "admin@zkpayroll.io" });

    const provenance = getDraftProvenance(draft.id);
    expect(provenance).toHaveLength(1);
    expect(provenance[0].action).toBe("created");
    expect(provenance[0].actor).toBe("admin@zkpayroll.io");
    expect(provenance[0].contentChecksum).toBeTruthy();
    expect(provenance[0].timestamp).toBeDefined();
    expect(draft.provenance).toHaveLength(1);
  });

  it("updateDraft records an updated provenance entry in order", () => {
    const { addDraft, updateDraft, getDraftProvenance } =
      usePayrollDraftsStore.getState();
    const draft = addDraft(baseDraft, { actor: "admin@zkpayroll.io" });

    updateDraft(draft.id, { totalAmount: 80000 }, { actor: "finance@zkpayroll.io" });

    const provenance = getDraftProvenance(draft.id);
    expect(provenance).toHaveLength(2);
    expect(provenance[0].action).toBe("created");
    expect(provenance[1].action).toBe("updated");
    expect(provenance[1].actor).toBe("finance@zkpayroll.io");
    // Content changed → digest changed between entries.
    expect(provenance[1].contentChecksum).not.toBe(provenance[0].contentChecksum);
  });

  it("getDraftProvenance returns an empty array for a draft without provenance", () => {
    const { addDraft, getDraftProvenance } = usePayrollDraftsStore.getState();
    const draft = addDraft(baseDraft);
    // Directly persisted drafts (e.g. from localStorage) may lack provenance.
    usePayrollDraftsStore.setState((state) => ({
      drafts: state.drafts.map((d) =>
        d.id === draft.id ? { ...d, provenance: undefined } : d
      ),
    }));
    expect(getDraftProvenance(draft.id)).toEqual([]);
  });

  // ── Failure path ────────────────────────────────────────────────────────

  it("addDraft throws on negative totalAmount and leaves state unchanged", () => {
    const { addDraft } = usePayrollDraftsStore.getState();
    expect(() =>
      addDraft({ ...baseDraft, totalAmount: -100 }),
    ).toThrow(/total amount must be a finite, non-negative number/i);
    expect(usePayrollDraftsStore.getState().drafts).toHaveLength(0);
  });

  it("addDraft throws on an empty name and leaves state unchanged", () => {
    const { addDraft } = usePayrollDraftsStore.getState();
    expect(() =>
      addDraft({ ...baseDraft, name: "" }),
    ).toThrow(/draft name is required to record provenance/i);
    expect(usePayrollDraftsStore.getState().drafts).toHaveLength(0);
  });

  it("updateDraft throws on invalid totalAmount and leaves the draft unchanged", () => {
    const { addDraft, updateDraft } = usePayrollDraftsStore.getState();
    const draft = addDraft(baseDraft);
    const before = usePayrollDraftsStore
      .getState()
      .drafts.find((d) => d.id === draft.id);

    expect(() =>
      updateDraft(draft.id, { totalAmount: -50 }),
    ).toThrow(/total amount must be a finite, non-negative number/i);

    const after = usePayrollDraftsStore
      .getState()
      .drafts.find((d) => d.id === draft.id);
    expect(after).toEqual(before);
    expect(usePayrollDraftsStore.getState().getDraftProvenance(draft.id)).toHaveLength(1);
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  it("defaults the actor to SYSTEM_ACTOR when none is supplied", () => {
    const { addDraft, getDraftProvenance } = usePayrollDraftsStore.getState();
    const draft = addDraft(baseDraft);
    expect(getDraftProvenance(draft.id)[0].actor).toBe(SYSTEM_ACTOR);
  });

  it("evicts the oldest provenance entries beyond MAX_PROVENANCE_ENTRIES", () => {
    const { addDraft, updateDraft, getDraftProvenance } =
      usePayrollDraftsStore.getState();
    const draft = addDraft(baseDraft);

    for (let i = 0; i < MAX_PROVENANCE_ENTRIES + 5; i++) {
      updateDraft(draft.id, { totalAmount: 75000 + i });
    }

    const provenance = getDraftProvenance(draft.id);
    expect(provenance).toHaveLength(MAX_PROVENANCE_ENTRIES);
    // With more updates than the cap, the original "created" entry is evicted.
    expect(provenance[0].action).toBe("updated");
  });

  it("retains the original created entry when updates stay under the cap", () => {
    const { addDraft, updateDraft, getDraftProvenance } =
      usePayrollDraftsStore.getState();
    const draft = addDraft(baseDraft);

    for (let i = 0; i < 3; i++) {
      updateDraft(draft.id, { totalAmount: 75000 + i });
    }

    const provenance = getDraftProvenance(draft.id);
    expect(provenance).toHaveLength(4);
    expect(provenance[0].action).toBe("created");
  });

  it("updateDraft on a non-existent draft is a no-op", () => {
    const { updateDraft } = usePayrollDraftsStore.getState();
    const before = usePayrollDraftsStore.getState().drafts;
    updateDraft("draft_does_not_exist", { totalAmount: 100 });
    expect(usePayrollDraftsStore.getState().drafts).toEqual(before);
  });
});
