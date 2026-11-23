import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import AuditorArchivedPeriodsView from "@/components/features/audit/AuditorArchivedPeriodsView";
import {
  AUDITOR_WITHHELD_RUN_FIELDS,
  evaluateAuditorArchivedPeriodAccess,
  groupArchivedPeriodsForAuditor,
  previewTransactionHash,
} from "@/lib/audit/auditorArchivedPeriods";
import type { ArchivedPayrollRun } from "@/stores/archive";

/**
 * Auditor read-only view of archived payroll periods (#858): auditors see
 * archived periods with private salary and employee data withheld; other
 * roles and failed session checks get actionable messages that never expose
 * private payroll data.
 */

const ARCHIVER_KEY = `G${"Q".repeat(55)}`;

function run(overrides: Partial<ArchivedPayrollRun> = {}): ArchivedPayrollRun {
  return {
    id: "arc_a",
    payrollRunId: "run_a",
    employerName: "Primary Co",
    employerId: "company_primary",
    payPeriod: "2026-01",
    asset: "USDC",
    status: "archived",
    auditAvailability: "available",
    totalAmount: 87654,
    employeeCount: 3,
    executedAt: "Fri 2026-01-30 10:00 AM WAT (UTC+01:00)",
    transactionHash: "abcdef1234567890abcdef1234567890fedcba",
    bundleId: "CEB-2026-01-001",
    receiptId: "rcpt_2026_01",
    isDisputed: false,
    isArchived: true,
    archivedAt: "Sat 2026-01-31 11:00 AM WAT (UTC+01:00)",
    archivedBy: ARCHIVER_KEY,
    notes: "Ada Okafor bonus included",
    settlementStatus: "settled",
    settlementPending: false,
    ...overrides,
  };
}

const RUNS: ArchivedPayrollRun[] = [
  run(),
  run({ id: "arc_b", payrollRunId: "run_b", payPeriod: "2026-02", asset: "XLM", auditAvailability: "pending" }),
  // Not archived (disputed): must never appear, nor its reason.
  run({
    id: "arc_c",
    payrollRunId: "run_c",
    payPeriod: "2026-03",
    isArchived: false,
    isDisputed: true,
    status: "disputed",
    disputeReason: "Salary mismatch for Ada Okafor",
  }),
];

const PRIVATE_PATTERN = /87654|Ada Okafor|bonus|Salary mismatch|GQQQQ/;

