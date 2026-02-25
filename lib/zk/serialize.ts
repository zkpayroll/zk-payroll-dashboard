import type { PayrollProof, PayrollPublicInputs, ScVal } from "@/types";

export function toSorobanScVals(
  proof: PayrollProof,
  publicInputs: PayrollPublicInputs
): ScVal[] {
  const serializedProof = JSON.stringify({
    publicSignals: proof.publicSignals,
    proof: proof.proof,
  });

  return [
    { type: "string", value: publicInputs.merkleRoot },
    { type: "u128", value: publicInputs.totalPayrollAmount },
    { type: "string", value: publicInputs.payrollPeriodId },
    // TODO: Replace with contract-specific ScVal encoding once verifier ABI is finalized.
    { type: "string", value: serializedProof },
  ];
}
