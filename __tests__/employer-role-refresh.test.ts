import { describe, expect, it, vi } from "vitest";
import { checkRoleForSubmission, refreshEmployerRole } from "@/lib/auth/refreshEmployerRole";

const PRIVATE = { employee: "Ada Okafor", salary: "8500.00 USDC", publicKey: `G${"A".repeat(55)}` };

function response(status: number, body: unknown, badJson = false) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: badJson
      ? async () => {
          throw new SyntaxError("Unexpected token <");
        }
      : async () => body,
  } as unknown as Response;
}

const fetchReturning = (res: Response) => vi.fn().mockResolvedValue(res) as unknown as typeof fetch;

describe("refreshEmployerRole (#856)", () => {
  it("reads the role from the session endpoint without caching", async () => {
    const fetchImpl = fetchReturning(response(200, { role: "admin" }));
    await expect(refreshEmployerRole({ fetchImpl })).resolves.toEqual({ status: "fresh", role: "admin" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
  });

  it.each(["admin", "operator", "auditor"] as const)("accepts the %s role", async (role) => {
    const result = await refreshEmployerRole({ fetchImpl: fetchReturning(response(200, { role })) });
    expect(result).toEqual({ status: "fresh", role });
  });

  it.each([401, 403, 404])("treats a %s as an invalid session", async (status) => {
    const result = await refreshEmployerRole({ fetchImpl: fetchReturning(response(status, { error: "x" })) });
    expect(result).toEqual({ status: "session_invalid" });
  });

  it.each([500, 502, 503])("treats a %s as unavailable, not as a revoked session", async (status) => {
    const result = await refreshEmployerRole({ fetchImpl: fetchReturning(response(status, PRIVATE)) });
    expect(result).toEqual({ status: "unavailable" });
  });

  it.each([
    ["an unknown role", { role: "owner" }],
    ["a wrongly cased role", { role: "ADMIN" }],
    ["a null role", { role: null }],
    ["a numeric role", { role: 1 }],
    ["a missing role", PRIVATE],
    ["a null body", null],
  ])("treats %s as an invalid session", async (_label, body) => {
    const result = await refreshEmployerRole({ fetchImpl: fetchReturning(response(200, body)) });
    expect(result).toEqual({ status: "session_invalid" });
  });

  it("is unavailable when the body is not JSON", async () => {
    const result = await refreshEmployerRole({ fetchImpl: fetchReturning(response(200, null, true)) });
    expect(result).toEqual({ status: "unavailable" });
  });

  it("is unavailable when the network request fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    await expect(refreshEmployerRole({ fetchImpl })).resolves.toEqual({ status: "unavailable" });
  });

  it("gives up after the timeout instead of hanging a submission", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    ) as unknown as typeof fetch;

    await expect(refreshEmployerRole({ fetchImpl, timeoutMs: 20 })).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("returns only the role, never other fields from the response", async () => {
    const result = await refreshEmployerRole({
      fetchImpl: fetchReturning(response(200, { role: "operator", ...PRIVATE })),
    });
    expect(result).toEqual({ status: "fresh", role: "operator" });
    expect(JSON.stringify(result)).not.toMatch(/Ada|8500|USDC|GAAAA/);
  });
});

describe("checkRoleForSubmission (#856)", () => {
  it("allows a confirmed role and reports no change when it matches", () => {
    expect(checkRoleForSubmission({ status: "fresh", role: "admin" }, "admin")).toEqual({
      ok: true,
      role: "admin",
      changed: false,
    });
  });

  it("reports a demotion so the caller can apply it", () => {
    expect(checkRoleForSubmission({ status: "fresh", role: "auditor" }, "operator")).toEqual({
      ok: true,
      role: "auditor",
      changed: true,
    });
  });

  it("reports a promotion", () => {
    expect(checkRoleForSubmission({ status: "fresh", role: "admin" }, "operator")).toMatchObject({
      ok: true,
      changed: true,
    });
  });

  it("does not claim a change when there was no previous role", () => {
    expect(checkRoleForSubmission({ status: "fresh", role: "admin" })).toMatchObject({ changed: false });
  });

  it("fails closed with a sign-in message for an invalid session (not retryable)", () => {
    const result = checkRoleForSubmission({ status: "session_invalid" }, "admin");
    expect(result).toMatchObject({ ok: false, reason: "session_invalid", retryable: false });
    if (!result.ok) expect(result.message).toMatch(/Sign in again/);
  });

  it("fails closed with a retry message when the role cannot be read", () => {
    const result = checkRoleForSubmission({ status: "unavailable" }, "admin");
    expect(result).toMatchObject({ ok: false, reason: "unavailable", retryable: true });
    if (!result.ok) expect(result.message).toMatch(/Nothing was submitted/);
  });
});
