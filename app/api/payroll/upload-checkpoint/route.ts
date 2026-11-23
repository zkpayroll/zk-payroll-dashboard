import { NextRequest } from "next/server";
import { z } from "zod";
import {
  successResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { withCors, handleOptions } from "@/lib/api/cors";
import { parseBody, saveUploadCheckpointSchema } from "@/lib/api/validation";
import type { UploadCheckpoint, UploadCheckpointQueryResult } from "@/types/models";

// ─── In-memory checkpoint store (demo) ───────────────────────────────────────
//
// In production this would be a database write keyed by operator session.
// For the dashboard demo layer a module-level map is sufficient because the
// route runs server-side and the client also keeps its own localStorage copy
// via usePayrollUploadCheckpointStore.

const checkpointStore = new Map<string, UploadCheckpoint>();

/** Checkpoints older than this are not returned as recoverable. */
const MAX_AGE_SECONDS = 24 * 60 * 60; // 24 hours

// ─── Recovery hint lookup ─────────────────────────────────────────────────────

const RECOVERY_HINTS: Record<string, string> = {
  draft_started:
    "Employee selection was completed. Return to Review to verify the batch before generating a proof.",
  proof_generated:
    "A ZK proof was generated. Continue to the Confirmation step to review the proof before submitting.",
  confirmed:
    "The batch was confirmed. Proceed to the Submit step to dispatch the transaction.",
  submitting:
    "Submission was in progress when the session was interrupted. Check the payroll run status before retrying.",
  completed:
    "This payroll run completed successfully. No recovery is needed.",
};

// ─── Query schema ─────────────────────────────────────────────────────────────

const checkpointQuerySchema = z.object({
  runId: z.string().min(1, "runId query parameter is required"),
});

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

/**
 * GET /api/payroll/upload-checkpoint?runId=<id>
 *
 * Returns the most recent checkpoint for the given runId, plus staleness
 * metadata that the recovery banner uses to decide whether to show itself.
 *
 * Sensitive fields are never stored or returned — amounts, employee IDs,
 * wallet addresses, and proof data are excluded by design.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryParsed = checkpointQuerySchema.safeParse({
    runId: searchParams.get("runId"),
  });

  if (!queryParsed.success) {
    return withCors(
      validationErrorResponse(queryParsed.error.issues),
      request,
    );
  }

  const { runId } = queryParsed.data;
  const checkpoint = checkpointStore.get(runId) ?? null;

  let ageSeconds: number | null = null;
  let isRecoverable = false;

  if (checkpoint) {
    ageSeconds = Math.floor(
      (Date.now() - new Date(checkpoint.savedAt).getTime()) / 1000,
    );
    isRecoverable =
      checkpoint.stage !== "completed" && ageSeconds < MAX_AGE_SECONDS;
  }

  const result: UploadCheckpointQueryResult = {
    checkpoint,
    isRecoverable,
    ageSeconds,
  };

  return withCors(successResponse(result), request);
}

/**
 * POST /api/payroll/upload-checkpoint
 *
 * Records a recovery checkpoint for an in-progress payroll upload.
 *
 * Authorization:  Requires `Authorization: Bearer <jwt>`.
 * Idempotency:    Subsequent POSTs for the same runId overwrite the previous
 *                 checkpoint (last-write wins). A completed checkpoint is
 *                 never overwritten by an earlier stage.
 * Privacy:        Salary amounts, employee IDs, wallet keys, and raw ZK
 *                 proofs are rejected — the schema enforces this at the
 *                 validation layer.
 */
export async function POST(request: NextRequest) {
  // ── 1. Authorization ──────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return withCors(
      errorResponse("UNAUTHORIZED", "Authorization header missing.", 401),
      request,
    );
  }

  let actorRole = "unknown";
  try {
    const tokenPart = authHeader.split(" ")[1];
    const decoded = Buffer.from(tokenPart.split(".")[1] ?? "", "base64").toString();
    const payload = JSON.parse(decoded) as { role?: string };
    actorRole = payload.role ?? "unknown";
  } catch {
    return withCors(
      errorResponse("UNAUTHORIZED", "Invalid authorization token.", 401),
      request,
    );
  }

  if (actorRole !== "admin" && actorRole !== "operator") {
    return withCors(
      errorResponse(
        "FORBIDDEN",
        "Admin or operator role required to save an upload checkpoint.",
        403,
      ),
      request,
    );
  }

  // ── 2. Parse and validate body ────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withCors(
      errorResponse("BAD_REQUEST", "Request body must be valid JSON.", 400),
      request,
    );
  }

  const parsed = parseBody(saveUploadCheckpointSchema, body);
  if (!parsed.success) {
    return withCors(validationErrorResponse(parsed.errors), request);
  }

  const { runId, stage, employeeCount, proofReady } = parsed.data;

  // ── 3. Idempotency: never regress a completed checkpoint ──────────────────
  const existing = checkpointStore.get(runId);
  if (existing?.stage === "completed" && stage !== "completed") {
    return withCors(
      successResponse(existing, {
        message: "Checkpoint already marked completed — no update applied.",
        alreadyCompleted: true,
      }),
      request,
    );
  }

  // ── 4. Write checkpoint ───────────────────────────────────────────────────
  const checkpoint: UploadCheckpoint = {
    runId,
    stage,
    employeeCount,
    proofReady,
    savedAt: new Date().toISOString(),
    recoveryHint: RECOVERY_HINTS[stage] ?? "",
  };

  checkpointStore.set(runId, checkpoint);

  return withCors(
    createdResponse(checkpoint, {
      message: `Checkpoint saved at stage "${stage}" for run ${runId}.`,
    }),
    request,
  );
}

/**
 * DELETE /api/payroll/upload-checkpoint?runId=<id>
 *
 * Removes the checkpoint for a run after the operator dismisses the recovery
 * banner or after a confirmed successful submission. Idempotent — returns 200
 * even when no checkpoint existed.
 */
export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return withCors(
      errorResponse("UNAUTHORIZED", "Authorization header missing.", 401),
      request,
    );
  }

  const { searchParams } = new URL(request.url);
  const queryParsed = checkpointQuerySchema.safeParse({
    runId: searchParams.get("runId"),
  });

  if (!queryParsed.success) {
    return withCors(
      validationErrorResponse(queryParsed.error.issues),
      request,
    );
  }

  const { runId } = queryParsed.data;
  checkpointStore.delete(runId);

  return withCors(
    successResponse(null, { message: `Checkpoint for run ${runId} removed.` }),
    request,
  );
}
