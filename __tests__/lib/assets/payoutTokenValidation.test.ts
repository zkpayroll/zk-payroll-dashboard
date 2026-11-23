import { describe, it, expect } from "vitest";
import {
  validatePayoutToken,
  PAYOUT_TOKEN_ERROR_CODES,
} from "@/lib/assets/payoutTokenValidation";

describe("validatePayoutToken — success path", () => {
  it("accepts a supported payout token", () => {
    const result = validatePayoutToken("USDC");

    expect(result.valid).toBe(true);
    expect(result.code).toBe("USDC");
    expect(result.errorCode).toBeNull();
    expect(result.message).toBeNull();
  });
});

describe("validatePayoutToken — rejected path", () => {
  it("rejects an unsupported token with a named error code and actionable message", () => {
    const result = validatePayoutToken("BTC");

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errorCode).toBe(PAYOUT_TOKEN_ERROR_CODES.UNSUPPORTED);
    expect(result.errorCode).toBe("UNSUPPORTED_PAYOUT_TOKEN");
    expect(result.code).toBe("BTC");
    expect(result.message).toContain('"BTC"');
    expect(result.message).toContain("USDC, XLM, EURC");
  });

  it("does not echo over-long or non-code-shaped input back into the message", () => {
    const junk = "x".repeat(64);
    const result = validatePayoutToken(junk);

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errorCode).toBe("UNSUPPORTED_PAYOUT_TOKEN");
    expect(result.code).toBeNull();
    expect(result.message).not.toContain(junk);
    expect(result.message.startsWith("This token")).toBe(true);
  });
});

describe("validatePayoutToken — boundary cases", () => {
  it("treats an empty symbol as missing rather than unsupported", () => {
    const result = validatePayoutToken("");

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errorCode).toBe("PAYOUT_TOKEN_MISSING");
    expect(result.code).toBeNull();
  });

  it("treats a whitespace-only or non-string symbol as missing", () => {
    for (const raw of ["   ", null, undefined, 42]) {
      const result = validatePayoutToken(raw);
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(result.errorCode).toBe("PAYOUT_TOKEN_MISSING");
    }
  });

  it("accepts mixed-case and padded symbols that normalize to a supported token", () => {
    const mixed = validatePayoutToken("  UsDc ");
    expect(mixed.valid).toBe(true);
    expect(mixed.code).toBe("USDC");

    const lower = validatePayoutToken("xlm");
    expect(lower.valid).toBe(true);
    expect(lower.code).toBe("XLM");
  });
});
