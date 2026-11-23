import { NextRequest } from "next/server";
import { PayrollRun } from "@/types/models";
import { z } from "zod";
import {
  successResponse,
  notFoundResponse,
  validationErrorResponse,
  errorResponse,
} from "@/lib/api/response";
import { withCors, handleOptions } from "@/lib/api/cors";
import { updatePayrollStatusSchema, parseBody, cancelPayrollSchema } from "@/lib/api/validation";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";

interface RouteContext {
  params: { id: string };
}

// Post-submission adjustment limits.
const MAX_ADJUSTMENTS_PER_PAYROLL = 5;
const MAX_ADJUSTMENT_AMOUNT = 10000;
const ADJUSTABLE_STATUSES = new Set<PayrollRun["status"]>(["draft", "pending", "failed"]);

// Reserve threshold exception approvals.
// A reserve threshold exception allows a payroll run to proceed when the
// dashboard reserve balance would otherwise fall below the configured minimum.
// Each exception must be explicitly approved by an admin, and the approval is
// recorded with the approver's identity and a justification.
const MAX_RESERVE_EXCEPTION_REASON_LENGTH = 500;
const RESERVE_EXCEPTION_ALLOWED_STATUSES = new Set<PayrollRun["status"]>(["draft", "pending"]);

export const reserveThresholdExceptionSchema = z.object({
  reserveThresholdException: z.object({
    action: z.literal("approve"),
    requestedAmount: z.number().positive().finite(),
    reason: z
      .string()
      .trim()
      .min(1, "A justification is required for a reserve threshold exception.")
      .max(
        MAX_RESERVE_EXCEPTION_REASON_LENGTH,
        `Reason must be at most ${MAX_RESERVE_EXCEPTION_REASON_LENGTH} characters.`,
      ),
  }),
});

export const adjustmentLimitsSchema = z.object({
  adjustments: z.array(
    z.object({
      type: z.enum([
        "amount_change",
        "recipient_change",
        "memo_change",
        "delay",
      ], { invalid_type_error: "Unsupported adjustment type." }),
      amount: z.number().positive().finite().optional(),
      recipientId: z.string().min(1).optional(),
      memo: z.string().max(280).optional(),
      delayDays: z.number().int().min(0).max(30).optional(),
    }),
  ).min(1).max(MAX_ADJUSTMENTS_PER_PAYROLL),
});

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

    // Reserve threshold exception approval flow.
    if (body && typeof body === "object" && "reserveThresholdException" in body) {
      const exceptionParsed = parseBody(reserveThresholdExceptionSchema, body);
      if (!exceptionParsed.success) {
        return withCors(validationErrorResponse(exceptionParsed.errors), request);
      }

      if (!RESERVE_EXCEPTION_ALLOWED_STATUSES.has(payroll.status)) {
        return withCors(
          errorResponse(
            "RESERVE_EXCEPTION_NOT_ALLOWED",
            `Payroll run in '${payroll.status}' status cannot receive a reserve threshold exception. Allowed statuses: ${Array.from(RESERVE_EXCEPTION_ALLOWED_STATUSES).join(", ")}.`,
            409,
          ),
          request,
        );
      }

      const existingException = (payroll as PayrollRun & { reserveThresholdException?: unknown })
        .reserveThresholdException;
      if (existingException) {
        return withCors(
          errorResponse(
            "RESERVE_EXCEPTION_ALREADY_APPROVED",
            "Payroll run already has an approved reserve threshold exception.",
            409,
          ),
          request,
        );
      }

      const now = new Date().toISOString();
      const approval = {
        id: `rte_${crypto.randomUUID()}`,
        requestedAmount: exceptionParsed.data.reserveThresholdException.requestedAmount,
        reason: exceptionParsed.data.reserveThresholdException.reason,
        status: "approved" as const,
        approvedAt: now,
      };

      const updated = {
        ...payroll,
        reserveThresholdException: approval,
        updatedAt: now,
      };
      return withCors(successResponse(updated), request);
    }

    // Support post-submission adjustments alongside the existing status update flow.
    if (body && typeof body === "object" && "adjustments" in body) {
      const adjustmentParsed = parseBody(adjustmentLimitsSchema, body);
      if (!adjustmentParsed.success) {
        return withCors(validationErrorResponse(adjustmentParsed.errors), request);
      }

      if (!ADJUSTABLE_STATUSES.has(payroll.status)) {
        return withCors(
          errorResponse(
            "ADJUSTMENT_NOT_ALLOWED",
            `Payroll run in '${payroll.status}' status cannot be adjusted. Adjustments are allowed in statuses: ${Array.from(ADJUSTABLE_STATUSES).join(", ")}.`,
            409,
          ),
          request,
        );
      }

      const existingAdjustments = Array.isArray((payroll as PayrollRun & { adjustments?: unknown[] }).adjustments)
        ? (payroll as PayrollRun & { adjustments?: unknown[] }).adjustments!
        : [];
      const newAdjustments = adjustmentParsed.data.adjustments;

      if (existingAdjustments.length + newAdjustments.length > MAX_ADJUSTMENTS_PER_PAYROLL) {
        return withCors(
          errorResponse(
            "ADJUSTMENT_LIMIT_EXCEEDED",
            `Payroll run already has ${existingAdjustments.length} adjustment(s); adding ${newAdjustments.length} would exceed the limit of ${MAX_ADJUSTMENTS_PER_PAYROLL}.`,
            422,
          ),
          request,
        );
      }

      const totalAdjustmentAmount = newAdjustments.reduce(
        (sum, adjustment) => sum + (adjustment.type === "amount_change" ? adjustment.amount ?? 0 : 0),
        0,
      );
      if (totalAdjustmentAmount > MAX_ADJUSTMENT_AMOUNT) {
        return withCors(
          errorResponse(
            "ADJUSTMENT_AMOUNT_LIMIT_EXCEEDED",
            `Total adjustment amount ${totalAdjustmentAmount} exceeds the limit of ${MAX_ADJUSTMENT_AMOUNT}.`,
            422,
          ),
          request,
        );
      }

      const now = new Date().toISOString();
      const recordedAdjustments = newAdjustments.map((adjustment) => ({
        ...adjustment,
        id: `adj_${crypto.randomUUID()}`,
        createdAt: now,
      }));

      const updated = {
        ...payroll,
        adjustments: [...existingAdjustments, ...recordedAdjustments],
        updatedAt: now,
      };
      return withCors(successResponse(updated), request);
    }

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
        errorResponse("UNAUTHORIZED", "Authorization header missing.", 401),
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
