import { NextRequest } from "next/server";
import {
  successResponse,
  createdResponse,
  validationErrorResponse,
  errorResponse,
} from "@/lib/api/response";
import { withCors, handleOptions } from "@/lib/api/cors";
import {
  createEmployeeSchema,
  paginationSchema,
  parseBody,
} from "@/lib/api/validation";
import { MOCK_EMPLOYEES } from "@/lib/api/mockData";

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pagination = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const { page, limit } = pagination;
    const start = (page - 1) * limit;
    const paginated = MOCK_EMPLOYEES.slice(start, start + limit);

    return withCors(
      successResponse(paginated, {
        page,
        limit,
        total: MOCK_EMPLOYEES.length,
        totalPages: Math.ceil(MOCK_EMPLOYEES.length / limit),
      }),
      request,
    );
  } catch {
    return withCors(
      errorResponse("INTERNAL_ERROR", "Failed to fetch employees.", 500),
      request,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseBody(createEmployeeSchema, body);

    if (!parsed.success) {
      return withCors(validationErrorResponse(parsed.errors), request);
    }

    const newEmployee = {
      id: `emp_${Date.now()}`,
      ...parsed.data,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    return withCors(createdResponse(newEmployee), request);
  } catch {
    return withCors(
      errorResponse("INTERNAL_ERROR", "Failed to create employee.", 500),
      request,
    );
  }
}
