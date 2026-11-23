import { NextRequest } from "next/server";
import { PayrollRun } from "@/types/models";
import {
  successResponse,
  notFoundResponse,
  validationErrorResponse,
  errorResponse,
} from "@/lib/api/response";
import { withCors, handleOptions } from "@/lib/api/cors";
import { parseBody, pausePayrollSchema, resumePayrollSchema } from "@/lib/api/validation";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";

interface RouteContext {
  params: { id: string };
}

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

/**
 * Emergency payroll pause (#665).
 *
 * Mirrors the admin-role gate the DELETE (cancel) handler already uses
 * (same JWT-payload decode, same convention) but, unlike cancellation, this
 * is reversible: PUT pauses an in-flight run, DELETE resumes it. A paused
 * run must never be released to settlement — callers that dispatch payroll
 * execution are expected to check `status !== "paused"` before proceeding.
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const payroll = MOCK_PAYROLL_RUNS.find((p: PayrollRun) => p.id === params.id);
    if (!payroll) return withCors(notFoundResponse("Payroll run"), request);

    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return withCors(
        errorResponse("UNAUTHORIZED", "Authorization header missing.", 401),
        request,
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded = Buffer.from(token.split(".")[1], "base64").toString();
    const payload = JSON.parse(decoded);

    // Emergency pause is admin-only (#665) — stricter than cancellation,
    // which also allows operators. Pausing and resuming share this gate.
    if (payload.role !== "admin") {
      return withCors(
        errorResponse("FORBIDDEN", "Admin role required to pause payroll.", 403),
        request,
      );
    }

    if (payroll.status === "cancelled") {
      return withCors(
        errorResponse("CONFLICT", "A cancelled payroll run cannot be paused.", 409),
        request,
      );
    }
    if (payroll.status === "paused") {
      return withCors(
        errorResponse("CONFLICT", "This payroll run is already paused.", 409),
        request,
      );
    }

    const body = await request.json();
    const parsed = parseBody(pausePayrollSchema, body);
    if (!parsed.success) {
      return withCors(validationErrorResponse(parsed.errors), request);
    }

    const statusBeforePause = payroll.status === "verified" ? "verified" : "pending";

    const updated = {
      ...payroll,
      status: "paused" as const,
      statusBeforePause,
      pausedAt: new Date().toISOString(),
      pausedBy: payload.publicKey,
      pauseReason: parsed.data.reason,
      updatedAt: new Date().toISOString(),
    };

    return withCors(successResponse(updated), request);
  } catch {
    return withCors(
      errorResponse("INTERNAL_ERROR", "Failed to pause payroll run.", 500),
      request,
    );
  }
}

/** Resumes a paused run, restoring the status it held before the pause. */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const payroll = MOCK_PAYROLL_RUNS.find((p: PayrollRun) => p.id === params.id);
    if (!payroll) return withCors(notFoundResponse("Payroll run"), request);

    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return withCors(
        errorResponse("UNAUTHORIZED", "Authorization header missing.", 401),
        request,
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded = Buffer.from(token.split(".")[1], "base64").toString();
    const payload = JSON.parse(decoded);

    if (payload.role !== "admin") {
      return withCors(
        errorResponse("FORBIDDEN", "Admin role required to resume payroll.", 403),
        request,
      );
    }

    if (payroll.status !== "paused") {
      return withCors(
        errorResponse("CONFLICT", "This payroll run is not currently paused.", 409),
        request,
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = parseBody(resumePayrollSchema, body);
    if (!parsed.success) {
      return withCors(validationErrorResponse(parsed.errors), request);
    }

    const updated = {
      ...payroll,
      status: payroll.statusBeforePause ?? "pending",
      statusBeforePause: undefined,
      pausedAt: null,
      pausedBy: null,
      pauseReason: null,
      updatedAt: new Date().toISOString(),
    };

    return withCors(successResponse(updated), request);
  } catch {
    return withCors(
      errorResponse("INTERNAL_ERROR", "Failed to resume payroll run.", 500),
      request,
    );
  }
}
