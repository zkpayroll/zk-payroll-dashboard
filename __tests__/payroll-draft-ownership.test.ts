import { describe, it, expect } from "vitest";
import {
  formatDraftOwner,
  describeDraftOwnershipAge,
  resolveDraftOwnership,
} from "@/lib/payroll/draftOwnership";

describe("formatDraftOwner", () => {
  it("truncates a Stellar public key to the repo's shortAddress convention", () => {
    // Matches shortAddress() in PayrollLockReasonViewer.tsx so the two owner
    // surfaces in the app cannot drift apart.
    const pk = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
    expect(formatDraftOwner(pk)).toBe("GBBD47...FLA5");
    expect(formatDraftOwner(pk)).toBe(
      `${pk.slice(0, 6)}...${pk.slice(-4)}`,
    );
  });

  it("renders non-human actors as a readable word", () => {
    expect(formatDraftOwner("system")).toBe("System");
    expect(formatDraftOwner("scheduler")).toBe("Scheduler");
    expect(formatDraftOwner("SYSTEM")).toBe("System");
  });

  it("leaves short identities intact rather than truncating them into noise", () => {
    expect(formatDraftOwner("admin")).toBe("admin");
    expect(formatDraftOwner("finance@zkpayroll.io")).toBe("finance@zkpayroll.io");
  });

  it("never renders an empty or whitespace owner as a blank cell", () => {
    expect(formatDraftOwner("")).toBe("Unknown");
    expect(formatDraftOwner("   ")).toBe("Unknown");
    expect(formatDraftOwner(null)).toBe("Unknown");
    expect(formatDraftOwner(undefined)).toBe("Unknown");
  });
});

describe("describeDraftOwnershipAge", () => {
  const now = Date.parse("2026-09-28T12:00:00.000Z");

  it("describes recent, hourly and daily ages", () => {
    expect(describeDraftOwnershipAge("2026-09-28T11:59:30.000Z", now)).toBe("just now");
    expect(describeDraftOwnershipAge("2026-09-28T11:45:00.000Z", now)).toBe("15m ago");
    expect(describeDraftOwnershipAge("2026-09-28T09:00:00.000Z", now)).toBe("3h ago");
    expect(describeDraftOwnershipAge("2026-09-26T12:00:00.000Z", now)).toBe("2d ago");
  });

  it("does not render negative ages for clock skew", () => {
    expect(describeDraftOwnershipAge("2026-09-28T12:05:00.000Z", now)).toBe("just now");
  });

  it("returns an empty string for an unparseable timestamp instead of guessing", () => {
    expect(describeDraftOwnershipAge("not-a-date", now)).toBe("");
    expect(describeDraftOwnershipAge("", now)).toBe("");
  });
});

describe("resolveDraftOwnership", () => {
  const now = Date.parse("2026-09-28T12:00:00.000Z");

  it("reports a recorded owner and its age", () => {
    const result = resolveDraftOwnership(
      {
        lastSavedBy: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        updatedAt: "2026-09-28T11:00:00.000Z",
      },
      now,
    );
    expect(result).toEqual({
      owner: "GBBD47...FLA5",
      age: "1h ago",
      isUnknown: false,
    });
  });

  it("flags a draft with no recorded owner instead of showing a blank", () => {
    // The edge case that matters: an older draft persisted before lastSavedBy
    // existed, or written by a code path that omits it. Silently hiding the
    // owner would leave the operator believing nobody touched the draft.
    const result = resolveDraftOwnership({ updatedAt: "2026-09-28T11:00:00.000Z" }, now);
    expect(result.isUnknown).toBe(true);
    expect(result.owner).toBe("Unknown");
  });

  it("treats a whitespace-only owner as unknown", () => {
    const result = resolveDraftOwnership(
      { lastSavedBy: "   ", updatedAt: "2026-09-28T11:00:00.000Z" },
      now,
    );
    expect(result.isUnknown).toBe(true);
  });

  it("exposes an age even when the owner is unknown", () => {
    const result = resolveDraftOwnership({ updatedAt: "2026-09-28T11:00:00.000Z" }, now);
    expect(result.age).toBe("1h ago");
  });
});
