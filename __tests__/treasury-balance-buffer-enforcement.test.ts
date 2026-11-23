import { describe, expect, it } from "vitest";

import {
  assertTreasuryBalanceBuffer,
  DEFAULT_MAX_WALLET_BALANCE_MINOR,
  DEFAULT_TREASURY_BUFFER_PERCENT,
  DEFAULT_TREASURY_MIN_BUFFER_MINOR,
  evaluateTreasuryBalanceBuffer,
  isTreasuryBalanceSufficient,
  parseMinorUnits,
  TreasuryBalanceBufferError,
  type TreasuryBalanceBufferRequest,
} from "@/lib/treasury/balanceBuffer";

const ONE_TOKEN_MINOR = 10_000_000n;
const TWENTY_FIVE_THOUSAND_TOKENS = DEFAULT_TREASURY_MIN_BUFFER_MINOR; // 25_000 * 1e7
const ONE_HUNDRED_THOUSAND_TOKENS = 100_000n * ONE_TOKEN_MINOR;

function makeRequest(
  overrides: Partial<TreasuryBalanceBufferRequest> = {},
): TreasuryBalanceBufferRequest {
  return {
    balance: ONE_HUNDRED_THOUSAND_TOKENS,
    payout: 10_000n * ONE_TOKEN_MINOR,
    role: "operator",
    ...overrides,
  };
}

describe("parseMinorUnits (#679)", () => {
  it("accepts bigint, integer strings, and integer numbers", () => {
    expect(parseMinorUnits(500n)).toBe(500n);
    expect(parseMinorUnits("500")).toBe(500n);
    expect(parseMinorUnits(" 500 ")).toBe(500n);
    expect(parseMinorUnits(500)).toBe(500n);
  });

  it("rejects negative values, decimals, and malformed strings", () => {
    expect(parseMinorUnits(-1n)).toBeNull();
    expect(parseMinorUnits(-1)).toBeNull();
    expect(parseMinorUnits("1.5")).toBeNull();
    expect(parseMinorUnits("abc")).toBeNull();
    expect(parseMinorUnits("1e7")).toBeNull();
    expect(parseMinorUnits(Number.NaN)).toBeNull();
    expect(parseMinorUnits(Infinity)).toBeNull();
  });
});

