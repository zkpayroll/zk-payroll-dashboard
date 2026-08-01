import { NextRequest } from "next/server";
import { z } from "zod";
import {
  successResponse,
  errorResponse,
} from "@/lib/api/response";
import { withCors, handleOptions } from "@/lib/api/cors";
import { parseBody } from "@/lib/api/validation";

interface RouteContext {
  params: Record<string, string>;
}

const bulkRevokeSchema = z.object({
  ids: z.array(z.string().min(1, "Key ID is required")),
  reason: z.string().min(3, "Reason must be at least 3 characters").optional(),
  signature: z.string().min(1, "Digital signature is required for revocation"),
});

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
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
        errorResponse("FORBIDDEN", "Admin role required for bulk revocation.", 403),
        request,
      );
    }

    const body = await request.json();
    const parsed = parseBody(bulkRevokeSchema, body);
    if (!parsed.success) {
      return withCors(
        errorResponse("VALIDATION_ERROR", "Invalid request data.", 400, parsed.errors),
        request,
      );
    }

    const results = await Promise.all(
      parsed.data.ids.map(async (id) => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/compliance/keys/${id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
            },
            body: JSON.stringify({
              status: "revoked",
              reason: parsed.data.reason,
              signature: parsed.data.signature,
            }),
          });

          if (!response.ok) {
            return { id, success: false, error: "Failed to revoke access" };
          }

          return { id, success: true };
        } catch (error) {
          return { id, success: false, error: "Network error" };
        }
      })
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return withCors(
      successResponse({
        total: parsed.data.ids.length,
        successful,
        failed,
        results,
      }),
      request,
    );
  } catch (error) {
    return withCors(
      errorResponse("INTERNAL_ERROR", "Bulk revocation failed.", 500),
      request,
    );
  }
}
