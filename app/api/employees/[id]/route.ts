import { NextRequest } from "next/server";
import {
  successResponse,
  notFoundResponse,
  validationErrorResponse,
  errorResponse,
} from "@/lib/api/response";
import { withCors, handleOptions } from "@/lib/api/cors";
import { updateEmployeeSchema, parseBody } from "@/lib/api/validation";
import { MOCK_EMPLOYEES } from "@/lib/api/mockData";

interface RouteContext {
  params: { id: string };
}

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const employee = MOCK_EMPLOYEES.find((e) => e.id === params.id);
  if (!employee) return withCors(notFoundResponse("Employee"), request);
  return withCors(successResponse(employee), request);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const employee = MOCK_EMPLOYEES.find((e) => e.id === params.id);
    if (!employee) return withCors(notFoundResponse("Employee"), request);

    const body = await request.json();
    const parsed = parseBody(updateEmployeeSchema, body);
    if (!parsed.success) {
      return withCors(validationErrorResponse(parsed.errors), request);
    }

    const updated = {
      ...employee,
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };
    return withCors(successResponse(updated), request);
  } catch {
    return withCors(
      errorResponse("INTERNAL_ERROR", "Failed to update employee.", 500),
      request,
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const employee = MOCK_EMPLOYEES.find((e) => e.id === params.id);
  if (!employee) return withCors(notFoundResponse("Employee"), request);

  return withCors(successResponse({ deleted: true, id: params.id }), request);
}