function mockSession(response: { ok: boolean; status?: number; body?: unknown } | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 401),
      json: async () => response.body,
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("evaluateAuditorArchivedPeriodAccess", () => {
  it("returns redacted, read-only archived periods for an auditor (success)", () => {
    const result = evaluateAuditorArchivedPeriodAccess({
      session: { status: "ready", role: "auditor" },
      runs: RUNS,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.readOnly).toBe(true);
    expect(result.periods.map((p) => p.payPeriod)).toEqual(["2026-02", "2026-01"]);
    expect(result.periods[1].auditCoverage).toBe("available");
    expect(result.periods[0].auditCoverage).toBe("partial");

    const serialized = JSON.stringify(result.periods);
    for (const field of AUDITOR_WITHHELD_RUN_FIELDS) {
      expect(serialized).not.toContain(`"${field}"`);
    }
    expect(serialized).not.toMatch(PRIVATE_PATTERN);
    expect(result.periods[1].runs[0].transactionHashPreview).toBe("abcdef12…fedcba");
  });

  it.each([
    [{ status: "ready", role: "operator" } as const, "ROLE_NOT_AUDITOR", "/archive/payroll-runs"],
    [{ status: "ready", role: "admin" } as const, "ROLE_NOT_AUDITOR", "/archive/payroll-runs"],
    [{ status: "unavailable" } as const, "SESSION_UNAVAILABLE", "/login?redirect=%2Faudit%2Farchived-periods"],
  ])("rejects %o with %s and an actionable link", (session, code, href) => {
    const result = evaluateAuditorArchivedPeriodAccess({ session, runs: RUNS });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(code);
    expect(result.action.href).toBe(href);
    expect(JSON.stringify(result)).not.toMatch(PRIVATE_PATTERN);
  });

  it("offers a retry when the session service fails", () => {
    const result = evaluateAuditorArchivedPeriodAccess({ session: { status: "error" }, runs: RUNS });
    expect(result).toMatchObject({ ok: false, code: "SESSION_CHECK_FAILED", action: { kind: "retry" } });
  });

  it("does not reveal non-archived runs when their period is requested (boundary)", () => {
    const result = evaluateAuditorArchivedPeriodAccess({
      session: { status: "ready", role: "auditor" },
      runs: RUNS,
      period: "2026-03",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("PERIOD_NOT_ARCHIVED");
    expect(result.message).not.toMatch(/disput|run_c|arc_c/i);
    expect(JSON.stringify(result)).not.toMatch(PRIVATE_PATTERN);
  });

  it("rejects malformed period input without echoing it", () => {
    const result = evaluateAuditorArchivedPeriodAccess({
      session: { status: "ready", role: "auditor" },
      runs: RUNS,
      period: "<script>2026-13",
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID_PERIOD" });
    if (result.ok) return;
    expect(result.message).not.toContain("<script>");
  });

  it("narrows to an exact archived period and skips malformed records (boundary)", () => {
    const malformed = { ...run({ id: "arc_bad" }), payPeriod: "" } as ArchivedPayrollRun;
    const result = evaluateAuditorArchivedPeriodAccess({
      session: { status: "ready", role: "auditor" },
      runs: [...RUNS, malformed],
      period: " 2026-01 ",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.periods).toHaveLength(1);
    expect(result.periods[0].payPeriod).toBe("2026-01");
    expect(result.skippedCount).toBe(1);
  });

  it("returns an empty, successful view when nothing is archived (boundary)", () => {
    const grouped = groupArchivedPeriodsForAuditor([run({ isArchived: false })]);
    expect(grouped).toEqual({ periods: [], skippedCount: 0 });
    expect(previewTransactionHash("")).toBe("—");
    expect(previewTransactionHash("short")).toBe("short");
  });
});

describe("AuditorArchivedPeriodsView", () => {
  it("renders archived periods for an auditor session with private fields withheld", async () => {
    const fetchMock = mockSession({ ok: true, body: { role: "auditor", publicKey: ARCHIVER_KEY } });
    const { container } = render(<AuditorArchivedPeriodsView runs={RUNS} />);

    const period = await screen.findByTestId("auditor-period-2026-01");
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", expect.objectContaining({ method: "GET" }));
    expect(within(period).getByText("run_a")).toBeInTheDocument();
    expect(within(period).getByText("Withheld")).toBeInTheDocument();
    expect(screen.queryByTestId("auditor-run-arc_c")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument(); // read-only
    expect(container.textContent).not.toMatch(PRIVATE_PATTERN);
  });

  it("shows an actionable message to an operator without loading payroll data", async () => {
    mockSession({ ok: true, body: { role: "operator" } });
    const { container } = render(<AuditorArchivedPeriodsView runs={RUNS} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("data-code", "ROLE_NOT_AUDITOR");
    expect(within(alert).getByRole("link", { name: "Open Payroll Archive Center" })).toHaveAttribute(
      "href",
      "/archive/payroll-runs",
    );
    expect(screen.queryByTestId("auditor-period-2026-01")).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(PRIVATE_PATTERN);
  });

  it("asks an expired session to sign in again", async () => {
    mockSession({ ok: false, status: 401, body: { error: "No session" } });
    render(<AuditorArchivedPeriodsView runs={RUNS} />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("data-code", "SESSION_UNAVAILABLE");
    expect(within(alert).getByRole("link", { name: "Sign in again" })).toBeInTheDocument();
  });

  it("recovers after a failed session check is retried", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ role: "auditor" }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<AuditorArchivedPeriodsView runs={RUNS} />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("data-code", "SESSION_CHECK_FAILED");

    await userEvent.click(within(alert).getByRole("button", { name: "Retry access check" }));
    await waitFor(() => expect(screen.getByTestId("auditor-period-2026-02")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows the empty state when no periods are archived (boundary)", async () => {
    mockSession({ ok: true, body: { role: "auditor" } });
    render(<AuditorArchivedPeriodsView runs={[]} />);
    expect(await screen.findByTestId("auditor-archive-empty")).toBeInTheDocument();
  });
});
