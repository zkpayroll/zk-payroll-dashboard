export interface Employee {
  id: string;
  address: string;
  name: string;
  email?: string;
  department?: string;
  salary: number;
  salaryCommitment: string;
  isActive: boolean;
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

export type UserRole = "admin" | "employee";

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
