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
  postSubmissionAdjustmentSchema,
} from "@/lib/api/validation";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";

const RESERVE_THRESHOLD_MIN = 0;
const RESERVE_THRESHOLD_MAX = 1_000_000_000;

export function validateReserveThresholdException(input: {
  requestedThreshold: unknown;
  currentReserve: unknown;
}): { valid: true; threshold: number } | { valid: false; message: string } {
  const { requestedThreshold, currentReserve } = input;

  if (typeof requestedThreshold !== "number" || !Number.isFinite(requestedThreshold)) {
    return { valid: false, message: "requestedThreshold must be a finite number." };
  }
  if (requestedThreshold < RESERVE_THRESHOLD_MIN || requestedThreshold > RESERVE_THRESHOLD_MAX) {
    return {
      valid: false,
      message: `requestedThreshold must be between ${RESERVE_THRESHOLD_MIN} and ${RESERVE_THRESHOLD_MAX}.`,
    };
  }
  if (typeof currentReserve !== "number" || !Number.isFinite(currentReserve) || currentReserve < 0) {
    return { valid: false, message: "currentReserve must be a non-negative finite number." };
  }
  if (requestedThreshold === currentReserve) {
    return {
      valid: false,
      message: "requestedThreshold must differ from the current reserve; no exception is needed.",
    };
  }

  return { valid: true, threshold: requestedThreshold };
}

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
        total: MOCK_PAYROLL_RUNS.length,
        totalPages: Math.ceil(MOCK_PAYROLL_RUNS.length / limit),
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
      adjustmentLimits: {
        maxAdjustments: 0,
        maxAdjustmentAmount: 0,
        adjustmentsUsed: 0,
        lockedAfterSubmission: true,
      },
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseBody(postSubmissionAdjustmentSchema, body);

    if (!parsed.success) {
      return withCors(validationErrorResponse(parsed.errors), request);
    }

    const payroll = MOCK_PAYROLL_RUNS.find(
      (run) => run.id === parsed.data.payrollId,
    );

    if (!payroll) {
      return withCors(
        errorResponse("NOT_FOUND", "Payroll run not found.", 404),
        request,
      );
    }

    if (payroll.status !== "draft") {
      return withCors(
        errorResponse(
          "ADJUSTMENT_LOCKED",
          "Post-submission adjustments are not allowed for this payroll run.",
          409,
        ),
        request,
      );
    }

    const limits = payroll.adjustmentLimits ?? {
      maxAdjustments: 0,
      maxAdjustmentAmount: 0,
      adjustmentsUsed: 0,
      lockedAfterSubmission: true,
    };

    if (limits.adjustmentsUsed >= limits.maxAdjustments) {
      return withCors(
        errorResponse(
          "ADJUSTMENT_LIMIT_REACHED",
          "Maximum number of post-submission adjustments reached.",
          409,
        ),
        request,
      );
    }

    if (parsed.data.amount > limits.maxAdjustmentAmount) {
      return withCors(
        errorResponse(
          "ADJUSTMENT_AMOUNT_EXCEEDED",
          "Adjustment amount exceeds the allowed limit.",
          422,
        ),
        request,
      );
    }

    const now = new Date().toISOString();
    const updated = {
      ...payroll,
      adjustmentLimits: {
        ...limits,
        adjustmentsUsed: limits.adjustmentsUsed + 1,
      },
      lastUpdated: now,
    };

    return withCors(successResponse(updated), request);
  } catch {
    return withCors(
      errorResponse("INTERNAL_ERROR", "Failed to adjust payroll run.", 500),
      request,
    );
  }
}
