# ZK Payroll — Shared Terminology

This document defines common terms used across the [ZK Payroll Dashboard](https://github.com/zkpayroll/zk-payroll-dashboard), [SDK](https://github.com/zkpayroll/zk-payroll-sdk), and [smart contracts](https://github.com/zkpayroll/zk-payroll-contracts). Keeping terminology consistent reduces confusion, improves contributor onboarding, and makes the user-facing payroll experience easier to understand.

## Payroll Operations

| Term | Definition | Used In |
|------|------------|---------|
| **Payroll** | The process of paying employees for a given period. | Dashboard, SDK, Contracts |
| **Payroll run** | A single batch of payments executed in one period. A payroll run covers a fixed set of employees and produces one on-chain transaction. | Dashboard, SDK, Contracts |
| **Payroll period** | The time interval (e.g., weekly, biweekly, monthly) that a payroll run covers. | SDK, Contracts |
| **Salary** | The base compensation amount for an employee per payroll period. | Dashboard, SDK |
| **Salary commitment** | A cryptographic commitment (`sha256(salary \| address \| salt)`) that hides an individual salary amount while allowing on-chain verification. See the [salary commitment type](../types/zk.ts). | Dashboard, SDK |
| **Batch payroll** | A payroll run that processes multiple employees in a single transaction. | Dashboard, SDK |
| **Reconciliation** | The process of comparing submitted payroll data against on-chain results to verify that all employees were paid correctly. | Dashboard |
| **Reconciliation status** | The state of a reconciliation: `pending`, `partial`, `complete`, or `failed`. Defined in the [PayrollRun model](../types/models.ts). | Dashboard |

## Zero-Knowledge Proofs

| Term | Definition | Used In |
|------|------------|---------|
| **Proof** | A zero-knowledge proof (ZK proof) that certifies payroll correctness without revealing individual salary amounts. | Dashboard, SDK, Contracts |
| **Proof generation** | The process of computing a ZK proof from public inputs (e.g., Merkle root, total amount) and private inputs (e.g., individual salaries). | Dashboard, SDK |
| **Verification** | The on-chain or off-chain check that validates a proof against the payroll's public inputs. | Dashboard, SDK, Contracts |
| **Public inputs** | Values revealed during proof verification: `merkleRoot`, `totalPayrollAmount`, `payrollPeriodId`. Defined in the [PayrollPublicInputs type](../types/zk.ts). | SDK, Contracts |
| **Private inputs** | Values kept secret: `employeeId`, `employeeSsn`, `salaryAmount`, `salt`. Defined in the [PayrollSecrets type](../types/zk.ts). | SDK |
| **Nullifier** | A unique value derived from a commitment to prevent double-spending or reuse of a proof. | SDK, Contracts |
| **Merkle root** | The root hash of a Merkle tree containing employee salary commitments, used as a public input to the ZK circuit. | SDK, Contracts |

## Cryptographic Primitives

| Term | Definition | Used In |
|------|------------|---------|
| **Commitment** | A cryptographic hash that binds to a hidden value (e.g., salary) without revealing it. See the [SalaryCommitment type](../types/zk.ts). | Dashboard, SDK, Contracts |
| **Salt** | A random value added to a commitment input to prevent brute-force guessing. | Dashboard, SDK |
| **SHA-256** | The hash function used to generate commitments and proof inputs. | SDK |
| **Circuit** | The ZK circuit definition (R1CS) that encodes the payroll verification logic. | SDK, Contracts |

## Access Control & Auditing

| Term | Definition | Used In |
|------|------------|---------|
| **View key** | A cryptographic key that grants an auditor read-only access to payroll records. | Dashboard, SDK, Contracts |
| **Audit view key** | Synonymous with *view key*; emphasized when contrasting with other key types. | Dashboard, SDK |
| **Full-audit view key** | A view key with expanded scope (all payroll data, not just summaries). | Dashboard |
| **Auditor** | An external party (e.g., compliance officer, regulator) who reviews payroll records using a view key. | Dashboard |
| **Revocation** | The act of invalidating a view key, immediately removing the auditor's access. | Dashboard, SDK, Contracts |

## Network & Accounts

| Term | Definition | Used In |
|------|------------|---------|
| **Treasury** | The Stellar account that holds payroll funds and from which salaries are disbursed. | Dashboard, Contracts |
| **Admin** | The Stellar account authorized to configure the company, manage employees, and initiate payroll runs. | Dashboard, Contracts |
| **Operator** | A role with limited permissions (e.g., initiating payroll but not managing the company). | Dashboard |
| **Testnet** | The Stellar test network used for development and testing. Always capitalized. | Dashboard, SDK, Contracts |
| **Freighter** | The Stellar wallet browser extension used to sign transactions. Always capitalized. | Dashboard |
| **Soroban** | Stellar's smart contract platform that hosts the payroll verification contract. | Dashboard, SDK, Contracts |

## Related Documentation

- [Dashboard Content Style Guide](./CONTENT_STYLE_GUIDE.md) — User-facing copy standards for the dashboard.
- [Dashboard Architecture](./ARCHITECTURE.md) — Technical architecture of the dashboard.
- [ZK Payroll SDK](https://github.com/zkpayroll/zk-payroll-sdk) — TypeScript SDK for proof generation and verification.
- [ZK Payroll Contracts](https://github.com/zkpayroll/zk-payroll-contracts) — Soroban smart contracts for on-chain verification.
