import { describe, it, expect } from "vitest";
import {
  evaluateAssetAvailabilitySafety,
  assertAssetAvailabilitySafety,
  AssetAvailabilitySafetyError,
  validateAssetCode,
  validateAssetIssuer,
} from "@/lib/assets/assetAvailabilitySafety";

describe("validateAssetCode", () => {
  it("accepts valid alphanumeric asset codes (1 to 12 chars)", () => {
    expect(validateAssetCode("USDC").valid).toBe(true);
    expect(validateAssetCode("usdc").normalized).toBe("USDC");
    expect(validateAssetCode("XLM").valid).toBe(true);
    expect(validateAssetCode("EURC").valid).toBe(true);
    expect(validateAssetCode("A").valid).toBe(true);
    expect(validateAssetCode("123456789012").valid).toBe(true);
  });

  it("trims whitespace around asset code", () => {
    const res = validateAssetCode("   USDC   ");
    expect(res.valid).toBe(true);
    expect(res.normalized).toBe("USDC");
  });

  it("rejects empty, non-string, or blank asset codes", () => {
    expect(validateAssetCode("").valid).toBe(false);
    expect(validateAssetCode("   ").valid).toBe(false);
    expect(validateAssetCode(null).valid).toBe(false);
    expect(validateAssetCode(undefined).valid).toBe(false);
    expect(validateAssetCode(123).valid).toBe(false);
  });

  it("rejects invalid characters and codes exceeding 12 characters", () => {
    expect(validateAssetCode("USDC$").valid).toBe(false);
    expect(validateAssetCode("USDC-T").valid).toBe(false);
    expect(validateAssetCode("TOOLONGASSETCODE").valid).toBe(false);
  });
});

describe("validateAssetIssuer", () => {
  const validStellarPublicKey =
    "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

  it("permits undefined or empty issuer for credit assets", () => {
    expect(validateAssetIssuer("USDC", undefined).valid).toBe(true);
    expect(validateAssetIssuer("USDC", "").valid).toBe(true);
  });

  it("validates a proper 56-character Stellar public key starting with G", () => {
    expect(validateAssetIssuer("USDC", validStellarPublicKey).valid).toBe(true);
  });

  it("rejects malformed issuer keys for credit assets", () => {
    expect(validateAssetIssuer("USDC", "SA5ZSEJY...").valid).toBe(false); // starts with S (secret)
    expect(validateAssetIssuer("USDC", "too_short").valid).toBe(false);
    expect(validateAssetIssuer("USDC", "GA5ZSEJY12345").valid).toBe(false);
  });

  it("enforces that native XLM has no issuer", () => {
    expect(validateAssetIssuer("XLM", undefined).valid).toBe(true);
    expect(validateAssetIssuer("XLM", validStellarPublicKey).valid).toBe(false);
  });
});

