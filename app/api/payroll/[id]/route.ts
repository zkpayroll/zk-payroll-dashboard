import { NextRequest } from "next/server";
import { PayrollRun } from "@types/models";
import { Z } from "zod";
import {
  successResponse,
  notFoundResponse,
  validationErrorResponse,
  errorResponse,
} from "@lib/api/response";
import { withCors, handleOptions } from "@lib/api/cors";
import { updatePayrollStatusSchema, parseBody, cancelPayrollSchema } from "@lib/api/validation";
import { MOCK_PAYROLL_RUNS } from "@lib/api/mockData";

interface RouteContext {
  params: { id: string };
}

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const payroll = MOCK_PAYROLL_RUNS.find((p: PayrollRun) => p.id === params.id);
  if (!payroll) return withCors(notFoundResponse("Payroll run"), request);
  // Ensure the response includes an updatedAt timestamp for display.
  // If the mock data doesn't have one, fall back to createdAt or null.
  const enrichedPayroll = {
    ...payroll,
    updatedAt: payroll.updatedAt ?? payroll.createdAt ?? null,
  };
  return withCors(successResponse(enrichedPayroll), request);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const payroll = MOCK_PAYROLL_RUNS.find((p: PayrollRun) => p.id === params.id);
    if (!payroll) return withCors(notFoundResponse("Payroll run"), request);

    const body = await request.json();
    const parsed = parseBody(updatePayrollStatusSchema, body);
    if (!parsed.success) {
      return withCors(validationErrorResponse(parsed.errors), request);
    }

    const updated = {
      ...payroll,
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };
    return withCors(successResponse(updated), request);
  } catch {
    return withCors(
      errorResponse("INTERNAL_ERROR", "Failed to update payroll run.", 500),
      request,
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const payroll = MOCK_PAYROLL_RUNS.find((p: PayrollRun) => p.id === params.id);
    if (!payroll) return withCors(notFoundResponse("Payroll run"), request);

    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return withCors(
        errorResponse("UNAUTHORIZED\", "Authorization header missing.", 401),
        request,
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded = Buffer.from(token.split(".")[1], "base64").toString();
    const payload = JSON.parse(decoded);

    if (payload.role !== "admin") {
      return withCors(
        errorResponse("FORBIDDEN", "Admin role required to cancel payroll.", 403),
        request,
      );
    }

    const body = await request.json();
    const parsed = parseBody(cancelPayrollSchema, body);
    if (!parsed.success) {
      return withCors(validationErrorResponse(parsed.errors), request);
    }

    const updated = {
      ...payroll,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      cancelledBy: payload.publicKey,
      cancellationReason: body.reason || "Admin cancellation",
      updatedAt: new Date().toISOString(),
    };

    return withCors(successResponse(updated), request);
  } catch {
    return withCors(
      errorResponse("INTERNAL_ERROR", "Failed to cancel payroll run.", 500),
      request,
    );
  }
}