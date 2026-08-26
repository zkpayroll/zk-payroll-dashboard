/**
 * SDK-style payload inspector for payroll signing payloads.
 *
 * Takes a raw Soroban / Stellar transaction payload (or a structured
 * PayrollRun-like object) and produces a human-readable summary that
 * approvers can review before signing. Private fields are redacted
 * by default via `redactPayload`.
 */

import { redactPayload, resetEmployeeCounter, type RedactionResult } from "./redact";

// ── Types ───────────────────────────────────────────────────────────────────

export interface PayloadField {
  label: string;
  value: string;
  sensitive: boolean;
}

export interface PayloadSection {
  title: string;
  fields: PayloadField[];
}

export interface PayloadSummary {
  title: string;
  sections: PayloadSection[];
  warnings: string[];
  redactedFieldCount: number;
  isRecognized: boolean;
}

export interface InspectOptions {
  /** Skip redaction (e.g. for auditor role with full-audit scope). */
  showPrivate?: boolean;
}

// ── Payload type detection ──────────────────────────────────────────────────

type DetectedKind =
  | "payroll-run"
  | "multi-asset-run"
  | "soroban-call"
  | "proof-verification"
  | "unknown";

function detectKind(payload: Record<string, unknown>): DetectedKind {
  if (payload.employeeIds || payload.approvalStatus || payload.proof) return "payroll-run";
  if (payload.assetGroups || payload.label) return "multi-asset-run";
  if (payload.contractId && payload.method) return "soroban-call";
  if (payload.publicSignals || payload.merkleRoot) return "proof-verification";
  return "unknown";
}

// ── Field formatting helpers ────────────────────────────────────────────────

function fmt(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") {
    // Truncate long hashes/proofs for readability
    if (value.length > 64) return `${value.slice(0, 20)}…${value.slice(-8)}`;
    return value;
  }
  if (Array.isArray(value)) return `${value.length} item(s)`;
  return JSON.stringify(value);
}

function field(
  label: string,
  value: unknown,
  sensitive = false,
): PayloadField {
  return { label, value: fmt(value), sensitive };
}

// ── Section builders ────────────────────────────────────────────────────────

function buildPayrollRunSections(
  data: Record<string, unknown>,
): PayloadSection[] {
  const sections: PayloadSection[] = [];

  // Overview
  const overview: PayloadField[] = [];
  if (data.id) overview.push(field("Payroll ID", data.id));
  if (data.companyId) overview.push(field("Company ID", data.companyId));
  if (data.status) overview.push(field("Status", data.status));
  if (data.approvalStatus) overview.push(field("Approval Status", data.approvalStatus));
  if (data.createdAt) overview.push(field("Created", data.createdAt));
  if (data.executedAt) overview.push(field("Executed", data.executedAt));
  if (overview.length > 0) sections.push({ title: "Overview", fields: overview });

  // Disbursement
  const disbursement: PayloadField[] = [];
  if (data.totalAmount !== undefined) disbursement.push(field("Total Amount", data.totalAmount, true));
  if (data.employeeCount !== undefined) disbursement.push(field("Employee Count", data.employeeCount));
  if (data.employeeIds) disbursement.push(field("Employee IDs", data.employeeIds));
  if (disbursement.length > 0) sections.push({ title: "Disbursement", fields: disbursement });

  // Proof
  const proof: PayloadField[] = [];
  if (data.proof) proof.push(field("ZK Proof", data.proof, true));
  if (data.proofStatus) proof.push(field("Proof Status", data.proofStatus));
  if (data.txHash) proof.push(field("Transaction Hash", data.txHash));
  if (data.transactionHash) proof.push(field("Transaction Hash", data.transactionHash));
  if (proof.length > 0) sections.push({ title: "Cryptographic Proof", fields: proof });

  // Reconciliation
  if (data.reconciliationStatus) {
    sections.push({
      title: "Reconciliation",
      fields: [
        field("Reconciliation Status", data.reconciliationStatus),
      ],
    });
  }

  return sections;
}

function buildMultiAssetSections(
  data: Record<string, unknown>,
): PayloadSection[] {
  const sections: PayloadSection[] = [];

  const overview: PayloadField[] = [];
  if (data.id) overview.push(field("Run ID", data.id));
  if (data.label) overview.push(field("Label", data.label));
  if (data.companyId) overview.push(field("Company ID", data.companyId));
  if (data.status) overview.push(field("Status", data.status));
  if (data.createdAt) overview.push(field("Created", data.createdAt));
  if (data.totalEmployees !== undefined) overview.push(field("Total Employees", data.totalEmployees));
  if (overview.length > 0) sections.push({ title: "Overview", fields: overview });

  if (data.assetGroups && Array.isArray(data.assetGroups)) {
    for (const group of data.assetGroups as Record<string, unknown>[]) {
      const asset = group.asset as Record<string, unknown> | undefined;
      const assetLabel = asset?.code ? String(asset.code) : "Unknown Asset";
      const groupFields: PayloadField[] = [];
      if (group.totalAmount !== undefined) groupFields.push(field("Total", group.totalAmount, true));
      if (group.transactionCount !== undefined) groupFields.push(field("Transactions", group.transactionCount));
      if (group.status) groupFields.push(field("Status", group.status));
      if (groupFields.length > 0) {
        sections.push({ title: `Asset: ${assetLabel}`, fields: groupFields });
      }
    }
  }

  return sections;
}

