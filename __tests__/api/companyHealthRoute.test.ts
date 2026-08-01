import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/company/health/route";
import { NextRequest } from "next/server";

describe("GET /api/company/health API Route", () => {
  it("returns 200 with structured company health check data", async () => {
    const request = new NextRequest("http://localhost:3000/api/company/health?companyId=company_001");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
    expect(json.data.companyId).toBe("company_001");
    expect(json.data.overallStatus).toBeDefined();
    expect(Array.isArray(json.data.checks)).toBe(true);
    expect(json.data.checks).toHaveLength(6);
  });
});
