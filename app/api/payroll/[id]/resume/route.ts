import { NextRequest } from "next/server";
import { z } from "zod";
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { withCors, handleOptions } from "@/lib/api/cors";
import { parseBody } from "@/lib/api/validation";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import type { PayrollRun } from "@/types/models";

// ─── Request Schema ───────────────────────────────────────────────────────────

/**
 * Body sent by an admin to resume an interrupted batch payroll run.
 *
 * `reviewedAt`  — ISO-8601 timestamp confirming the admin reviewed the run
 *                 state before resuming (required for audit trail).
 * `acknowledgedInterruption` — explicit boolean: the admin confirms they have
 *                 reviewed the interrupted state. Defaults to false and must
 *                 be `true` to proceed.
 *
 * NOTE: raw salary amounts are never accepted or returned here.
 */
const resumePayrollSchema = z.object({
  reviewedAt: z.string().datetime({ message: "reviewedAt must be a valid ISO-8601 date-time" }),
  acknowledgedInterruption: z.literal(true, {
    errorMap: () => ({
      message:
        "acknowledgedInterruption must be true — confirm you have reviewed the interrupted state.",
    }),
  }),
  /** Optional operator note; must not contain raw salary figures. */
  note: z
    .string()
    .max(500, "Note must be 500 characters or fewer")
    .optional(),
});

type ResumePayrollInput = z.infer<typeof resumePayrollSchema>;

/** Statuses from which a run can legitimately be resumed. */
const RESUMABLE_STATUSES: PayrollRun["status"][] = ["pending", "failed"];

interface RouteContext {
  params: { id: string };
}

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

/**
 * POST /api/payroll/:id/resume
 *
 * Resumes an interrupted batch payroll run.
 *
 * Authorization:   Requires `Authorization: Bearer <jwt>` with role "admin".
 * Idempotency:     Returns 200 with the current run if it is already "verified".
 * Failure safety:  Never exposes raw salary amounts in the response.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  // ── 1. Authorization ──────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return withCors(
      errorResponse("UNAUTHORIZED", "Authorization header missing.", 401),
      request,
    );
  }

  let actorPublicKey = "unknown";
  let actorRole = "unknown";
  try {
    const tokenPart = authHeader.split(" ")[1];
    const decoded = Buffer.from(tokenPart.split(".")[1] ?? "", "base64").toString();
    const payload = JSON.parse(decoded) as { role?: string; publicKey?: string };
    actorRole = payload.role ?? "unknown";
    actorPublicKey = payload.publicKey ?? "unknown";
  } catch {
    return withCors(
      errorResponse("UNAUTHORIZED", "Invalid authorization token.", 401),
      request,
    );
  }

  if (actorRole !== "admin") {
    return withCors(
      errorResponse("FORBIDDEN", "Admin role required to resume a payroll run.", 403),
      request,
    );
  }

  // ── 2. Find run ───────────────────────────────────────────────────────────
  const run = MOCK_PAYROLL_RUNS.find((p: PayrollRun) => p.id === params.id);
  if (!run) {
    return withCors(notFoundResponse("Payroll run"), request);
  }

  // ── 3. Idempotency: already completed ─────────────────────────────────────
  if (run.status === "verified") {
    return withCors(
      successResponse(sanitizeRun(run), {
        alreadyCompleted: true,
        message: "Payroll run is already in a verified (completed) state.",
      }),
      request,
    );
  }

  // ── 4. Resumable status check ──────────────────────────────────────────────
  if (!RESUMABLE_STATUSES.includes(run.status)) {
    return withCors(
      errorResponse(
        "NOT_RESUMABLE",
        `Payroll run cannot be resumed from status "${run.status}". Only failed or pending runs are resumable.`,
        422,
      ),
      request,
    );
  }

  // ── 5. Validate body ──────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withCors(
      errorResponse("BAD_REQUEST", "Request body must be valid JSON.", 400),
      request,
    );
  }

  const parsed = parseBody(resumePayrollSchema, body);
  if (!parsed.success) {
    return withCors(validationErrorResponse(parsed.errors), request);
  }

  const input = parsed.data as ResumePayrollInput;

  // ── 6. Build resumed run ──────────────────────────────────────────────────
  const resumedRun: PayrollRun = {
    ...run,
    status: "pending",
    reconciliationStatus: run.reconciliationStatus === "failed" ? "pending" : run.reconciliationStatus,
    approvalHistory: [
      ...(run.approvalHistory ?? []),
      {
        approvedBy: actorPublicKey,
        approvedAt: input.reviewedAt,
        role: actorRole,
        action: "resubmitted",
        comment: input.note
          ? `Run resumed after interruption review. Note: ${input.note}`
          : "Run resumed after interruption review.",
      },
    ],
  };

  return withCors(
    successResponse(sanitizeRun(resumedRun), {
      message: "Payroll run resumed successfully and re-queued for processing.",
      resumedBy: actorPublicKey,
      resumedAt: input.reviewedAt,
    }),
    request,
  );
}

/**
 * Strip raw `totalAmount` from the API response to avoid exposing sensitive
 * payroll figures.  We return `employeeCount` and run metadata only.
 */
function sanitizeRun(run: PayrollRun): Omit<PayrollRun, "totalAmount"> & { totalAmount: never } {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { totalAmount: _omit, ...safe } = run;
  return safe as Omit<PayrollRun, "totalAmount"> & { totalAmount: never };
}
