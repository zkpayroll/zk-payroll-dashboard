import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AuditActivityFeed from "@/components/features/compliance/AuditActivityFeed";
import { useAuditActivityStore } from "@/stores/auditActivity";

describe("AuditActivityFeed auditor access events", () => {
  beforeEach(() => {
    useAuditActivityStore.getState().setActivities([]);
  });

  it("shows explicit timeline items when an auditor is assigned or removed", () => {
    useAuditActivityStore.getState().setActivities([
      {
        id: "assigned",
        action: "auditor_assigned",
        actor: "Current Admin",
        targetName: "Auditor One",
        scope: "read-only",
        timestamp: "2026-08-30T10:00:00Z",
        summary: "Auditor assigned: access granted.",
      },
      {
        id: "removed",
        action: "auditor_removed",
        actor: "Current Admin",
        targetName: "Auditor One",
        scope: "read-only",
        timestamp: "2026-08-30T11:00:00Z",
        summary: "Auditor removed: access was revoked.",
      },
    ]);

    render(<AuditActivityFeed />);

    expect(screen.getByText("Auditor Assigned")).toBeInTheDocument();
    expect(screen.getByText("Auditor Removed")).toBeInTheDocument();
    expect(screen.getByText("Auditor assigned: access granted.")).toBeInTheDocument();
    expect(screen.getByText("Auditor removed: access was revoked.")).toBeInTheDocument();
  });
});
