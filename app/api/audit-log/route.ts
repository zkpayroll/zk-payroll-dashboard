import { NextRequest } from "next/server";
import {
  successResponse,
  errorResponse,
} from "@/lib/api/response";
import { withCors, handleOptions } from "@/lib/api/cors";

const AUDIT_LOG_COLLECTION = "zk-payroll-audit-logs";

interface AuditLogEntry {
  id: string;
  timestamp: string;
  adminPublicKey: string;
  action: string;
  targetType: "payroll" | "employee" | "treasury" | "audit" | "system";
  targetId?: string;
  reason?: string;
  status: "success" | "failed" | "pending";
  signature?: string;
}

interface RouteContext {
  params: Record<string, string>;
}

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { searchParams } = new URL(request.url);
    const filters: { [key: string]: string } = {};

    searchParams.forEach((value, key) => {
      if (['action', 'admin', 'from', 'to', 'targetType'].includes(key)) {
        filters[key] = value;
      }
    });

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/internal/${AUDIT_LOG_COLLECTION}/list`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(filters),
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch audit logs");
    }

    const data = await response.json();
    return withCors(successResponse(data.logs), request);
  } catch (error) {
    return withCors(
      errorResponse("INTERNAL_ERROR", "Failed to fetch audit logs.", 500),
      request,
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
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
        errorResponse("FORBIDDEN", "Admin role required for audit logging.", 403),
        request,
      );
    }

    const body = await request.json();
    const newLog: AuditLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      adminPublicKey: payload.publicKey,
      action: body.action,
      targetType: body.targetType,
      targetId: body.targetId,
      reason: body.reason,
      status: body.status || "success",
      signature: body.signature,
    };

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/internal/${AUDIT_LOG_COLLECTION}/add`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newLog),
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to create audit log");
    }

    return withCors(successResponse(newLog), request);
  } catch (error) {
    return withCors(
      errorResponse("INTERNAL_ERROR", "Failed to create audit log.", 500),
      request,
    );
  }
}
