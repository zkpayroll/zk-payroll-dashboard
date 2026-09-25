import { describe, it, expect, beforeEach } from "vitest";
import { useDraftScheduleWindowStore } from "@/stores/draftScheduleWindows";

describe("useDraftScheduleWindowStore", () => {
  beforeEach(() => {
    useDraftScheduleWindowStore.setState({ drafts: [] });
  });

  it("adds a non-overlapping draft window", () => {
    const result = useDraftScheduleWindowStore
      .getState()
      .upsertDraft({ templateId: "tpl_1", windowStart: "2025-01-01", windowEnd: "2025-01-10" });

    expect(result.success).toBe(true);
    expect(useDraftScheduleWindowStore.getState().drafts).toHaveLength(1);
  });

  it("rejects an overlapping draft window and does not add it", () => {
    const store = useDraftScheduleWindowStore.getState();
    store.upsertDraft({ templateId: "tpl_1", windowStart: "2025-01-01", windowEnd: "2025-01-10" });

    const result = useDraftScheduleWindowStore
      .getState()
      .upsertDraft({ templateId: "tpl_1", windowStart: "2025-01-05", windowEnd: "2025-01-15" });

    expect(result.success).toBe(false);
    expect(result.conflictsWith.length).toBe(1);
    expect(useDraftScheduleWindowStore.getState().drafts).toHaveLength(1);
  });

  it("allows updating a draft's own window without treating it as a conflict", () => {
    const first = useDraftScheduleWindowStore
      .getState()
      .upsertDraft({ templateId: "tpl_1", windowStart: "2025-01-01", windowEnd: "2025-01-10" });

    const result = useDraftScheduleWindowStore.getState().upsertDraft({
      id: first.window.id,
      templateId: "tpl_1",
      windowStart: "2025-01-02",
      windowEnd: "2025-01-11",
    });

    expect(result.success).toBe(true);
    expect(useDraftScheduleWindowStore.getState().drafts).toHaveLength(1);
    expect(useDraftScheduleWindowStore.getState().drafts[0].windowStart).toBe("2025-01-02");
  });

  it("removes a draft by id", () => {
    const result = useDraftScheduleWindowStore
      .getState()
      .upsertDraft({ templateId: "tpl_1", windowStart: "2025-01-01", windowEnd: "2025-01-10" });

    useDraftScheduleWindowStore.getState().removeDraft(result.window.id);

    expect(useDraftScheduleWindowStore.getState().drafts).toHaveLength(0);
  });

  it("filters drafts by template", () => {
    useDraftScheduleWindowStore.getState().upsertDraft({
      templateId: "tpl_1",
      windowStart: "2025-01-01",
      windowEnd: "2025-01-10",
    });
    useDraftScheduleWindowStore.getState().upsertDraft({
      templateId: "tpl_2",
      windowStart: "2025-02-01",
      windowEnd: "2025-02-10",
    });

    const tpl1Drafts = useDraftScheduleWindowStore.getState().getDraftsForTemplate("tpl_1");
    expect(tpl1Drafts).toHaveLength(1);
    expect(tpl1Drafts[0].templateId).toBe("tpl_1");
  });

  it("clears all drafts", () => {
    useDraftScheduleWindowStore.getState().upsertDraft({
      templateId: "tpl_1",
      windowStart: "2025-01-01",
      windowEnd: "2025-01-10",
    });

    useDraftScheduleWindowStore.getState().clearDrafts();

    expect(useDraftScheduleWindowStore.getState().drafts).toHaveLength(0);
  });
});
