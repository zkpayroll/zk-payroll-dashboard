import { NextRequest } from "next/server";
import {
  successResponse,
  notFoundResponse,
  validationErrorResponse,
  errorResponse,
} from "@/lib/api/response";
import { withCors, handleOptions } from "@/lib/api/cors";
import { updatePayrollStatusSchema, parseBody } from "@/lib/api/validation";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";

interface RouteContext {
  params: { id: string };
}

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const payroll = MOCK_PAYROLL_RUNS.find((p) => p.id === params.id);
  if (!payroll) return withCors(notFoundResponse("Payroll run"), request);
  return withCors(successResponse(payroll), request);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const payroll = MOCK_PAYROLL_RUNS.find((p) => p.id === params.id);
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