describe("evaluateAssetAvailabilitySafety", () => {
  it("returns available status when supported payroll assets are configured", () => {
    const result = evaluateAssetAvailabilitySafety([{ code: "USDC" }]);

    expect(result.status).toBe("available");
    expect(result.canExecutePayroll).toBe(true);
    expect(result.supportedAssets).toHaveLength(1);
    expect(result.supportedAssets[0].code).toBe("USDC");
    expect(result.supportedAssets[0].label).toContain("USDC");
    expect(result.unsupportedAssets).toHaveLength(0);
    expect(result.blockers).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("normalizes lowercase asset codes and trims whitespace", () => {
    const result = evaluateAssetAvailabilitySafety([
      { code: "  usdc " },
      { code: "xlm" },
    ]);

    expect(result.status).toBe("available");
    expect(result.canExecutePayroll).toBe(true);
    expect(result.supportedAssets.map((a) => a.code)).toEqual(["USDC", "XLM"]);
  });

  it("returns warning status when supported and unsupported assets are both present", () => {
    const result = evaluateAssetAvailabilitySafety([
      { code: "USDC" },
      { code: "SHIB" },
    ]);

    expect(result.status).toBe("warning");
    expect(result.canExecutePayroll).toBe(true);
    expect(result.supportedAssets).toHaveLength(1);
    expect(result.unsupportedAssets).toEqual(["SHIB"]);
    expect(result.warnings.some((w) => w.includes("SHIB"))).toBe(true);
    expect(result.remediationAction).toBeDefined();
  });

  it("detects and warns on duplicate asset configurations", () => {
    const result = evaluateAssetAvailabilitySafety([
      { code: "USDC" },
      { code: "usdc" },
    ]);

    expect(result.status).toBe("warning");
    expect(result.canExecutePayroll).toBe(true);
    expect(result.duplicateAssets).toEqual(["USDC"]);
    expect(result.warnings.some((w) => w.includes("Duplicate"))).toBe(true);
  });

  it("blocks payroll creation when configuredAssets is empty array", () => {
    const result = evaluateAssetAvailabilitySafety([]);

    expect(result.status).toBe("blocked");
    expect(result.canExecutePayroll).toBe(false);
    expect(result.supportedAssets).toHaveLength(0);
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.remediationAction).toEqual({
      label: "Configure payroll assets",
      href: "/settings/assets",
    });
  });

  it("blocks payroll creation when configuredAssets is null or undefined", () => {
    const resNull = evaluateAssetAvailabilitySafety(null);
    expect(resNull.status).toBe("blocked");
    expect(resNull.canExecutePayroll).toBe(false);

    const resUndef = evaluateAssetAvailabilitySafety(undefined);
    expect(resUndef.status).toBe("blocked");
    expect(resUndef.canExecutePayroll).toBe(false);
  });

  it("blocks payroll creation when only unsupported assets are provided", () => {
    const result = evaluateAssetAvailabilitySafety([
      { code: "FAKE1" },
      { code: "FAKE2" },
    ]);

    expect(result.status).toBe("blocked");
    expect(result.canExecutePayroll).toBe(false);
    expect(result.unsupportedAssets).toEqual(["FAKE1", "FAKE2"]);
    expect(result.blockers.some((b) => b.includes("blocked"))).toBe(true);
    expect(result.remediationAction?.href).toBe("/settings/assets");
  });

  it("handles malformed array entries gracefully", () => {
    const result = evaluateAssetAvailabilitySafety([
      null,
      undefined,
      42,
      { code: "" },
      { code: "USDC" },
    ]);

    expect(result.status).toBe("warning");
    expect(result.canExecutePayroll).toBe(true);
    expect(result.supportedAssets).toHaveLength(1);
    expect(result.invalidAssets.length).toBeGreaterThanOrEqual(4);
  });

  it("safely handles non-array input types without throwing", () => {
    expect(evaluateAssetAvailabilitySafety("not-an-array").status).toBe("blocked");
    expect(evaluateAssetAvailabilitySafety(12345).status).toBe("blocked");
    expect(evaluateAssetAvailabilitySafety({ code: "USDC" }).status).toBe("blocked");
  });
});

describe("assertAssetAvailabilitySafety", () => {
  it("does not throw when supported assets are configured", () => {
    expect(() => {
      assertAssetAvailabilitySafety([{ code: "USDC" }]);
    }).not.toThrow();
  });

  it("throws AssetAvailabilitySafetyError when asset availability is blocked", () => {
    let thrownError: unknown;
    try {
      assertAssetAvailabilitySafety([]);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(AssetAvailabilitySafetyError);
    const error = thrownError as AssetAvailabilitySafetyError;
    expect(error.name).toBe("AssetAvailabilitySafetyError");
    expect(error.result.status).toBe("blocked");
    expect(error.result.canExecutePayroll).toBe(false);
  });
});

describe("Privacy guarantees", () => {
  it("never includes salary amounts or employee references in results or errors", () => {
    const result = evaluateAssetAvailabilitySafety([
      { code: "USDC" },
      { code: "INVALID" },
    ]);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/salary|balance|secret|amount|emp_/i);
  });
});
