/**
 * Tests — Payroll Upload Recovery Checkpoints
 *
 * Three suites covering:
 *  1. Store (usePayrollUploadCheckpointStore) — unit tests for all state
 *     transitions, the privacy contract, and the 24-hour eviction guard.
 *  2. API route (POST /api/payroll/upload-checkpoint) — success path,
 *     validation failures, auth gate, and idempotency guard.
 *  3. Validation schema (saveUploadCheckpointSchema) — accepted inputs,
 *     rejected inputs, and the edge case of zero-employee batches.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "@/app/api/payroll/upload-checkpoint/route";
import { saveUploadCheckpointSchema } from "@/lib/api/validation";
import { usePayrollUploadCheckpointStore, CHECKPOINT_MAX_AGE_MS } from "@/stores/payrollUploadCheckpoint";
import type { UploadCheckpointStage } from "@/types/models";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a minimal bearer token with the given role — same pattern used by payrollPauseRoute.test.ts */
function tokenFor(role: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64");
  const payload = Buffer.from(JSON.stringify({ role, publicKey: "GADMIN...TEST" })).toString("base64");
  return `${header}.${payload}.sig`;
}

function postRequest(body: Record<string, unknown>, role = "operator"): NextRequest {
  return new NextRequest("http://localhost:3000/api/payroll/upload-checkpoint", {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokenFor(role)}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function getRequest(runId: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/payroll/upload-checkpoint?runId=${encodeURIComponent(runId)}`,
    { method: "GET" },
  );
}

function deleteRequest(runId: string, role = "operator"): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/payroll/upload-checkpoint?runId=${encodeURIComponent(runId)}`,
    {
      method: "DELETE",
      headers: { authorization: `Bearer ${tokenFor(role)}` },
    },
  );
}

// ─── Suite 1: Store unit tests ────────────────────────────────────────────────

describe("usePayrollUploadCheckpointStore", () => {
  beforeEach(() => {
    // Reset store to a clean slate before every test.
    usePayrollUploadCheckpointStore.setState({ checkpoint: null });
  });

  // ── Success path ────────────────────────────────────────────────────────────

  it("saves a checkpoint with the correct stage, count, and hint", () => {
    const { saveCheckpoint } = usePayrollUploadCheckpointStore.getState();
    saveCheckpoint("run_001", "draft_started", 5, false);

    const { checkpoint } = usePayrollUploadCheckpointStore.getState();
    expect(checkpoint).not.toBeNull();
    expect(checkpoint?.runId).toBe("run_001");
    expect(checkpoint?.stage).toBe("draft_started");
    expect(checkpoint?.employeeCount).toBe(5);
    expect(checkpoint?.proofReady).toBe(false);
    expect(checkpoint?.recoveryHint).toMatch(/Employee selection was completed/i);
    expect(checkpoint?.savedAt).toBeDefined();
  });

  it("hasRecoverableCheckpoint returns true for a fresh non-completed checkpoint", () => {
    const { saveCheckpoint, hasRecoverableCheckpoint } =
      usePayrollUploadCheckpointStore.getState();
    saveCheckpoint("run_002", "proof_generated", 3, true);

    expect(hasRecoverableCheckpoint()).toBe(true);
  });

  it("markCompleted advances stage to completed and hasRecoverableCheckpoint returns false", () => {
    const { saveCheckpoint, markCompleted, hasRecoverableCheckpoint } =
      usePayrollUploadCheckpointStore.getState();
    saveCheckpoint("run_003", "submitting", 8, true);
    markCompleted("run_003");

    const { checkpoint } = usePayrollUploadCheckpointStore.getState();
    expect(checkpoint?.stage).toBe("completed");
    expect(hasRecoverableCheckpoint()).toBe(false);
  });

  it("clearCheckpoint removes the stored checkpoint", () => {
    const { saveCheckpoint, clearCheckpoint } =
      usePayrollUploadCheckpointStore.getState();
    saveCheckpoint("run_004", "confirmed", 2, true);
    clearCheckpoint();

    expect(usePayrollUploadCheckpointStore.getState().checkpoint).toBeNull();
  });

  it("isRunRecoverable returns true only for the matching runId", () => {
    const { saveCheckpoint, isRunRecoverable } =
      usePayrollUploadCheckpointStore.getState();
    saveCheckpoint("run_005", "proof_generated", 4, true);

    expect(isRunRecoverable("run_005")).toBe(true);
    expect(isRunRecoverable("run_999")).toBe(false);
  });

  // ── Failure / error path ────────────────────────────────────────────────────

  it("markCompleted is a no-op when the runId does not match", () => {
    const { saveCheckpoint, markCompleted } =
      usePayrollUploadCheckpointStore.getState();
    saveCheckpoint("run_006", "draft_started", 1, false);
    markCompleted("run_OTHER");

    // Stage must remain unchanged
    expect(usePayrollUploadCheckpointStore.getState().checkpoint?.stage).toBe("draft_started");
  });

  it("saveCheckpoint does not overwrite a completed checkpoint with an earlier stage", () => {
    const { saveCheckpoint, markCompleted } =
      usePayrollUploadCheckpointStore.getState();
    saveCheckpoint("run_007", "submitting", 6, true);
    markCompleted("run_007");

    // Attempt to regress to an earlier stage
    saveCheckpoint("run_007", "proof_generated", 6, true);

    expect(usePayrollUploadCheckpointStore.getState().checkpoint?.stage).toBe("completed");
  });

  // ── Edge case ───────────────────────────────────────────────────────────────

  it("evictStaleCheckpoint removes a checkpoint older than CHECKPOINT_MAX_AGE_MS", () => {
    const { saveCheckpoint, evictStaleCheckpoint } =
      usePayrollUploadCheckpointStore.getState();

    // Write a checkpoint then manually backdate savedAt past the max age.
    saveCheckpoint("run_008", "draft_started", 2, false);
    const staleTime = new Date(Date.now() - CHECKPOINT_MAX_AGE_MS - 1000).toISOString();
    usePayrollUploadCheckpointStore.setState((s) => ({
      checkpoint: s.checkpoint ? { ...s.checkpoint, savedAt: staleTime } : null,
    }));

    evictStaleCheckpoint();

    expect(usePayrollUploadCheckpointStore.getState().checkpoint).toBeNull();
  });

  it("evictStaleCheckpoint keeps a fresh checkpoint untouched", () => {
    const { saveCheckpoint, evictStaleCheckpoint } =
      usePayrollUploadCheckpointStore.getState();
    saveCheckpoint("run_009", "confirmed", 3, true);
    evictStaleCheckpoint();

    // Fresh checkpoint must survive eviction
    expect(usePayrollUploadCheckpointStore.getState().checkpoint).not.toBeNull();
  });

  it("never stores salary amounts — only employeeCount is recorded", () => {
    const { saveCheckpoint } = usePayrollUploadCheckpointStore.getState();
    // The API accepts only (runId, stage, employeeCount, proofReady)
    // — there is no parameter for amount, so this test validates the
    // type contract itself by asserting the checkpoint has no amount field.
    saveCheckpoint("run_010", "draft_started", 7, false);

    const { checkpoint } = usePayrollUploadCheckpointStore.getState();
    expect(checkpoint).not.toHaveProperty("totalAmount");
    expect(checkpoint).not.toHaveProperty("employeeIds");
    expect(checkpoint).not.toHaveProperty("proof");
  });
});

// ─── Suite 2: API route tests ─────────────────────────────────────────────────

describe("POST /api/payroll/upload-checkpoint", () => {
  // ── Success path ────────────────────────────────────────────────────────────

  it("returns 201 and the saved checkpoint for a valid operator request", async () => {
    const res = await POST(
      postRequest({ runId: "api_run_001", stage: "draft_started", employeeCount: 5, proofReady: false }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.runId).toBe("api_run_001");
    expect(json.data.stage).toBe("draft_started");
    expect(json.data.employeeCount).toBe(5);
    expect(json.data.proofReady).toBe(false);
    expect(json.data.savedAt).toBeDefined();
    expect(json.data.recoveryHint).toBeTruthy();
  });

  it("accepts an admin role as well as operator", async () => {
    const res = await POST(
      postRequest({ runId: "api_run_002", stage: "proof_generated", employeeCount: 3, proofReady: true }, "admin"),
    );
    expect(res.status).toBe(201);
  });

  it("GET returns the stored checkpoint as recoverable when not completed", async () => {
    await POST(
      postRequest({ runId: "api_run_003", stage: "confirmed", employeeCount: 4, proofReady: true }),
    );
    const res = await GET(getRequest("api_run_003"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.isRecoverable).toBe(true);
    expect(json.data.checkpoint?.stage).toBe("confirmed");
    expect(json.data.ageSeconds).toBeGreaterThanOrEqual(0);
  });

  it("DELETE removes the checkpoint; subsequent GET returns isRecoverable: false", async () => {
    await POST(
      postRequest({ runId: "api_run_del_01", stage: "submitting", employeeCount: 6, proofReady: true }),
    );
    const delRes = await DELETE(deleteRequest("api_run_del_01"));
    expect(delRes.status).toBe(200);

    const getRes = await GET(getRequest("api_run_del_01"));
    const json = await getRes.json();
    expect(json.data.isRecoverable).toBe(false);
    expect(json.data.checkpoint).toBeNull();
  });

  // ── Failure path ────────────────────────────────────────────────────────────

  it("returns 401 when no authorization header is present", async () => {
    const req = new NextRequest("http://localhost:3000/api/payroll/upload-checkpoint", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: "r1", stage: "draft_started", employeeCount: 1, proofReady: false }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 for a viewer role", async () => {
    const res = await POST(
      postRequest({ runId: "r2", stage: "draft_started", employeeCount: 1, proofReady: false }, "viewer"),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("returns 422 when stage is an invalid value", async () => {
    const res = await POST(
      postRequest({ runId: "r3", stage: "invalid_stage", employeeCount: 2, proofReady: false }),
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 when employeeCount is negative", async () => {
    const res = await POST(
      postRequest({ runId: "r4", stage: "draft_started", employeeCount: -1, proofReady: false }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 when runId is missing", async () => {
    const res = await POST(
      postRequest({ stage: "draft_started", employeeCount: 2, proofReady: false }),
    );
    expect(res.status).toBe(422);
  });

  // ── Edge case: idempotency guard ────────────────────────────────────────────

  it("does not overwrite a completed checkpoint with an earlier stage", async () => {
    const runId = "api_idem_001";
    // First: advance to completed
    await POST(postRequest({ runId, stage: "completed", employeeCount: 5, proofReady: true }));
    // Then: attempt to regress to an earlier stage
    const res = await POST(postRequest({ runId, stage: "proof_generated", employeeCount: 5, proofReady: true }));
    expect(res.status).toBe(200); // returns existing checkpoint, not 201
    const json = await res.json();
    expect(json.meta?.alreadyCompleted).toBe(true);
    // The checkpoint stage must remain "completed"
    expect(json.data.stage).toBe("completed");
  });
});

// ─── Suite 3: Validation schema ───────────────────────────────────────────────

describe("saveUploadCheckpointSchema", () => {
  const valid = { runId: "run_v01", stage: "draft_started" as UploadCheckpointStage, employeeCount: 4, proofReady: false };

  it("accepts a fully valid payload", () => {
    const result = saveUploadCheckpointSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts every defined stage value", () => {
    const stages: UploadCheckpointStage[] = ["draft_started", "proof_generated", "confirmed", "submitting", "completed"];
    for (const stage of stages) {
      const result = saveUploadCheckpointSchema.safeParse({ ...valid, stage });
      expect(result.success, `stage "${stage}" should be valid`).toBe(true);
    }
  });

  // ── Failure path ────────────────────────────────────────────────────────────

  it("rejects an unknown stage", () => {
    const result = saveUploadCheckpointSchema.safeParse({ ...valid, stage: "uploading" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing runId", () => {
    const { runId: _omit, ...rest } = valid;
    const result = saveUploadCheckpointSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a negative employeeCount", () => {
    const result = saveUploadCheckpointSchema.safeParse({ ...valid, employeeCount: -5 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer employeeCount", () => {
    const result = saveUploadCheckpointSchema.safeParse({ ...valid, employeeCount: 2.5 });
    expect(result.success).toBe(false);
  });

  // ── Edge case: zero employees ───────────────────────────────────────────────

  it("accepts employeeCount of 0 (empty-batch edge case)", () => {
    const result = saveUploadCheckpointSchema.safeParse({ ...valid, employeeCount: 0 });
    expect(result.success).toBe(true);
  });

  it("does not accept a totalAmount field — schema enforces privacy contract", () => {
    // The schema has no totalAmount field; extra keys are stripped by Zod.
    const result = saveUploadCheckpointSchema.safeParse({ ...valid, totalAmount: 99999 });
    // Parsing still succeeds (Zod strips unknown keys), but the parsed
    // output must not carry totalAmount.
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("totalAmount");
    }
  });
});
