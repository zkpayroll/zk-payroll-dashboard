import { describe, expect, it } from "vitest";
import {
  maskStellarAddress,
  refreshEmployerRoleBeforeSubmission,
  validateEmployerRoleSnapshot,
} from "@/lib/company/employerRoleRefresh";
import type { Company } from "@/types";

const ADMIN_WALLET_A =
  "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const ADMIN_WALLET_B =
  "GBDEVU63Y6NTHJQQZIKVTC23NWLQVP3WJ2RI2OTSJTNYOIGICST6DUXR";

const ACTIVE_COMPANY: Company = {
  id: "comp-001",
  name: "Stellar Labs Inc.",
  admin: ADMIN_WALLET_A,
  treasury: ADMIN_WALLET_B,
  employeeCount: 18,
  isActive: true,
};

describe("refreshEmployerRoleBeforeSubmission (#856)", () => {
  const now = new Date("2026-04-15T12:00:00Z");

  it("allows payroll submission when live company and admin role match the connected wallet", async () => {
    const result = await refreshEmployerRoleBeforeSubmission({
      cachedCompany: ACTIVE_COMPANY,
      cachedRole: "admin",
      currentPublicKey: ADMIN_WALLET_A,
      now,
      fetchLatestState: async () => ({
        company: ACTIVE_COMPANY,
        role: "admin",
        refreshedAt: "2026-04-15T11:59:55Z",
      }),
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.roleChanged).toBe(false);
    expect(result.adminTransferred).toBe(false);
    expect(result.snapshot?.company.id).toBe("comp-001");
  });

  it("blocks submission with employer_role_revoked when role was downgraded before submission", async () => {
    const result = await refreshEmployerRoleBeforeSubmission({
      cachedCompany: ACTIVE_COMPANY,
      cachedRole: "admin",
      currentPublicKey: ADMIN_WALLET_A,
      now,
      fetchLatestState: async () => ({
        company: ACTIVE_COMPANY,
        role: "operator",
        refreshedAt: "2026-04-15T11:59:58Z",
      }),
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("employer_role_revoked");
    expect(result.roleChanged).toBe(true);
    expect(result.message).toContain("current role: operator");
  });

  it("blocks submission with admin_transferred and masks wallet addresses when company admin changed", async () => {
    const transferredCompany: Company = {
      ...ACTIVE_COMPANY,
      admin: ADMIN_WALLET_B,
    };

    const result = await refreshEmployerRoleBeforeSubmission({
      cachedCompany: ACTIVE_COMPANY,
      cachedRole: "admin",
      currentPublicKey: ADMIN_WALLET_A,
      now,
      fetchLatestState: async () => ({
        company: transferredCompany,
        role: "admin",
        refreshedAt: "2026-04-15T11:59:59Z",
      }),
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("admin_transferred");
    expect(result.adminTransferred).toBe(true);
    expect(result.message).toContain(maskStellarAddress(ADMIN_WALLET_B));
    expect(result.message).not.toContain(ADMIN_WALLET_B);
  });

  it("blocks submission when company becomes inactive, admin address is invalid, or snapshot is stale", () => {
    const inactiveResult = validateEmployerRoleSnapshot({
      snapshot: {
        company: { ...ACTIVE_COMPANY, isActive: false },
        role: "admin",
        refreshedAt: "2026-04-15T11:59:55Z",
      },
      now,
    });
    expect(inactiveResult.allowed).toBe(false);
    expect(inactiveResult.reason).toBe("company_inactive");

    const invalidAdminResult = validateEmployerRoleSnapshot({
      snapshot: {
        company: { ...ACTIVE_COMPANY, admin: "invalid-address" },
        role: "admin",
        refreshedAt: "2026-04-15T11:59:55Z",
      },
      now,
    });
    expect(invalidAdminResult.allowed).toBe(false);
    expect(invalidAdminResult.reason).toBe("invalid_admin_address");

    const staleResult = validateEmployerRoleSnapshot({
      snapshot: {
        company: ACTIVE_COMPANY,
        role: "admin",
        refreshedAt: "2026-04-15T11:58:00Z",
      },
      now,
      maxStalenessMs: 30_000,
    });
    expect(staleResult.allowed).toBe(false);
    expect(staleResult.reason).toBe("stale_role_snapshot");
  });

  it("handles fetch failures and null snapshots gracefully with refresh_failed", async () => {
    const rejected = await refreshEmployerRoleBeforeSubmission({
      cachedCompany: ACTIVE_COMPANY,
      cachedRole: "admin",
      currentPublicKey: ADMIN_WALLET_A,
      now,
      fetchLatestState: async () => {
        throw new Error("network timeout");
      },
    });
    expect(rejected.allowed).toBe(false);
    expect(rejected.reason).toBe("refresh_failed");

    const missing = await refreshEmployerRoleBeforeSubmission({
      cachedCompany: ACTIVE_COMPANY,
      cachedRole: "admin",
      currentPublicKey: ADMIN_WALLET_A,
      now,
      fetchLatestState: async () => ({
        company: null,
        role: null,
      }),
    });
    expect(missing.allowed).toBe(false);
    expect(missing.reason).toBe("refresh_failed");
  });
});
