import type { ScVal } from "./stellar";

export interface PayrollProof {
  publicSignals: string[];
  proof: Record<string, unknown>;
}

export interface ProofVerificationResult {
  isValid: boolean;
  verifiedAt: string;
  error?: string;
}

export interface SalaryCommitment {
  commitment: string;
  nullifier: string;
  employeeId: string;
}

export interface PayrollPublicInputs {
  merkleRoot: string;
  totalPayrollAmount: string;
  payrollPeriodId: string;
}

export interface PayrollSecrets extends PayrollPublicInputs {
  employeeId: string;
  employeeSsn: string;
  salaryAmount: string;
  salt?: string;
}

export interface GeneratedPayrollProof {
  proof: PayrollProof;
  publicInputs: PayrollPublicInputs;
  sorobanArgs: ScVal[];
  verification: ProofVerificationResult;
}

export interface ZkProofRequest {
  privateInputs: Record<string, string>;
  publicInputs: PayrollPublicInputs;
}

export interface ZkEngineInitConfig {
  verificationKeyPath?: string;
  circuitWasmPath?: string;
}

export interface ZkArtifacts {
  verificationKey: unknown | null;
  circuitWasm: ArrayBuffer | null;
}

export interface ZkEngine {
  init(config?: ZkEngineInitConfig): Promise<void>;
  generateProof(request: ZkProofRequest): Promise<PayrollProof>;
  verifyProof(
    proof: PayrollProof,
    publicInputs: PayrollPublicInputs
  ): Promise<ProofVerificationResult>;
}
