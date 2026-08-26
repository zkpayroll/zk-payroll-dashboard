/**
 * Payload-specific redaction for the signing inspector.
 *
 * Unlike the generic `sanitize` in `lib/sanitize.ts` (which targets log
 * pipelines), this module is purpose-built for the PayloadInspector UI:
 *   - Employee names → "[Employee #N]"
 *   - Private salary amounts → "[REDACTED]"
 *   - Sensitive memo/note fields → "[REDACTED]"
 *   - SSN / secret keys / salts → "[REDACTED]"
 *
 * Public, non-identifying fields (period ID, asset code, employee count,
 * proof status, network, contract addresses) are preserved so the approver
 * can still understand what the payload authorizes.
 */

export interface RedactedField {
  key: string;
  originalType: "name" | "amount" | "memo" | "secret" | "other";
}

export interface RedactionResult<T> {
  data: T;
  redactedFields: RedactedField[];
}

// ── Key-level classification ────────────────────────────────────────────────

const NAME_KEYS = new Set([
  "employeeName",
  "employee_name",
  "name",
  "recipientName",
  "recipient_name",
  "createdByName",
  "createdByName",
  "auditorName",
  "requesterName",
]);

const AMOUNT_KEYS = new Set([
  "salary",
  "salaryAmount",
  "salary_amount",
  "amount",
  "totalAmount",
  "total_amount",
  "individualAmount",
  "disbursement",
  "payment",
]);

const MEMO_KEYS = new Set([
  "memo",
  "note",
  "notes",
  "comment",
  "comments",
  "description",
  "rationale",
  "reason",
  "reasonDescription",
]);

const SECRET_KEYS = new Set([
  "ssn",
  "employeeSsn",
  "employee_ssn",
  "secret",
  "secretKey",
  "secret_key",
  "privateKey",
  "private_key",
  "salt",
  "seed",
  "mnemonic",
  "seedPhrase",
  "password",
  "token",
  "authorization",
  "cookie",
  "session",
  "cipher",
  "nullifier",
  "privateInputs",
  "private_inputs",
  "privateInput",
  "private_input",
]);

