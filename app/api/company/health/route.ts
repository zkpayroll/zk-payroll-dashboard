import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { withCors, handleOptions } from "@/lib/api/cors";
import { checkCompanyHealth } from "@/lib/companyHealthCheck";
import { MOCK_COMPANY_CONFIG } from "@/lib/api/mockData";

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId") || MOCK_COMPANY_CONFIG.id;

    // Use mock config or construct config with companyId
    const config =
      companyId === MOCK_COMPANY_CONFIG.id
        ? MOCK_COMPANY_CONFIG
        : { ...MOCK_COMPANY_CONFIG, id: companyId };

    const result = checkCompanyHealth(config);
    const response = successResponse(result);
    return withCors(response, request);
  } catch {
    return withCors(
      errorResponse("HEALTH_CHECK_FAILED", "Company configuration health check failed.", 500),
      request,
    );
  }
}
