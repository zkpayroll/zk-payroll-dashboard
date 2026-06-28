export interface Employee {
  id: string;
  address: string;
  name: string;
  email?: string;
  department?: string;
  salary: number;
  salaryCommitment: string;
  isActive: boolean;
  status?: "active" | "inactive" | "pending";
  startDate: string;
  lastPayment?: string;
}

export interface Company {
  id: string;
  name: string;
  admin: string;
  treasury: string;
  employeeCount: number;
  isActive: boolean;
}

export type UserRole = "admin" | "operator" | "auditor";

export interface SessionPayload {
  publicKey: string;
  role: UserRole;
  expiresAt: number;
}

export interface PayrollTransaction {
  id: string;
  companyId: string;
  timestamp: string;
  createdAt: string; // Added for consistency with API filters
  totalAmount: number;
  employeeCount: number;
  proof: string;
  status: "pending" | "verified" | "failed";
  txHash?: string;
}

export interface PayrollRun extends PayrollTransaction {
  employeeIds: string[];
  executedAt?: string | null;
  transactionHash?: string | null;
}

export interface ViewKey {
  id: string;
  keyId: string;
  auditorName: string;
  auditorOrg: string;
  scope: "read-only" | "full-audit";
  grantedBy: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  revokedAt?: string | null;
}

export type PayrollWizardStep = "review" | "proof" | "confirm" | "submit";

export interface PayrollWizardState {
  currentStep: PayrollWizardStep;
  employeeIds: string[];
  totalAmount: number;
  proof: string | null;
  proofStatus: "idle" | "generating" | "success" | "error";
  proofError: string | null;
  submissionStatus: "idle" | "submitting" | "success" | "error";
  submissionError: string | null;
  transactionHash: string | null;
}
