import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";
import { generatePayrollProof, resetZkEngineForTests } from "@/lib/zk";

type FetchCall = {
  input: string;
  init?: RequestInit;
};

describe("generatePayrollProof", () => {
  let originalFetch: typeof fetch | undefined;
  let originalWindow: Window | undefined;
  let originalCrypto: Crypto | undefined;
  let fetchCalls: FetchCall[];

  beforeEach(() => {
    resetZkEngineForTests();
    fetchCalls = [];

    originalFetch = globalThis.fetch;
    originalWindow = globalThis.window;
    originalCrypto = globalThis.crypto;

    Object.defineProperty(globalThis, "window", {
      value: { crypto: webcrypto },
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, "crypto", {
      value: webcrypto,
      configurable: true,
      writable: true,
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({
        input: String(input),
        init,
      });

      return {
        ok: false,
        json: async () => ({}),
        arrayBuffer: async () => new ArrayBuffer(0),
      } as Response;
    }) as typeof fetch;
  });

  afterEach(() => {
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }

    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      configurable: true,
      writable: true,
    });
  });

  it("generates a mock proof and Soroban payload from generic public inputs", async () => {
    const result = await generatePayrollProof({
      merkleRoot: "0xabc123",
      totalPayrollAmount: "124500",
      payrollPeriodId: "2026-02",
      employeeId: "emp-001",
      employeeSsn: "111-22-3333",
      salaryAmount: "8500",
      salt: "salt-value",
    });

    assert.deepEqual(result.publicInputs, {
      merkleRoot: "0xabc123",
      totalPayrollAmount: "124500",
      payrollPeriodId: "2026-02",
    });
    assert.deepEqual(result.proof.publicSignals, ["0xabc123", "124500", "2026-02"]);
    assert.equal(result.proof.proof.scheme, "mock");
    assert.equal(result.verification.isValid, true);
    assert.equal(result.sorobanArgs.length, 4);
    assert.deepEqual(result.sorobanArgs[0], { type: "string", value: "0xabc123" });
    assert.deepEqual(result.sorobanArgs[1], { type: "u128", value: "124500" });

    assert.ok(
      fetchCalls.some(
        (call) =>
          call.input === "/zk/verification_key.json" &&
          call.init?.cache === "force-cache"
      )
    );
    assert.ok(
      fetchCalls.some(
        (call) => call.input === "/zk/payroll.wasm" && call.init?.cache === "force-cache"
      )
    );
  });

  it("throws when required inputs are missing", async () => {
    await assert.rejects(
      () =>
        generatePayrollProof({
          merkleRoot: "   ",
          totalPayrollAmount: "124500",
          payrollPeriodId: "2026-02",
          employeeId: "emp-001",
          employeeSsn: "111-22-3333",
          salaryAmount: "8500",
        }),
      /merkleRoot is required/
    );

    assert.equal(fetchCalls.length, 0);
  });
});
