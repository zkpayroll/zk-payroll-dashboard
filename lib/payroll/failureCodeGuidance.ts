/**
 * Payroll failure code guidance mapping.
 *
 * Maps payroll failure codes to user-facing guidance, remediation steps,
 * and severity levels. Preserves privacy by never exposing salary data,
 * employee PII, or sensitive transaction details.
 */

export type PayrollFailureCodeSeverity = "critical" | "error" | "warning";

export interface PayrollFailureGuidance {
  code: string;
  title: string;
  severity: PayrollFailureCodeSeverity;
  summary: string;
  userFacingMessage: string;
  remediation: string[];
  affectedArea: "import" | "validation" | "execution" | "audit" | "unknown";
  relatedDocs?: string;
}

const PAYROLL_FAILURE_REGISTRY: Record<string, PayrollFailureGuidance> = {
  IMPORT_DUPLICATE_COMMITMENT: {
    code: "IMPORT_DUPLICATE_COMMITMENT",
    title: "Duplicate commitment in import",
    severity: "error",
    summary: "The import contains duplicate salary commitments for the same recipient.",
    userFacingMessage:
      "Cannot import: duplicate salary commitments detected. Each employee must appear only once per import batch.",
    remediation: [
      "Review the import file and identify rows with identical addresses and amounts.",
      "Remove all duplicate rows, keeping only one instance per unique commitment.",
      "Verify the import with the duplicate check before resubmitting.",
    ],
    affectedArea: "import",
  },
  SEGREGATION_DUTY_VIOLATION: {
    code: "SEGREGATION_DUTY_VIOLATION",
    title: "Segregation of duties violation",
    severity: "critical",
    summary:
      "The same operator cannot both create and approve the same payroll batch.",
    userFacingMessage:
      "This payroll requires approval from a different operator due to segregation of duties policy.",
    remediation: [
      "Contact an operator with approval authority to review and approve the batch.",
      "Review the company segregation of duties policy in Admin Settings.",
      "If you believe this is an error, escalate to your administrator.",
    ],
    affectedArea: "validation",
  },
  AUDIT_SCHEMA_VERSION_MISMATCH: {
    code: "AUDIT_SCHEMA_VERSION_MISMATCH",
    title: "Audit event schema version mismatch",
    severity: "warning",
    summary:
      "The audit export contains events with different schema versions.",
    userFacingMessage:
      "The audit export includes events from multiple schema versions. This is normal for exports spanning system updates.",
    remediation: [
      "Review the schema version column in the audit export to understand event variations.",
      "Contact your auditor to confirm compatibility with their import tools.",
      "Archive exports separately by schema version if needed for compatibility.",
    ],
    affectedArea: "audit",
  },
  PROOF_GENERATION_FAILURE: {
    code: "PROOF_GENERATION_FAILURE",
    title: "Zero-knowledge proof generation failed",
    severity: "error",
    summary: "The ZK proof could not be generated for the payroll batch.",
    userFacingMessage:
      "Unable to generate the cryptographic proof required for payroll execution.",
    remediation: [
      "Review the payroll amounts and employee roster for inconsistencies.",
      "Check the proof generation logs for specific error details.",
      "Try generating a new proof with the Execute wizard.",
      "If the issue persists, escalate with the payroll batch ID.",
    ],
    affectedArea: "execution",
  },
  TREASURY_INSUFFICIENT_FUNDS: {
    code: "TREASURY_INSUFFICIENT_FUNDS",
    title: "Insufficient treasury funds",
    severity: "critical",
    summary: "The treasury balance does not cover the total payroll amount.",
    userFacingMessage:
      "The company treasury does not have enough funds to process this payroll.",
    remediation: [
      "Check the Treasury balance and confirm available funds.",
      "Add funds to the treasury or reduce the payroll amount.",
      "Re-run the payroll simulation once funds are available.",
    ],
    affectedArea: "execution",
  },
  AUTHORIZATION_FAILURE: {
    code: "AUTHORIZATION_FAILURE",
    title: "Operator not authorized",
    severity: "error",
    summary: "The signed-in operator lacks required permissions.",
    userFacingMessage:
      "Your account does not have permission to perform this payroll operation.",
    remediation: [
      "Confirm you are signed in with the correct operator account.",
      "Contact an administrator to grant the required permissions.",
      "Try signing out and back in if the issue persists.",
    ],
    affectedArea: "validation",
  },
  COMPANY_INACTIVE: {
    code: "COMPANY_INACTIVE",
    title: "Referenced company is inactive",
    severity: "critical",
    summary: "The payroll run references an inactive or archived company profile.",
    userFacingMessage:
      "This payroll run references an inactive company. Payroll actions and disbursements are restricted until the company is reactivated.",
    remediation: [
      "Reactivate the company in Company Settings or switch company context.",
      "Verify administrative signing authority and smart contract configuration.",
      "Ensure all organization compliance and identity requirements are satisfied.",
    ],
    affectedArea: "validation",
  },
  COMPANY_NOT_FOUND: {
    code: "COMPANY_NOT_FOUND",
    title: "Referenced company not found",
    severity: "error",
    summary: "The company ID referenced by the payroll run does not exist in the directory.",
    userFacingMessage:
      "The company referenced by this payroll run could not be found in the organization directory.",
    remediation: [
      "Confirm the company identifier is registered in company settings.",
      "Switch to an active company context.",
      "Re-import or recreate the payroll batch under a valid company profile.",
    ],
    affectedArea: "validation",
  },
  // #792 — The registry contract rejects a payout because the caller's wallet
  // is not the registered owner for this payroll batch. Guidance must be
  // actionable without revealing other operators' addresses or roles.
  REGISTRY_OWNER_PERMISSION_DENIED: {
    code: "REGISTRY_OWNER_PERMISSION_DENIED",
    title: "Payout rejected: registry owner permission required",
    severity: "error",
    summary:
      "The registry contract refused the payout because the connected wallet is not the recorded owner for this payroll batch.",
    userFacingMessage:
      "This payout can only be executed by the wallet registered as the payroll batch owner. Your current wallet is not authorized by the registry for this batch.",
    remediation: [
      "Confirm which wallet is recorded as the payroll owner in Admin → Payroll Settings.",
      "Switch to the owner wallet before retrying the execution.",
      "If the owner needs to change, request an ownership transfer and complete it before resubmitting.",
    ],
    affectedArea: "execution",
  },
  // #797 — The payroll's proof key has rotated since the proof was generated,
  // so verification would fail if the stale key were used. Error text MUST
  // NOT quote the public inputs, witness values, or the stored key blob —
  // these are either sensitive payroll data or carry it indirectly.
  STALE_PROOF_KEY: {
    code: "STALE_PROOF_KEY",
    title: "Proof rejected: verification key out of date",
    severity: "error",
    summary:
      "The verification key used by this proof no longer matches the key registered on-chain for the circuit. The proof itself is intact, but it cannot be verified against the current key.",
    userFacingMessage:
      "The proof was generated against an older verification key. Regenerate the proof with the current key before retrying.",
    remediation: [
      "Open the Execute wizard and request a fresh proof — it will be generated with the live verification key.",
      "If the key was rotated as part of a planned deployment, wait for the registry update to finish propagating before re-running.",
      "Contact your proof operator if the error repeats on a freshly generated proof.",
    ],
    affectedArea: "execution",
  },
};

export function getPayrollFailureGuidance(
  code: string,
): PayrollFailureGuidance | null {
  return PAYROLL_FAILURE_REGISTRY[code] ?? null;
}

export function getFailureGuidanceByArea(
  area: PayrollFailureGuidance["affectedArea"],
): PayrollFailureGuidance[] {
  return Object.values(PAYROLL_FAILURE_REGISTRY).filter(
    (g) => g.affectedArea === area,
  );
}

export function getAllFailureGuidances(): PayrollFailureGuidance[] {
  return Object.values(PAYROLL_FAILURE_REGISTRY);
}

export { PAYROLL_FAILURE_REGISTRY };
