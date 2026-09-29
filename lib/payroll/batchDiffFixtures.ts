import type { BatchRow } from "@/lib/payroll/batchDiff";

/**
 * Fixtures for common batch diff cases (#336). Used by the review screen
 * and QA to exercise additions, removals, and edits deterministically.
 */
export interface BatchDiffFixture {
  key: string;
  label: string;
  description: string;
  approvedRows: BatchRow[];
  currentRows: BatchRow[];
}

function row(
  employeeId: string,
  name: string,
  walletAddress: string,
  assetCode: string,
  salaryCommitment: string,
  salaryAmount?: number,
): BatchRow {
  return { employeeId, name, walletAddress, assetCode, salaryCommitment, salaryAmount };
}

const WALLET_A = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const WALLET_B = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
const WALLET_C = "GCZJM2ZPKZM5LZPM2CZJM2ZPKZM5LZPM2CZJM2ZPKZM5LZPM2CZJM2";
const WALLET_D = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W38";

export const BATCH_DIFF_FIXTURES: BatchDiffFixture[] = [
  {
    key: "empty",
    label: "No changes",
    description: "Current draft matches the previously approved draft exactly.",
    approvedRows: [
      row("emp_001", "Alice Mensah", WALLET_A, "USDC", "0xabc123def456", 3500),
      row("emp_002", "Kwame Asante", WALLET_B, "USDC", "0xdef789ghi012", 3200),
    ],
    currentRows: [
      row("emp_001", "Alice Mensah", WALLET_A, "USDC", "0xabc123def456", 3500),
      row("emp_002", "Kwame Asante", WALLET_B, "USDC", "0xdef789ghi012", 3200),
    ],
  },
  {
    key: "additions",
    label: "Additions only",
    description: "New recipients joined the batch after the last approval.",
    approvedRows: [
      row("emp_001", "Alice Mensah", WALLET_A, "USDC", "0xabc123def456", 3500),
    ],
    currentRows: [
      row("emp_001", "Alice Mensah", WALLET_A, "USDC", "0xabc123def456", 3500),
      row("emp_003", "Abena Ofori", WALLET_C, "USDC", "0xnew333commit", 2800),
    ],
  },
  {
    key: "removals",
    label: "Removals only",
    description: "A previously approved recipient was removed from the batch.",
    approvedRows: [
      row("emp_001", "Alice Mensah", WALLET_A, "USDC", "0xabc123def456", 3500),
      row("emp_004", "Kofi Boateng", WALLET_C, "XLM", "0xxlm444commit", 15000),
    ],
    currentRows: [
      row("emp_001", "Alice Mensah", WALLET_A, "USDC", "0xabc123def456", 3500),
    ],
  },
  {
    key: "wallet-change",
    label: "Wallet change",
    description: "A recipient updated their payout wallet address.",
    approvedRows: [
      row("emp_001", "Alice Mensah", WALLET_A, "USDC", "0xabc123def456", 3500),
    ],
    currentRows: [
      row("emp_001", "Alice Mensah", WALLET_D, "USDC", "0xabc123def456", 3500),
    ],
  },
  {
    key: "asset-and-amount-change",
    label: "Asset change",
    description: "A recipient switched payment asset; the private amount changed with it.",
    approvedRows: [
      row("emp_004", "Kofi Boateng", WALLET_C, "XLM", "0xxlm444commit", 15000),
    ],
    currentRows: [
      row("emp_004", "Kofi Boateng", WALLET_C, "EURC", "0xeurc555commit", 8000),
    ],
  },
  {
    key: "commitment-change",
    label: "Commitment change (blocked)",
    description:
      "A salary commitment no longer matches the approved proof — this row blocks approval.",
    approvedRows: [
      row("emp_001", "Alice Mensah", WALLET_A, "USDC", "0xabc123def456"),
      row("emp_002", "Kwame Asante", WALLET_B, "USDC", "0xdef789ghi012"),
    ],
    currentRows: [
      row("emp_001", "Alice Mensah", WALLET_A, "USDC", "0xabc123def456"),
      row("emp_002", "Kwame Asante", WALLET_B, "USDC", "0xrotated999commit"),
    ],
  },
  {
    key: "large",
    label: "Large diff (250 rows)",
    description: "Stress case: many additions on top of an approved baseline.",
    approvedRows: Array.from({ length: 100 }, (_, i) =>
      row(
        `emp_${String(i + 1).padStart(3, "0")}`,
        `Employee ${i + 1}`,
        i % 2 === 0 ? WALLET_A : WALLET_B,
        "USDC",
        `0xcommit${String(i).padStart(4, "0")}`,
        1000 + i,
      ),
    ),
    currentRows: [
      ...Array.from({ length: 60 }, (_, i) =>
        row(
          `emp_${String(i + 1).padStart(3, "0")}`,
          `Employee ${i + 1}`,
          i % 2 === 0 ? WALLET_A : WALLET_D,
          "USDC",
          `0xcommit${String(i).padStart(4, "0")}`,
          1000 + i,
        ),
      ),
      ...Array.from({ length: 190 }, (_, i) =>
        row(
          `emp_new_${String(i + 1).padStart(3, "0")}`,
          `New employee ${i + 1}`,
          i % 2 === 0 ? WALLET_C : WALLET_D,
          "EURC",
          `0xnewcommit${String(i).padStart(4, "0")}`,
          900 + i,
        ),
      ),
    ],
  },
];

export function getBatchDiffFixture(key: string): BatchDiffFixture {
  return BATCH_DIFF_FIXTURES.find((f) => f.key === key) ?? BATCH_DIFF_FIXTURES[0];
}