describe("evaluateTreasuryBalanceBuffer (#679)", () => {
  it("allows a payout when the buffer remains intact (sufficient)", () => {
    const decision = evaluateTreasuryBalanceBuffer(makeRequest());

    expect(decision.verdict).toBe("sufficient");
    expect(decision.allowed).toBe(true);
    expect(decision.overrideApplied).toBe(false);
    expect(decision.postPayoutBalance).toBe(
      ONE_HUNDRED_THOUSAND_TOKENS - 10_000n * ONE_TOKEN_MINOR,
    );
    expect(decision.requiredBuffer).toBeGreaterThan(0n);
    expect(decision.bufferShortfall).toBe(0n);
    expect(decision.role).toBe("operator");
    expect(decision.auditLogged).toBe(false);
    expect(decision.reason).toBe(
      "Payout is allowed; the treasury buffer remains intact.",
    );
  });

  it("uses max(percent of balance, minBufferAmount) for the required buffer", () => {
    // balance 100000 tokens, 5% = 5000 tokens; min is 25000 tokens -> min wins.
    const decision = evaluateTreasuryBalanceBuffer(makeRequest());
    expect(decision.requiredBuffer).toBe(TWENTY_FIVE_THOUSAND_TOKENS);

    // Large balance where 5% exceeds the floor.
    const largeBalance = 2_000_000n * ONE_TOKEN_MINOR;
    const large = evaluateTreasuryBalanceBuffer(
      makeRequest({
        balance: largeBalance,
        payout: 100_000n * ONE_TOKEN_MINOR,
      }),
    );
    expect(large.requiredBuffer).toBe((largeBalance * 5n) / 100n);
    expect(large.requiredBuffer).toBe(100_000n * ONE_TOKEN_MINOR);
  });

  it("rejects as insufficient when the payout exceeds the balance (never overrideable)", () => {
    const decision = evaluateTreasuryBalanceBuffer(
      makeRequest({
        payout: 150_000n * ONE_TOKEN_MINOR,
        override: true,
      }),
    );

    expect(decision.verdict).toBe("insufficient");
    expect(decision.allowed).toBe(false);
    expect(decision.postPayoutBalance).toBe(0n);
    expect(decision.overrideApplied).toBe(false);
    expect(decision.bufferShortfall).toBe(0n);
    expect(decision.auditLogged).toBe(true);
    expect(decision.reason).toBe("Payout exceeds the available treasury balance.");
  });

  it("flags buffer_breach when post-payout would drop below required buffer", () => {
    // Balance 100000, payout 90000 -> post-payout 10000, required 25000
    const decision = evaluateTreasuryBalanceBuffer(
      makeRequest({
        payout: 90_000n * ONE_TOKEN_MINOR,
        override: false,
      }),
    );

    expect(decision.verdict).toBe("buffer_breach");
    expect(decision.allowed).toBe(false);
    expect(decision.postPayoutBalance).toBe(10_000n * ONE_TOKEN_MINOR);
    expect(decision.requiredBuffer).toBe(TWENTY_FIVE_THOUSAND_TOKENS);
    expect(decision.bufferShortfall).toBe(TWENTY_FIVE_THOUSAND_TOKENS - 10_000n * ONE_TOKEN_MINOR);
    expect(decision.overrideApplied).toBe(false);
    expect(decision.auditLogged).toBe(true);
    expect(decision.reason).toBe("Payout would breach the treasury buffer.");
  });

  it("allows a buffer breach only when override is true and never rescues insufficient", () => {
    const breached = evaluateTreasuryBalanceBuffer(
      makeRequest({
        payout: 90_000n * ONE_TOKEN_MINOR,
        override: true,
        role: "admin",
      }),
    );
    expect(breached.verdict).toBe("buffer_breach");
    expect(breached.allowed).toBe(true);
    expect(breached.overrideApplied).toBe(true);
    expect(breached.reason).toBe("Payout breaches the treasury buffer but was overridden.");

    const insufficient = evaluateTreasuryBalanceBuffer(
      makeRequest({
        payout: 150_000n * ONE_TOKEN_MINOR,
        override: true,
      }),
    );
    expect(insufficient.verdict).toBe("insufficient");
    expect(insufficient.allowed).toBe(false);
    expect(insufficient.overrideApplied).toBe(false);
  });

  it("rejects invalid inputs (bad amounts, out of range percent, balance over max)", () => {
    const badBalance = evaluateTreasuryBalanceBuffer(
      makeRequest({ balance: "not-a-number" }),
    );
    expect(badBalance.verdict).toBe("invalid_input");
    expect(badBalance.allowed).toBe(false);
    expect(badBalance.postPayoutBalance).toBe(0n);
    expect(badBalance.requiredBuffer).toBe(0n);
    expect(badBalance.bufferShortfall).toBe(0n);

    const badPercent = evaluateTreasuryBalanceBuffer(
      makeRequest({ bufferPercent: 101 }),
    );
    expect(badPercent.verdict).toBe("invalid_input");

    const negativePercent = evaluateTreasuryBalanceBuffer(
      makeRequest({ bufferPercent: -1 }),
    );
    expect(negativePercent.verdict).toBe("invalid_input");

    const floatPercent = evaluateTreasuryBalanceBuffer(
      makeRequest({ bufferPercent: 5.5 }),
    );
    expect(floatPercent.verdict).toBe("invalid_input");

    const overMax = evaluateTreasuryBalanceBuffer(
      makeRequest({ balance: DEFAULT_MAX_WALLET_BALANCE_MINOR + 1n }),
    );
    expect(overMax.verdict).toBe("invalid_input");
  });

  it("uses bigint math exactly with no floating point and is deterministic", () => {
    const request = makeRequest({ balance: "123456789", payout: "111111111" });
    const first = evaluateTreasuryBalanceBuffer(request);
    const second = evaluateTreasuryBalanceBuffer(request);

    expect(first).toEqual(second);
    expect(typeof first.postPayoutBalance).toBe("bigint");
    expect(typeof first.requiredBuffer).toBe("bigint");
    expect(request.balance).toBe("123456789");
    expect(request.payout).toBe("111111111");
  });

  it("returns null role for unauthenticated requests and never leaks sensitive data", () => {
    const decision = evaluateTreasuryBalanceBuffer(
      makeRequest({ role: null, overrideReason: "Do not share this." }),
    );
    expect(decision.role).toBe(null);
    expect(decision.reason).not.toContain("Do not share");
    expect(decision.reason).not.toMatch(/GDQP2K/);
  });
});

describe("isTreasuryBalanceSufficient (#679)", () => {
  it("returns true only when the payout is allowed", () => {
    expect(isTreasuryBalanceSufficient(makeRequest())).toBe(true);
    expect(
      isTreasuryBalanceSufficient(makeRequest({ payout: 90_000n * ONE_TOKEN_MINOR })),
    ).toBe(false);
    expect(
      isTreasuryBalanceSufficient(
        makeRequest({ payout: 90_000n * ONE_TOKEN_MINOR, override: true }),
      ),
    ).toBe(true);
    expect(
      isTreasuryBalanceSufficient(
        makeRequest({ payout: 150_000n * ONE_TOKEN_MINOR }),
      ),
    ).toBe(false);
  });
});

describe("assertTreasuryBalanceBuffer (#679)", () => {
  it("returns the decision when sufficient", () => {
    const decision = assertTreasuryBalanceBuffer(makeRequest());

    expect(decision.allowed).toBe(true);
    expect(decision.verdict).toBe("sufficient");
  });

  it("throws TreasuryBalanceBufferError carrying the decision when not allowed", () => {
    expect(() =>
      assertTreasuryBalanceBuffer(makeRequest({ payout: 150_000n * ONE_TOKEN_MINOR })),
    ).toThrow(TreasuryBalanceBufferError);

    try {
      assertTreasuryBalanceBuffer(makeRequest({ payout: 90_000n * ONE_TOKEN_MINOR }));
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(TreasuryBalanceBufferError);
      const typed = error as TreasuryBalanceBufferError;
      expect(typed.name).toBe("TreasuryBalanceBufferError");
      expect(typed.decision.allowed).toBe(false);
      expect(typed.decision.verdict).toBe("buffer_breach");
      expect(typed.decision.bufferShortfall).toBeGreaterThan(0n);
      expect(typed.message).toBe(typed.decision.reason);
    }
  });
});
