import type {
  PayrollProof,
  PayrollPublicInputs,
  ZkArtifacts,
  ZkProofRequest,
} from "@/types";
import { sha256Hex } from "./hash";

export interface MockProver {
  generateProof(request: ZkProofRequest, artifacts: ZkArtifacts): Promise<PayrollProof>;
  verifyProof(
    proof: PayrollProof,
    publicInputs: PayrollPublicInputs,
    verificationKey: unknown | null
  ): Promise<boolean>;
}

export function createMockProver(): MockProver {
  return {
    async generateProof(request, artifacts) {
      const sortedPrivateInputs = Object.entries(request.privateInputs).sort(
        ([keyA], [keyB]) => keyA.localeCompare(keyB)
      );

      const transcript = [
        request.publicInputs.merkleRoot,
        request.publicInputs.totalPayrollAmount,
        request.publicInputs.payrollPeriodId,
        ...sortedPrivateInputs.map(([key, value]) => `${key}:${value}`),
        `vk:${artifacts.verificationKey ? "loaded" : "missing"}`,
        `wasmBytes:${artifacts.circuitWasm?.byteLength ?? 0}`,
      ].join("|");

      const commitment = await sha256Hex(transcript);

      return {
        publicSignals: [
          request.publicInputs.merkleRoot,
          request.publicInputs.totalPayrollAmount,
          request.publicInputs.payrollPeriodId,
        ],
        proof: {
          scheme: "mock",
          commitment,
          createdAt: new Date().toISOString(),
          artifactHints: {
            hasVerificationKey: Boolean(artifacts.verificationKey),
            circuitWasmBytes: artifacts.circuitWasm?.byteLength ?? 0,
          },
        },
      };
    },

    async verifyProof(proof, publicInputs, verificationKey) {
      const scheme = typeof proof.proof.scheme === "string" ? proof.proof.scheme : "";
      const signalsMatch =
        proof.publicSignals[0] === publicInputs.merkleRoot &&
        proof.publicSignals[1] === publicInputs.totalPayrollAmount &&
        proof.publicSignals[2] === publicInputs.payrollPeriodId;

      return scheme === "mock" && signalsMatch && verificationKey !== undefined;
    },
  };
}
