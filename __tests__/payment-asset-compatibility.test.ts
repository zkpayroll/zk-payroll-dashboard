import { describe, it, expect } from "vitest";
import {
  evaluatePaymentAssetCompatibility,
  assertPaymentAssetCompatibility,
  PaymentAssetCompatibilityError,
} from "@/lib/assets/paymentAssetCompatibility";

// Canonical supported issuers (see lib/assets/supportedAssets.ts).
const USDC_ISSUER =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
// A valid Stellar public key that is NOT the supported USDC issuer.
const OTHER_ISSUER =
  "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";

describe("evaluatePaymentAssetCompatibility — success path", () => {
  it("reports compatible when targets use supported assets with consistent issuers", () => {
    const result = evaluatePaymentAssetCompatibility([
      { employeeId: "e1", assetCode: "USDC", assetIssuer: USDC_ISSUER },
      { employeeId: "e2", assetCode: "USDC" }, // defaults to canonical issuer
      { employeeId: "e3", assetCode: "XLM" }, // native, no issuer
    ]);

    expect(result.status).toBe("compatible");
    expect(result.canRunPayroll).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.remediationAction).toBeUndefined();

    const codes = result.compatibleAssets.map((a) => a.code).sort();
    expect(codes).toEqual(["USDC", "XLM"]);

    const usdc = result.compatibleAssets.find((a) => a.code === "USDC")!;
    expect(usdc.paymentCount).toBe(2);
    expect(usdc.issuer).toBe(USDC_ISSUER);

    const xlm = result.compatibleAssets.find((a) => a.code === "XLM")!;
    expect(xlm.paymentCount).toBe(1);
    expect(xlm.issuer).toBeUndefined(); // native
  });

  it("normalizes lowercase codes and trims whitespace", () => {
    const result = evaluatePaymentAssetCompatibility([
      { assetCode: "  usdc " },
      { assetCode: "xlm" },
    ]);

    expect(result.status).toBe("compatible");
    expect(result.compatibleAssets.map((a) => a.code).sort()).toEqual([
      "USDC",
      "XLM",
    ]);
  });
});

describe("evaluatePaymentAssetCompatibility — failure paths", () => {
  it("is incompatible and blocked when no targets are provided", () => {
    const result = evaluatePaymentAssetCompatibility([]);

    expect(result.status).toBe("incompatible");
    expect(result.canRunPayroll).toBe(false);
    expect(result.compatibleAssets).toHaveLength(0);
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.remediationAction).toEqual({
      label: "Review payroll asset settings",
      href: "/settings/assets",
    });
  });

  it("is incompatible when only unsupported assets are assigned", () => {
    const result = evaluatePaymentAssetCompatibility([
      { assetCode: "DOGE" },
      { assetCode: "SHIB" },
    ]);

    expect(result.status).toBe("incompatible");
    expect(result.canRunPayroll).toBe(false);
    expect(result.unsupportedAssets).toEqual(["DOGE", "SHIB"]);
    expect(result.blockers.some((b) => b.includes("No compatible"))).toBe(true);
  });

  it("warns (but stays runnable) when supported and unsupported assets are mixed", () => {
    const result = evaluatePaymentAssetCompatibility([
      { assetCode: "USDC" },
      { assetCode: "DOGE" },
    ]);

    expect(result.status).toBe("warning");
    expect(result.canRunPayroll).toBe(true);
    expect(result.compatibleAssets.map((a) => a.code)).toEqual(["USDC"]);
    expect(result.unsupportedAssets).toEqual(["DOGE"]);
    expect(result.warnings.some((w) => w.includes("DOGE"))).toBe(true);
  });
});

