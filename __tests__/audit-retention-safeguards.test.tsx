import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AuditRetentionPolicy } from "@/types/policy";
import {
  evaluateAuditRetention,
  filterPrunableAuditRecords,
  type AuditRecordMeta,
} from "@/src/audit/recordRetention";
import { RetentionSafeguardPanel } from "@/components/audit/RetentionSafeguardPanel";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);

function policy(overrides: Partial<AuditRetentionPolicy> = {}): AuditRetentionPolicy {
  return {
    retentionPeriodDays: 365,
    immutableAuditLog: false,
    requireAuditorExportSignoff: true,
    detailedTelemetry: false,
    ...overrides,
  };
}

function record(overrides: Partial<AuditRecordMeta> = {}): AuditRecordMeta {
  return {
    id: "aud_001",
    createdAt: new Date(NOW - 10 * DAY_MS).toISOString(),
    category: "payroll_run",
    ...overrides,
  };
}

describe("Audit record retention safeguards (Issue #619)", () => {
  it("protects records inside the retention window and allows expired ones (main path)", () => {
    const records = [
      record({ id: "aud_recent", createdAt: new Date(NOW - 10 * DAY_MS).toISOString() }),
      record({ id: "aud_old", createdAt: new Date(NOW - 400 * DAY_MS).toISOString() }),
    ];

    const evaluation = evaluateAuditRetention(records, policy(), NOW);

    expect(evaluation.policyValid).toBe(true);
    const byId = Object.fromEntries(
      evaluation.decisions.map((d) => [d.recordId, d]),
    );
    expect(byId["aud_recent"].allowed).toBe(false);
    expect(byId["aud_recent"].reasons.join(" ")).toMatch(/retention window/i);
    expect(byId["aud_old"].allowed).toBe(true);
    expect(evaluation.protectedCount).toBe(1);
    expect(evaluation.prunableCount).toBe(1);

    const prunable = filterPrunableAuditRecords(records, policy(), NOW);
    expect(prunable.map((r) => r.id)).toEqual(["aud_old"]);
  });

  it("blocks all deletion under an append-only audit log", () => {
    const records = [
      record({ id: "aud_old", createdAt: new Date(NOW - 400 * DAY_MS).toISOString() }),
    ];

    const evaluation = evaluateAuditRetention(
      records,
      policy({ immutableAuditLog: true }),
      NOW,
    );

    expect(evaluation.decisions[0].allowed).toBe(false);
    expect(evaluation.decisions[0].reasons.join(" ")).toMatch(/append-only/i);
    expect(evaluation.allProtected).toBe(true);
  });

  it("rejects invalid retention policies and fails closed (edge cases)", () => {
    const records = [record()];

    const tooShort = evaluateAuditRetention(
      records,
      policy({ retentionPeriodDays: 7 }),
      NOW,
    );
    expect(tooShort.policyValid).toBe(false);
    expect(tooShort.policyErrors.join(" ")).toMatch(/at least 30 days/i);
    expect(tooShort.decisions[0].allowed).toBe(false);

    const tooLong = evaluateAuditRetention(
      records,
      policy({ retentionPeriodDays: 9999 }),
      NOW,
    );
    expect(tooLong.policyValid).toBe(false);
    expect(tooLong.policyErrors.join(" ")).toMatch(/cannot exceed 3650 days/i);
  });

  it("protects immutable records even outside the window", () => {
    const records = [
      record({
        id: "aud_immutable",
        createdAt: new Date(NOW - 400 * DAY_MS).toISOString(),
        immutable: true,
      }),
    ];

    const evaluation = evaluateAuditRetention(records, policy(), NOW);
    expect(evaluation.decisions[0].allowed).toBe(false);
    expect(evaluation.decisions[0].reasons.join(" ")).toMatch(/flagged immutable/i);
  });

  it("renders the safeguard panel with protected/prunable decisions and policy errors", () => {
    const records = [
      record({ id: "aud_recent" }),
      record({ id: "aud_old", createdAt: new Date(NOW - 400 * DAY_MS).toISOString() }),
    ];

    const { rerender } = render(
      <RetentionSafeguardPanel policy={policy()} records={records} now={NOW} />,
    );

    expect(screen.getByTestId("retention-safeguard-panel")).toBeInTheDocument();
    expect(
      screen.getByTestId("retention-decision-aud_recent"),
    ).toHaveTextContent("Protected");
    expect(
      screen.getByTestId("retention-decision-aud_old"),
    ).toHaveTextContent("Prunable");

    rerender(
      <RetentionSafeguardPanel
        policy={policy({ retentionPeriodDays: 5 })}
        records={records}
        now={NOW}
      />,
    );

    const panel = screen.getByTestId("retention-safeguard-panel");
    expect(panel).toHaveAttribute("data-policy-valid", "false");
    expect(screen.getByTestId("retention-policy-errors").textContent).toMatch(
      /at least 30 days/i,
    );
  });

  it("renders the empty state when there are no audit records", () => {
    render(<RetentionSafeguardPanel policy={policy()} records={[]} now={NOW} />);
    expect(
      screen.getByText(/No audit records to evaluate/i),
    ).toBeInTheDocument();
  });
});
