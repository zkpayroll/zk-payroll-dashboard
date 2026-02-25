import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";
import { initializeZkEngine, resetZkEngineForTests, zkEngine } from "@/lib/zk";
import type { ZkProofRequest } from "@/types";

type FetchCall = {
  input: string;
  init?: RequestInit;
};

function buildProofRequest(): ZkProofRequest {
  return {
    privateInputs: {
      employeeIdHash: "id-hash",
      employeeSsnHash: "ssn-hash",
      salaryAmountHash: "salary-hash",
      saltHash: "salt-hash",
    },
    publicInputs: {
      merkleRoot: "0xmerkle",
      totalPayrollAmount: "124500",
      payrollPeriodId: "2026-02",
    },
  };
}

describe("zkEngine init", () => {
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

  it("falls back cleanly when artifact fetches are unavailable", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ input: String(input), init });

      return {
        ok: false,
        json: async () => ({}),
        arrayBuffer: async () => new ArrayBuffer(0),
      } as Response;
    }) as typeof fetch;

    await initializeZkEngine();
    const proof = await zkEngine.generateProof(buildProofRequest());

    const proofPayload = proof.proof as Record<string, unknown>;
    const artifactHints = proofPayload.artifactHints as Record<string, unknown>;

    assert.equal(proofPayload.scheme, "mock");
    assert.equal(artifactHints.hasVerificationKey, false);
    assert.equal(artifactHints.circuitWasmBytes, 0);
    assert.equal(fetchCalls.length, 2);
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

  it("caches singleton initialization across concurrent calls", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ input: String(input), init });

      if (String(input).endsWith("verification_key.json")) {
        return {
          ok: true,
          json: async () => ({ key: "mock-vk" }),
          arrayBuffer: async () => new ArrayBuffer(0),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({}),
        arrayBuffer: async () => new ArrayBuffer(4),
      } as Response;
    }) as typeof fetch;

    await Promise.all([initializeZkEngine(), initializeZkEngine()]);
    await zkEngine.generateProof(buildProofRequest());

    assert.equal(fetchCalls.length, 2);
    assert.equal(
      fetchCalls.filter((call) => call.input === "/zk/verification_key.json").length,
      1
    );
    assert.equal(fetchCalls.filter((call) => call.input === "/zk/payroll.wasm").length, 1);
  });
});