// Fields that are always safe to show in the inspector.
const SAFE_KEYS = new Set([
  "id",
  "payrollId",
  "payroll_id",
  "payrollPeriodId",
  "payroll_period_id",
  "periodId",
  "period_id",
  "companyId",
  "company_id",
  "network",
  "asset",
  "assetCode",
  "asset_code",
  "employeeCount",
  "employee_count",
  "recipientCount",
  "recipient_count",
  "status",
  "approvalStatus",
  "approval_status",
  "proofStatus",
  "proof_status",
  "txHash",
  "tx_hash",
  "transactionHash",
  "transaction_hash",
  "contractId",
  "contract_id",
  "verifierContract",
  "verifier_contract",
  "merkleRoot",
  "merkle_root",
  "circuitHash",
  "circuit_hash",
  "publicSignals",
  "public_signals",
  "publicInputs",
  "public_inputs",
  "totalPayrollAmount",
  "total_payroll_amount",
  "frequency",
  "createdAt",
  "created_at",
  "executedAt",
  "executed_at",
  "verifiedAt",
  "verified_at",
  "expiresAt",
  "expires_at",
  "ledgerSequence",
  "ledger_sequence",
  "feeStroops",
  "fee_stroops",
  "type",
  "method",
  "args",
  "scope",
  "isActive",
  "is_active",
  "isVerified",
  "is_verified",
  "isArchived",
  "is_archived",
  "reconciliationStatus",
  "reconciliation_status",
  "verificationStatus",
  "verification_status",
  "riskLevel",
  "risk_level",
  "overallScore",
  "overall_score",
  "severity",
  "label",
  "title",
  "summary",
  "category",
  "weight",
  "checksPassed",
  "checks_passed",
  "totalChecks",
  "total_checks",
  "processedCount",
  "processed_count",
  "totalCount",
  "total_count",
  "discrepancyCount",
  "discrepancy_count",
  "confidence",
  "daysOverdue",
  "days_overdue",
  "readyForPayroll",
  "ready_for_payroll",
  "completedCount",
  "completed_count",
  "overallStatus",
  "overall_status",
  "classification",
  "stage",
  "sequence",
  "correlationId",
  "correlation_id",
  "timestamp",
  "durationMs",
  "duration_ms",
  "retryCount",
  "retry_count",
  "maxRetries",
  "max_retries",
  "errorCategory",
  "error_category",
  "errorLabel",
  "error_label",
  "errorMessage",
  "error_message",
  "action",
  "actor",
  "role",
  "eventHash",
  "event_hash",
  "timelineRoot",
  "timeline_root",
  "exported",
  "bundleId",
  "bundle_id",
  "receiptId",
  "receipt_id",
  "proofId",
  "proof_id",
  "receiptHash",
  "receipt_hash",
  "rawProofHash",
  "raw_proof_hash",
  "publicSignalsDigest",
  "public_signals_digest",
  "proofStatus",
  "proof_status",
  "viewKeyId",
  "view_key_id",
  "keyId",
  "key_id",
  "auditorOrg",
  "auditor_org",
  "requesterOrg",
  "requester_org",
  "requesterEmail",
  "requester_email",
  "revokedAt",
  "revoked_at",
  "revokedBy",
  "revoked_by",
  "revocationReason",
  "revocation_reason",
  "grantedBy",
  "granted_by",
  "attachmentUrl",
  "attachment_url",
  "actionUrl",
  "action_url",
  "nextScheduled",
  "next_scheduled",
  "lastExecuted",
  "last_executed",
  "lastPayment",
  "last_payment",
  "startDate",
  "start_date",
  "dayOfMonth",
  "day_of_month",
  "dayOfWeek",
  "day_of_week",
  "updatedAt",
  "updated_at",
  "onboardingStatus",
  "onboarding_status",
  "onboardingRetryCount",
  "onboarding_retry_count",
  "onboardingError",
  "onboarding_error",
  "lastOnboardingAttemptAt",
  "last_onboarding_attempt_at",
  "resolutionAction",
  "resolution_action",
  "isResolved",
  "is_resolved",
  "resolvedAt",
  "resolved_at",
  "resolvedBy",
  "resolved_by",
  "lockedAt",
  "locked_at",
  "lockedBy",
  "locked_by",
  "reasonType",
  "reason_type",
  "scheduledDate",
  "scheduled_date",
  "dueDate",
  "due_date",
  "payrollName",
  "payroll_name",
  "description",
  "currentBalance",
  "current_balance",
  "projectedDrain",
  "projected_drain",
  "remainingAfterDrain",
  "remaining_after_drain",
  "reserveThreshold",
  "reserve_threshold",
  "emergencyReserve",
  "emergency_reserve",
  "wouldExceedReserve",
  "would_exceed_reserve",
  "wouldExceedEmergency",
  "would_exceed_emergency",
  "warningEnabled",
  "warning_enabled",
  "estimatedTotal",
  "estimated_total",
  "payrollTotal",
  "payroll_total",
  "bufferReserve",
  "buffer_reserve",
  "miscellaneous",
  "fundingGap",
  "funding_gap",
  "cycleStart",
  "cycle_start",
  "cycleEnd",
  "cycle_end",
  "requiredAmount",
  "required_amount",
  "availableBalance",
  "available_balance",
  "isFunded",
  "is_funded",
  "shortfall",
  "overallScore",
  "overall_score",
  "calculatedAt",
  "calculated_at",
  "isVerified",
  "is_verified",
  "verifiedBy",
  "verified_by",
  "generatedAt",
  "generated_at",
  "canExportAudit",
  "can_export_audit",
  "expectedAmount",
  "expected_amount",
  "confirmedAmount",
  "confirmed_amount",
  "confirmedAt",
  "confirmed_at",
  "transactionCount",
  "transaction_count",
  "totalEmployees",
  "total_employees",
  "totalDisbursed",
  "total_disbursed",
  "totalExpected",
  "total_expected",
  "totalConfirmed",
  "total_confirmed",
  "status",
  "errorMessage",
  "error_message",
  "executedAt",
  "executed_at",
  "network",
  "code",
  "issuer",
  "assetCode",
  "asset_code",
  "contractAddresses",
  "contract_addresses",
  "registry",
  "commitment",
  "verifier",
  "executor",
  "audit",
  "tokenContractId",
  "token_contract_id",
  "auditSettings",
  "audit_settings",
  "enabled",
  "retentionDays",
  "retention_days",
  "requireAuditorApproval",
  "require_auditor_approval",
  "employeeIds",
  "employee_ids",
  "assetGroups",
  "asset_groups",
  "events",
  "receipts",
  "proofReference",
  "proof_reference",
  "transactionMetadata",
  "transaction_metadata",
  "approvalHistory",
  "approval_history",
  "verificationStatus",
  "verification_status",
  "factors",
  "steps",
  "breakdown",
  "uncertaintyFactors",
  "uncertainty_factors",
  "discrepancies",
  "groups",
  "entries",
  "checks",
  "metadata",
  "args",
  "sorobanArgs",
  "soroban_args",
  "proof",
  "publicInputs",
  "public_inputs",
  "publicSignals",
  "public_signals",
  "merkleRoot",
  "merkle_root",
  "totalPayrollAmount",
  "total_payroll_amount",
  "payrollPeriodId",
  "payroll_period_id",
  "verification",
  "isValid",
  "is_valid",
  "error",
]);

