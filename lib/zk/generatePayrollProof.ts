import type {
  GeneratedPayrollProof,
  PayrollPublicInputs,
  PayrollSecrets,
  ZkProofRequest,
} from "@/types";
import { zkEngine } from "./engine";
import { sha256Hex } from "./hash";
import { toSorobanScVals } from "./serialize";

function normalizeRequired(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }

  return normalized;
}

function normalizeInputs(inputs: PayrollSecrets): {
  privateInputs: Record<string, string>;
  publicInputs: PayrollPublicInputs;
} {
  const publicInputs: PayrollPublicInputs = {
    merkleRoot: normalizeRequired(inputs.merkleRoot, "merkleRoot"),
    totalPayrollAmount: normalizeRequired(
      inputs.totalPayrollAmount,
      "totalPayrollAmount"
    ),
    payrollPeriodId: normalizeRequired(inputs.payrollPeriodId, "payrollPeriodId"),
  };

  return {
    privateInputs: {
      employeeId: normalizeRequired(inputs.employeeId, "employeeId"),
      employeeSsn: normalizeRequired(inputs.employeeSsn, "employeeSsn"),
      salaryAmount: normalizeRequired(inputs.salaryAmount, "salaryAmount"),
      salt: inputs.salt?.trim() || "default-salt",
    },
    publicInputs,
  };
}

export async function generatePayrollProof(
  inputs: PayrollSecrets
): Promise<GeneratedPayrollProof> {
  if (typeof window === "undefined") {
    throw new Error("generatePayrollProof must run in the browser");
  }

  const normalized = normalizeInputs(inputs);

  const [employeeIdHash, employeeSsnHash, salaryAmountHash, saltHash] =
    await Promise.all([
      sha256Hex(normalized.privateInputs.employeeId),
      sha256Hex(normalized.privateInputs.employeeSsn),
      sha256Hex(normalized.privateInputs.salaryAmount),
      sha256Hex(normalized.privateInputs.salt),
    ]);

  const request: ZkProofRequest = {
    privateInputs: {
      employeeIdHash,
      employeeSsnHash,
      salaryAmountHash,
      saltHash,
    },
    publicInputs: normalized.publicInputs,
  };

  const proof = await zkEngine.generateProof(request);
  const verification = await zkEngine.verifyProof(proof, normalized.publicInputs);

  return {
    proof,
    publicInputs: normalized.publicInputs,
    sorobanArgs: toSorobanScVals(proof, normalized.publicInputs),
    verification,
  };
}
