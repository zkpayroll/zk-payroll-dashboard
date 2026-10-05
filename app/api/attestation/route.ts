import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { withCors, handleOptions } from "@/lib/api/cors";
import { MOCK_ATTESTATION_DIGESTS } from "@/lib/api/attestationMockData";

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const digestId = url.searchParams.get("id");

    if (digestId) {
      const digest = MOCK_ATTESTATION_DIGESTS.find(
        (d) => d.digest === digestId,
      );
      if (!digest) {
        return withCors(
          errorResponse("NOT_FOUND", "Attestation digest not found.", 404),
          request,
        );
      }
      return withCors(successResponse(digest), request);
    }

    return withCors(
      successResponse(MOCK_ATTESTATION_DIGESTS, {
        total: MOCK_ATTESTATION_DIGESTS.length,
      }),
      request,
    );
  } catch {
    return withCors(
      errorResponse(
        "ATTESTATION_FETCH_FAILED",
        "Failed to retrieve attestation digests.",
        500,
      ),
      request,
    );
  }
}
