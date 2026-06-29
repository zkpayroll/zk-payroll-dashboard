import { Employee, Company, PayrollTransaction, PayrollRun, ViewKey } from "@/types/models";

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: "emp_001",
    address: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    name: "Alice Mensah",
    email: "alice@zkpayroll.io",
    department: "Engineering",
    salary: 5000,
    salaryCommitment: "0xabc123def456",
    isActive: true,
    status: "active",
    startDate: "2024-01-15T00:00:00Z",
    lastPayment: "2025-02-28T09:01:00Z",
  },
  {
    id: "emp_002",
    address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    name: "Kwame Asante",
    email: "kwame@zkpayroll.io",
    department: "Product",
    salary: 4500,
    salaryCommitment: "0xdef789ghi012",
    isActive: true,
    status: "active",
    startDate: "2024-02-01T00:00:00Z",
    lastPayment: "2025-02-28T09:01:05Z",
  },
  {
    id: "emp_003",
    address: "GBVXCPHJMZ5HZJMBBP3YMBM6HXKH3JRXJBHXJHXJHXJHXJHXJHXJHX",
    name: "Amara Diallo",
    email: "amara@zkpayroll.io",
    department: "Finance",
    salary: 4800,
    salaryCommitment: "0xghi345jkl678",
    isActive: false,
    status: "inactive",
    startDate: "2023-08-01T00:00:00Z",
    lastPayment: "2024-11-30T09:00:00Z",
  },
  {
    id: "emp_004",
    address: "GCZJM2ZPKZM5LZPM2CZJM2ZPKZM5LZPM2CZJM2ZPKZM5LZPM2CZJM2",
    name: "Kofi Boateng",
    email: "",
    department: "",
    salary: 5200,
    salaryCommitment: "",
    isActive: true,
    status: "pending",
    startDate: "2025-03-01T00:00:00Z",
  },
];

export const MOCK_COMPANIES: Company[] = [
  {
    id: "company_001",
    name: "ZK Payroll Inc.",
    admin: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    treasury: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    employeeCount: 2,
    isActive: true,
  },
];

export const MOCK_TRANSACTIONS: PayrollTransaction[] = [
  {
    id: "tx_001",
    companyId: "company_001",
    timestamp: "2025-02-28T09:01:00Z",
    createdAt: "2025-02-28T09:01:00Z",
    totalAmount: 9500,
    employeeCount: 2,
    proof: "0xzkproof_abc123", // ZK proof string
    status: "verified",
    txHash: "abc123def456",
  },
  {
    id: "tx_002",
    companyId: "company_001",
    timestamp: "2025-01-31T09:00:00Z",
    createdAt: "2025-01-31T09:00:00Z",
    totalAmount: 9500,
    employeeCount: 2,
    proof: "0xzkproof_def789",
    status: "verified",
    txHash: "def789ghi012",
  },
  {
    id: "tx_003",
    companyId: "company_001",
    timestamp: "2025-03-31T09:00:00Z",
    createdAt: "2025-03-31T09:00:00Z",
    totalAmount: 9500,
    employeeCount: 2,
    proof: "",
    status: "pending",
  },
];

export const MOCK_PAYROLL_RUNS: PayrollRun[] = MOCK_TRANSACTIONS.map(tx => ({
  ...tx,
  employeeIds: ["emp_001", "emp_002"],
  executedAt: tx.status === "verified" ? tx.timestamp : null,
  transactionHash: tx.txHash || null,
}));

export const MOCK_TREASURY_BALANCE = {
  balance: 45000,
  projectedPayroll: 19500,
  lastFunded: "2025-02-15T10:00:00Z",
};

export const MOCK_VIEW_KEYS: ViewKey[] = [
  {
    id: "vk_001",
    keyId: "vk_audit_abc123",
    auditorName: "Sarah Chen",
    auditorOrg: "Deloitte",
    scope: "full-audit",
    grantedBy: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    createdAt: "2025-01-15T10:00:00Z",
    expiresAt: "2026-01-15T10:00:00Z",
    isActive: true,
  },
  {
    id: "vk_002",
    keyId: "vk_audit_def456",
    auditorName: "James Okafor",
    auditorOrg: "KPMG",
    scope: "read-only",
    grantedBy: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    createdAt: "2025-06-01T08:00:00Z",
    expiresAt: "2025-12-01T08:00:00Z",
    isActive: false,
    revokedAt: "2025-11-15T14:30:00Z",
  },
];
