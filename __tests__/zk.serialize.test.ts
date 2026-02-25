import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PayrollProof } from "@/types";
import { toSorobanScVals } from "@/lib/zk";

describe("toSorobanScVals", () => {
  it("maps proof and public inputs into Soroban ScVal placeholders", () => {
    const proof: PayrollProof = {
      publicSignals: ["root", "1000", "2026-02"],
      proof: {
        scheme: "mock",
        commitment: "abc",
      },
    };

    const result = toSorobanScVals(proof, {
      merkleRoot: "root",
      totalPayrollAmount: "1000",
      payrollPeriodId: "2026-02",
    });

    assert.deepEqual(result, [
      { type: "string", value: "root" },
      { type: "u128", value: "1000" },
      { type: "string", value: "2026-02" },
      {
        type: "string",
        value: JSON.stringify({
          publicSignals: ["root", "1000", "2026-02"],
          proof: {
            scheme: "mock",
            commitment: "abc",
          },
        }),
      },
    ]);
  });
});
