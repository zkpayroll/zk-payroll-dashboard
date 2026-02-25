import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { withCors, handleOptions } from "@/lib/api/cors";
import { transactionQuerySchema } from "@/lib/api/validation";
import { MOCK_TRANSACTIONS } from "@/lib/api/mockData";

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const query = transactionQuerySchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      status: searchParams.get("status"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });

    let results = [...MOCK_TRANSACTIONS];

    if (query.status) {
      results = results.filter((t) => t.status === query.status);
    }

    if (query.from) {
      results = results.filter((t) => t.createdAt >= query.from!);
    }
    if (query.to) {
      results = results.filter((t) => t.createdAt <= query.to!);
    }

    const { page, limit } = query;
    const start = (page - 1) * limit;
    const paginated = results.slice(start, start + limit);

    return withCors(
      successResponse(paginated, {
        page,
        limit,
        total: results.length,
        totalPages: Math.ceil(results.length / limit),
      }),
      request,
    );
  } catch {
    return withCors(
      errorResponse("INTERNAL_ERROR", "Failed to fetch transactions.", 500),
      request,
    );
  }
}
