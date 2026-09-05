import { NextRequest } from "next/server";

import {
  successResponse,
  createdResponse,
  validationErrorResponse,
  errorResponse,
} from "@/lib/api/response";
import { withCors, handleOptions } from "@/lib/api/cors";
import {
  createPayrollSchema,
  paginationSchema,
  parseBody,
} from "@/lib/api/validation";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, limit } = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const start = (page - 1) * limit;
    const paginated = MOCK_PAYROLL_RUNS.slice(start, start + limit).map(
      (payroll) => ({
        ...payroll,
        lastUpdated:
          payroll.lastUpdated ?? payroll.updatedAt ?? payroll.createdAt,
      }),
    );

    return withCors(
      successResponse(paginated, {
        page,
        limit,
        total: MOCK_PAYKROLL_RUNS.length,
        totalPages: Math.ceil(MOCK_PAYKROLL_RUNS.length / limit),
      }),
      request,
    );
  } catch {
    return withCors(
      errorResponse("INTERNAL_ERROR", "Failed to fetch payroll runs.", 500),
      request,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseBody(createPayrollSchema, body);

    if (!parsed.success) {
      return withCors(validationErrorResponse(parsed.errors), request);
    }

    const now = new Date().toISOString();
    const newPayroll = {
      id: `pay_${Date.now()}`,
      ...parsed.data,
      status: "draft",
      executedAt: null,
      transactionHash: null,
      totalAmount: 0,
      employeeCount: parsed.data.employeeIds.length,
      createdAt: now,
      lastUpdated: now,
    };

    return withCors(createdResponse(newPayroll), request);
  } catch {
    return withCors(
      errorResponse("INTERNAL_ERROR", "Failed to create payroll run.", 500),
      request,
    );
  }
}