function buildSorobanCallSections(
  data: Record<string, unknown>,
): PayloadSection[] {
  const sections: PayloadSection[] = [];

  sections.push({
    title: "Contract Call",
    fields: [
      field("Contract ID", data.contractId),
      field("Method", data.method),
      field("Arguments", data.args),
    ],
  });

  return sections;
}

function buildProofVerificationSections(
  data: Record<string, unknown>,
): PayloadSection[] {
  const sections: PayloadSection[] = [];

  sections.push({
    title: "Proof Details",
    fields: [
      field("Merkle Root", data.merkleRoot, true),
      field("Total Payroll Amount", data.totalPayrollAmount, true),
      field("Period ID", data.payrollPeriodId),
      field("Public Signals", data.publicSignals),
    ],
  });

  return sections;
}

function buildUnknownSections(
  data: Record<string, unknown>,
): PayloadSection[] {
  const fields: PayloadField[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== "object" || value === null) {
      fields.push(field(key, value));
    } else {
      fields.push(field(key, Array.isArray(value) ? `${(value as unknown[]).length} item(s)` : "{object}"));
    }
  }
  return fields.length > 0 ? [{ title: "Payload Fields", fields }] : [];
}

// ── Warnings ────────────────────────────────────────────────────────────────

function buildWarnings(
  data: Record<string, unknown>,
  kind: DetectedKind,
  redactedFields: number,
): string[] {
  const warnings: string[] = [];

  if (kind === "unknown") {
    warnings.push(
      "This payload type is not recognized. Review the raw fields carefully before signing.",
    );
  }

  if (redactedFields > 0) {
    warnings.push(
      `${redactedFields} field(s) contain private data and have been redacted for safety.`,
    );
  }

  const status = data.status as string | undefined;
  if (status === "failed") {
    warnings.push("This payroll run has a failed status. Signing may not be appropriate.");
  }

  const approvalStatus = data.approvalStatus as string | undefined;
  if (approvalStatus === "rejected") {
    warnings.push("This payroll draft has been rejected. It should not be signed.");
  }

  if (approvalStatus === "correction_requested") {
    warnings.push("Corrections have been requested on this draft. Review changes before signing.");
  }

  return warnings;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Inspect a payroll signing payload and return a human-readable summary.
 *
 * By default, private fields (employee names, salaries, memos, secrets)
 * are redacted. Pass `{ showPrivate: true }` to skip redaction (e.g. for
 * auditors with full-audit scope).
 */
export function inspectPayload(
  rawPayload: Record<string, unknown>,
  options?: InspectOptions,
): PayloadSummary {
  resetEmployeeCounter();

  const showPrivate = options?.showPrivate ?? false;

  let data: Record<string, unknown>;
  let redactedFieldCount = 0;

  if (showPrivate) {
    data = rawPayload;
  } else {
    const result: RedactionResult<Record<string, unknown>> = redactPayload(rawPayload);
    data = result.data;
    redactedFieldCount = result.redactedFields.length;
  }

  const kind = detectKind(data);

  let sections: PayloadSection[];
  let title: string;

  switch (kind) {
    case "payroll-run":
      title = "Payroll Run";
      sections = buildPayrollRunSections(data);
      break;
    case "multi-asset-run":
      title = "Multi-Asset Payroll Run";
      sections = buildMultiAssetSections(data);
      break;
    case "soroban-call":
      title = "Soroban Contract Call";
      sections = buildSorobanCallSections(data);
      break;
    case "proof-verification":
      title = "ZK Proof Verification";
      sections = buildProofVerificationSections(data);
      break;
    default:
      title = "Unknown Payload";
      sections = buildUnknownSections(data);
      break;
  }

  const warnings = buildWarnings(data, kind, redactedFieldCount);

  return {
    title,
    sections,
    warnings,
    redactedFieldCount,
    isRecognized: kind !== "unknown",
  };
}

/**
 * Produce a plain-text copy-safe summary of the payload.
 * Always redacted — never includes private data.
 */
export function buildCopySafeSummary(
  rawPayload: Record<string, unknown>,
): string {
  const summary = inspectPayload(rawPayload);
  const lines: string[] = [];

  lines.push(`=== ${summary.title} ===`);
  lines.push("");

  for (const section of summary.sections) {
    lines.push(`--- ${section.title} ---`);
    for (const f of section.fields) {
      const marker = f.sensitive ? " [redacted]" : "";
      lines.push(`  ${f.label}: ${f.value}${marker}`);
    }
    lines.push("");
  }

  if (summary.warnings.length > 0) {
    lines.push("--- Warnings ---");
    for (const w of summary.warnings) {
      lines.push(`  ⚠ ${w}`);
    }
    lines.push("");
  }

  lines.push(`Redacted fields: ${summary.redactedFieldCount}`);
  lines.push(`Generated: ${new Date().toISOString()}`);

  return lines.join("\n");
}