function classifyKey(key: string): "name" | "amount" | "memo" | "secret" | "safe" | "unknown" {
  if (SAFE_KEYS.has(key)) return "safe";
  if (NAME_KEYS.has(key)) return "name";
  if (AMOUNT_KEYS.has(key)) return "amount";
  if (MEMO_KEYS.has(key)) return "memo";
  if (SECRET_KEYS.has(key)) return "secret";
  return "unknown";
}

// ── Redaction engine ────────────────────────────────────────────────────────

let employeeCounter = 0;

export function resetEmployeeCounter(): void {
  employeeCounter = 0;
}

function redactValue(
  key: string,
  value: unknown,
  classification: "name" | "amount" | "memo" | "secret" | "safe" | "unknown",
): { value: unknown; wasRedacted: boolean; type?: RedactedField["originalType"] } {
  if (classification === "safe") {
    return { value, wasRedacted: false };
  }

  if (classification === "name" && typeof value === "string" && value.length > 0) {
    employeeCounter++;
    return { value: `[Employee #${employeeCounter}]`, wasRedacted: true, type: "name" };
  }

  if (classification === "amount") {
    return { value: "[REDACTED]", wasRedacted: true, type: "amount" };
  }

  if (classification === "memo" && typeof value === "string" && value.length > 0) {
    return { value: "[REDACTED]", wasRedacted: true, type: "memo" };
  }

  if (classification === "secret") {
    return { value: "[REDACTED]", wasRedacted: true, type: "secret" };
  }

  // Unknown keys: redact to be safe.
  return { value: "[REDACTED]", wasRedacted: true, type: "other" };
}

export function redactPayload<T extends Record<string, unknown>>(
  payload: T,
): RedactionResult<T> {
  const redactedFields: RedactedField[] = [];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    const classification = classifyKey(key);

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const nested = redactPayload(value as Record<string, unknown>);
      result[key] = nested.data;
      redactedFields.push(...nested.redactedFields);
    } else if (Array.isArray(value)) {
      const nestedArr = value.map((item) => {
        if (item !== null && typeof item === "object") {
          const nested = redactPayload(item as Record<string, unknown>);
          redactedFields.push(...nested.redactedFields);
          return nested.data;
        }
        const { value: redactedVal, wasRedacted, type } = redactValue(key, item, classification);
        if (wasRedacted && type) {
          redactedFields.push({ key, originalType: type });
        }
        return redactedVal;
      });
      result[key] = nestedArr;
    } else {
      const { value: redactedVal, wasRedacted, type } = redactValue(key, value, classification);
      result[key] = redactedVal;
      if (wasRedacted && type) {
        redactedFields.push({ key, originalType: type });
      }
    }
  }

  return { data: result as T, redactedFields };
}
