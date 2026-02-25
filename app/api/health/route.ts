import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { withCors, handleOptions } from "@/lib/api/cors";

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  try {
    const stellarRes = await fetch("https://horizon-testnet.stellar.org", {
      next: { revalidate: 0 },
    });

    const response = successResponse({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "1.0.0",
      stellar: {
        network: "TESTNET",
        horizonUrl: "https://horizon-testnet.stellar.org",
        sorobanRpcUrl: "https://soroban-testnet.stellar.org",
        reachable: stellarRes.ok,
      },
    });

    return withCors(response, request);
  } catch {
    return withCors(
      errorResponse("HEALTH_CHECK_FAILED", "Health check failed.", 500),
      request,
    );
  }
}
