import { describe, it, expect } from "vitest";
import { PUT, DELETE } from "@/app/api/payroll/[id]/pause/route";
import { NextRequest } from "next/server";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";

// A pre-paused fixture (#665) pushed directly onto the shared
// MOCK_PAYROLL_RUNS array, local to this test file only — MOCK_TRANSACTIONS
// itself deliberately stays untouched, since several other test files
// (transaction-history, quick-filters, export-review-gate) assert exact
// counts over it. This route's mock API layer also never writes its
// `updated` object back into MOCK_PAYROLL_RUNS (see the GET/PATCH/DELETE
// handlers), so pausing tx_002 and then immediately resuming it in the same
// test would still read tx_002's original, unmutated "verified" status — a
// pre-paused row is needed instead to exercise the resume path.
const PAUSED_FIXTURE_ID = "tx_paused_fixture";
MOCK_PAYROLL_RUNS.push({
  id: PAUSED_FIXTURE_ID,
  companyId: "company_001",
  timestamp: "2025-06-15T09:00:00Z",
  createdAt: "2025-06-15T09:00:00Z",
  totalAmount: 32000,
  employeeCount: 4,
  proof: "0xzkproof_paused_fixture",
  status: "paused",
  statusBeforePause: "pending",
  pausedAt: "2025-06-16T10:00:00Z",
  pausedBy: "GADMIN_FIXTURE_KEY",
  pauseReason: "Suspected duplicate batch under review",
  employeeIds: ["emp_fixture_1"],
  isArchived: false,
});

/**
 * Builds a mock bearer token in the same unverified-JWT-payload shape the
 * existing DELETE /api/payroll/[id] (cancel) handler already trusts, so
 * these tests exercise the pause route's own authorization gate under the
 * same convention the rest of this API uses.
 */
function tokenFor(role: string, publicKey = "GADMIN...TEST") {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64");
  const payload = Buffer.from(JSON.stringify({ role, publicKey })).toString("base64");
  return `${header}.${payload}.signature`;
}

function pauseRequest(id: string, role: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost:3000/api/payroll/${id}/pause`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${tokenFor(role)}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function resumeRequest(id: string, role: string, body: Record<string, unknown> = {}) {
  return new NextRequest(`http://localhost:3000/api/payroll/${id}/pause`, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${tokenFor(role)}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/payroll/[id]/pause (Issue #665)", () => {
  it("pauses a run for an admin, recording who paused it and why", async () => {
    const response = await PUT(pauseRequest("tx_001", "admin", { reason: "Suspected duplicate batch" }), {
      params: { id: "tx_001" },
    });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("paused");
    expect(json.data.pauseReason).toBe("Suspected duplicate batch");
    expect(json.data.pausedBy).toBe("GADMIN...TEST");
    expect(json.data.statusBeforePause).toBe("verified");
  });

  it("rejects a pause attempt from a non-admin role", async () => {
    const response = await PUT(pauseRequest("tx_001", "operator", { reason: "Trying to pause" }), {
      params: { id: "tx_001" },
    });
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("rejects a pause request with no authorization header", async () => {
    const request = new NextRequest("http://localhost:3000/api/payroll/tx_001/pause", {
      method: "PUT",
      body: JSON.stringify({ reason: "No auth" }),
    });
    const response = await PUT(request, { params: { id: "tx_001" } });
    expect(response.status).toBe(401);
  });

  it("requires a reason of at least 3 characters", async () => {
    const response = await PUT(pauseRequest("tx_001", "admin", { reason: "x" }), {
      params: { id: "tx_001" },
    });
    expect(response.status).toBe(422);
  });

  it("returns 404 for an unknown payroll run id", async () => {
    const response = await PUT(pauseRequest("tx_does_not_exist", "admin", { reason: "Testing 404" }), {
      params: { id: "tx_does_not_exist" },
    });
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/payroll/[id]/pause — resume (Issue #665)", () => {
  it("resumes a paused run for an admin, restoring its prior status", async () => {
    const response = await DELETE(resumeRequest(PAUSED_FIXTURE_ID, "admin"), { params: { id: PAUSED_FIXTURE_ID } });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("pending");
    expect(json.data.pausedAt).toBeNull();
    expect(json.data.pauseReason).toBeNull();
  });

  it("rejects a resume attempt from a non-admin role", async () => {
    const response = await DELETE(resumeRequest(PAUSED_FIXTURE_ID, "operator"), { params: { id: PAUSED_FIXTURE_ID } });
    expect(response.status).toBe(403);
  });

  it("returns 409 when resuming a run that is not paused", async () => {
    const response = await DELETE(resumeRequest("tx_003", "admin"), { params: { id: "tx_003" } });
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error.code).toBe("CONFLICT");
  });

  it("returns 409 when attempting to pause a run that is already paused", async () => {
    const response = await PUT(pauseRequest(PAUSED_FIXTURE_ID, "admin", { reason: "Double pause attempt" }), {
      params: { id: PAUSED_FIXTURE_ID },
    });
    expect(response.status).toBe(409);
  });

  it("returns 409 when attempting to pause a cancelled run", async () => {
    const response = await PUT(pauseRequest("tx_004", "admin", { reason: "Trying to pause cancelled run" }), {
      params: { id: "tx_004" },
    });
    expect(response.status).toBe(409);
  });
});