describe("evaluatePaymentAssetCompatibility — edge cases", () => {
  it("blocks the same asset code assigned with conflicting issuers", () => {
    const result = evaluatePaymentAssetCompatibility([
      { employeeId: "e1", assetCode: "USDC", assetIssuer: USDC_ISSUER },
      { employeeId: "e2", assetCode: "USDC", assetIssuer: OTHER_ISSUER },
    ]);

    expect(result.status).toBe("incompatible");
    expect(result.canRunPayroll).toBe(false);
    expect(result.issuerConflicts).toHaveLength(1);
    expect(result.issuerConflicts[0].code).toBe("USDC");
    expect(result.issuerConflicts[0].issuers.sort()).toEqual(
      [USDC_ISSUER, OTHER_ISSUER].sort(),
    );
    // The conflicting code is excluded from compatible assets.
    expect(result.compatibleAssets).toHaveLength(0);
    expect(result.blockers.some((b) => b.includes("different issuer"))).toBe(
      true,
    );
  });

  it("blocks a single target whose issuer does not match the supported token", () => {
    const result = evaluatePaymentAssetCompatibility([
      { assetCode: "USDC", assetIssuer: OTHER_ISSUER },
    ]);

    expect(result.status).toBe("incompatible");
    expect(result.canRunPayroll).toBe(false);
    expect(result.issuerMismatches).toHaveLength(1);
    expect(result.issuerMismatches[0].assetCode).toBe("USDC");
    expect(result.compatibleAssets).toHaveLength(0);
  });

  it("treats native XLM carrying an issuer as an invalid target", () => {
    const result = evaluatePaymentAssetCompatibility([
      { assetCode: "XLM", assetIssuer: USDC_ISSUER },
    ]);

    expect(result.invalidTargets).toHaveLength(1);
    // XLM-with-issuer is rejected, so nothing compatible remains → blocked.
    expect(result.status).toBe("incompatible");
    expect(result.canRunPayroll).toBe(false);
  });

  it("skips malformed entries but keeps valid targets runnable", () => {
    const result = evaluatePaymentAssetCompatibility([
      null,
      42,
      { assetCode: "" },
      { assetCode: "USDC" },
    ]);

    expect(result.status).toBe("warning");
    expect(result.canRunPayroll).toBe(true);
    expect(result.compatibleAssets.map((a) => a.code)).toEqual(["USDC"]);
    expect(result.invalidTargets.length).toBe(3);
    expect(result.warnings.some((w) => w.includes("skipped"))).toBe(true);
  });

  it("safely handles non-array inputs without throwing", () => {
    expect(evaluatePaymentAssetCompatibility(null).status).toBe("incompatible");
    expect(evaluatePaymentAssetCompatibility(undefined).status).toBe(
      "incompatible",
    );
    expect(evaluatePaymentAssetCompatibility("not-an-array").status).toBe(
      "incompatible",
    );
    expect(evaluatePaymentAssetCompatibility(12345).status).toBe("incompatible");
  });

  it("accepts the same canonical issuer stated explicitly and implicitly", () => {
    const result = evaluatePaymentAssetCompatibility([
      { assetCode: "USDC", assetIssuer: USDC_ISSUER },
      { assetCode: "usdc" },
    ]);

    expect(result.status).toBe("compatible");
    expect(result.compatibleAssets).toHaveLength(1);
    expect(result.compatibleAssets[0].paymentCount).toBe(2);
    expect(result.issuerConflicts).toHaveLength(0);
  });

  it("accepts a supported issued asset given without an explicit issuer", () => {
    const result = evaluatePaymentAssetCompatibility([{ assetCode: "eurc" }]);

    expect(result.status).toBe("compatible");
    expect(result.compatibleAssets.map((a) => a.code)).toEqual(["EURC"]);
    expect(result.invalidTargets).toHaveLength(0);
  });
});

describe("assertPaymentAssetCompatibility", () => {
  it("does not throw when payment assets are compatible", () => {
    expect(() => {
      assertPaymentAssetCompatibility([{ assetCode: "USDC" }]);
    }).not.toThrow();
  });

  it("throws PaymentAssetCompatibilityError when incompatible", () => {
    let thrown: unknown;
    try {
      assertPaymentAssetCompatibility([]);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(PaymentAssetCompatibilityError);
    const error = thrown as PaymentAssetCompatibilityError;
    expect(error.name).toBe("PaymentAssetCompatibilityError");
    expect(error.result.status).toBe("incompatible");
    expect(error.result.canRunPayroll).toBe(false);
  });
});

describe("Privacy guarantees", () => {
  it("never surfaces employee references or payroll amounts in results or errors", () => {
    const result = evaluatePaymentAssetCompatibility([
      { employeeId: "emp_private_001", assetCode: "USDC" },
      { employeeId: "emp_private_002", assetCode: "DOGE" },
      { employeeId: "emp_private_003", assetCode: "USDC", assetIssuer: OTHER_ISSUER },
    ]);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("emp_private_001");
    expect(serialized).not.toMatch(/salary|balance|secret|amount|emp_/i);
  });
});
