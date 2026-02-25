import { NextResponse } from "next/server";

// ─── Response Shape Types ─────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Success Helpers ──────────────────────────────────────────────────────────

export function successResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
  status: number = 200,
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data, meta }, { status });
}

export function createdResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
): NextResponse<ApiSuccess<T>> {
  return successResponse(data, meta, 201);
}

// ─── Error Helpers ────────────────────────────────────────────────────────────

export function errorResponse(
  code: string,
  message: string,
  status: number = 500,
  details?: unknown,
): NextResponse<ApiError> {
  return NextResponse.json(
    { success: false, error: { code, message, details } },
    { status },
  );
}

export function notFoundResponse(resource: string): NextResponse<ApiError> {
  return errorResponse("NOT_FOUND", `${resource} not found.`, 404);
}

export function badRequestResponse(
  message: string,
  details?: unknown,
): NextResponse<ApiError> {
  return errorResponse("BAD_REQUEST", message, 400, details);
}

export function unauthorizedResponse(): NextResponse<ApiError> {
  return errorResponse("UNAUTHORIZED", "Authentication required.", 401);
}

export function validationErrorResponse(
  details: unknown,
): NextResponse<ApiError> {
  return errorResponse(
    "VALIDATION_ERROR",
    "Request validation failed.",
    422,
    details,
  );
}
