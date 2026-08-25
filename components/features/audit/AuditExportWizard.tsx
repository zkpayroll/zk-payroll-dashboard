"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileJson,
  FileText,
  Info,
  Lock,
  ShieldAlert,
  Table2,
} from "lucide-react";

import { useAuditExportStore } from "@/stores/auditExport";
import type {
  AuditPacketEntry,
  AuditGrant,
  ExportFormat,
  WizardStep,
} from "@/stores/auditExport";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "select", label: "Audit Scope" },
  { key: "review", label: "Review & Redact" },
  { key: "configure", label: "Packet Metadata" },
  { key: "export", label: "Validate & Export" },
  { key: "complete", label: "Complete" },
];

const FORMAT_OPTIONS: {
  value: ExportFormat;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    value: "csv",
    label: "CSV",
    icon: <Table2 className="w-5 h-5" />,
    description: "Spreadsheet-compatible format",
  },
  {
    value: "json",
    label: "JSON",
    icon: <FileJson className="w-5 h-5" />,
    description: "Structured data format",
  },
  {
    value: "pdf",
    label: "PDF",
    icon: <FileText className="w-5 h-5" />,
    description: "Printable report format",
  },
];

const TYPE_LABELS: Record<
  AuditPacketEntry["type"],
  string
> = {
  payroll_run: "Payroll Run",
  transaction: "Transaction",
  compliance_event: "Compliance Event",
  key_access_log: "Key Access Log",
  treasury_movement: "Treasury Movement",
};

const SENSITIVE_FIELD_PATTERNS = [
  "salary",
  "amount",
  "employee_id",
  "employee_name",
  "email",
  "phone",
  "address",
  "wallet",
  "recipient",
  "sender",
  "account",
  "bank",
  "ssn",
  "tax",
  "dob",
  "date_of_birth",
  "private_key",
  "secret",
];

function isSensitiveField(field: string): boolean {
  const normalized = field.toLowerCase();

  return SENSITIVE_FIELD_PATTERNS.some((pattern) =>
    normalized.includes(pattern)
  );
}

function formatFieldName(field: string): string {
  return field
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function PrivacyWarning({
  title,
  children,
  severity = "warning",
}: {
  title: string;
  children: React.ReactNode;
  severity?: "warning" | "danger" | "info";
}) {
  const styles = {
    warning: {
      container: "bg-amber-50 border-amber-200",
      icon: "text-amber-600",
      title: "text-amber-900",
      body: "text-amber-800",
    },
    danger: {
      container: "bg-red-50 border-red-200",
      icon: "text-red-600",
      title: "text-red-900",
      body: "text-red-800",
    },
    info: {
      container: "bg-blue-50 border-blue-200",
      icon: "text-blue-600",
      title: "text-blue-900",
      body: "text-blue-800",
    },
  };

  const style = styles[severity];

  return (
    <div
      className={`border rounded-lg p-4 ${style.container}`}
      role={severity === "danger" ? "alert" : "status"}
    >
      <div className="flex items-start gap-3">
        {severity === "danger" ? (
          <ShieldAlert
            className={`w-5 h-5 shrink-0 ${style.icon}`}
          />
        ) : severity === "warning" ? (
          <AlertTriangle
            className={`w-5 h-5 shrink-0 ${style.icon}`}
          />
        ) : (
          <Info
            className={`w-5 h-5 shrink-0 ${style.icon}`}
          />
        )}

        <div>
          <p
            className={`text-sm font-semibold ${style.title}`}
          >
            {title}
          </p>

          <div
            className={`text-xs mt-1 leading-relaxed ${style.body}`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({
  currentStep,
}: {
  currentStep: WizardStep;
}) {
  const currentIndex = STEPS.findIndex(
    (step) => step.key === currentStep
  );

  return (
    <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
      {STEPS.map((step, index) => (
        <div
          key={step.key}
          className="flex items-center gap-1 sm:gap-2 shrink-0"
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
              index < currentIndex
                ? "bg-green-100 text-green-700"
                : index === currentIndex
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-500"
            }`}
          >
            {index < currentIndex ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              index + 1
            )}
          </div>

          <span
            className={`hidden sm:inline text-xs ${
              index === currentIndex
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {step.label}
          </span>

          {index < STEPS.length - 1 && (
            <ChevronRight className="w-4 h-4 text-muted-foreground hidden sm:block" />
          )}
        </div>
      ))}
    </div>
  );
}

function SelectStep() {
  const {
    entries,
    searchQuery,
    setSearchQuery,
    toggleEntry,
    selectAll,
    deselectAll,
    getFilteredEntries,
  } = useAuditExportStore();

  const [typeFilter, setTypeFilter] =
    useState<string>("all");

  const filteredEntries = getFilteredEntries(
    typeFilter === "all"
      ? undefined
      : (typeFilter as AuditPacketEntry["type"])
  );

  const selectedCount = entries.filter(
    (entry) => entry.selected
  ).length;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">
          Select Audit Scope
        </h3>

        <p className="text-sm text-muted-foreground mt-1">
          Choose exactly which audit records should be
          included in the packet.
        </p>
      </div>

      <PrivacyWarning
        title="Review the disclosure scope carefully"
        severity="info"
      >
        Only selected records will be included in the audit
        packet. Sensitive fields will be redacted by default.
      </PrivacyWarning>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {entries.length} records available,{" "}
          <span className="font-medium text-foreground">
            {selectedCount} selected
          </span>
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={selectAll}
            className="text-sm text-blue-600 hover:underline"
          >
            Select all
          </button>

          <button
            type="button"
            onClick={deselectAll}
            className="text-sm text-muted-foreground hover:underline"
          >
            Deselect all
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search records..."
          value={searchQuery}
          onChange={(event) =>
            setSearchQuery(event.target.value)
          }
          className="flex-1 px-4 py-2 border rounded-lg text-sm"
        />

        <select
          value={typeFilter}
          onChange={(event) =>
            setTypeFilter(event.target.value)
          }
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="all">All Types</option>
          <option value="payroll_run">
            Payroll Runs
          </option>
          <option value="transaction">
            Transactions
          </option>
          <option value="compliance_event">
            Compliance Events
          </option>
          <option value="key_access_log">
            Key Access Logs
          </option>
          <option value="treasury_movement">
            Treasury Movements
          </option>
        </select>
      </div>

      <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No records match your filters.
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <label
              key={entry.id}
              className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 ${
                entry.selected
                  ? "bg-blue-50/50"
                  : ""
              }`}
            >
              <input
                type="checkbox"
                checked={entry.selected}
                onChange={() =>
                  toggleEntry(entry.id)
                }
                className="h-4 w-4 mt-0.5 rounded"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {entry.title}
                  </span>

                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {TYPE_LABELS[entry.type]}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground mt-1">
                  {entry.summary}
                </p>

                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(
                    entry.date
                  ).toLocaleDateString()}
                </p>
              </div>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

function ReviewStep() {
  const {
    getSelectedEntries,
    redactions,
    initializeRedactions,
    toggleFieldRedaction,
    redactAllSensitiveFields,
  } = useAuditExportStore();

  const selected = getSelectedEntries();

  useEffect(() => {
    initializeRedactions();
  }, [initializeRedactions, selected.length]);

  const fields = useMemo(() => {
    return Array.from(
      new Set(
        selected.flatMap(
          (entry) => entry.fields
        )
      )
    );
  }, [selected]);

  const sensitiveFields = fields.filter(
    isSensitiveField
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">
          Review & Redact
        </h3>

        <p className="text-sm text-muted-foreground mt-1">
          Review exactly what the audit packet contains.
          Sensitive fields are redacted by default.
        </p>
      </div>

      <PrivacyWarning
        title="Sensitive fields are redacted by default"
        severity="warning"
      >
        Financial, personal, account, wallet, credential,
        and other sensitive fields are automatically
        protected.
      </PrivacyWarning>

      {sensitiveFields.length > 0 && (
        <div className="flex items-center justify-between border rounded-lg p-4">
          <div>
            <p className="text-sm font-semibold">
              {sensitiveFields.length} sensitive fields
              detected
            </p>

            <p className="text-xs text-muted-foreground mt-1">
              Keep sensitive information redacted unless
              disclosure is explicitly authorized.
            </p>
          </div>

          <button
            type="button"
            onClick={redactAllSensitiveFields}
            className="text-sm text-blue-600 hover:underline"
          >
            Redact all
          </button>
        </div>
      )}

      <div className="border rounded-lg divide-y">
        {selected.map((entry) => (
          <div key={entry.id} className="p-4">
            <div className="flex items-start gap-3">
              <Eye className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {entry.title}
                  </span>

                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {TYPE_LABELS[entry.type]}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {entry.fields.map((field) => {
                    const sensitive =
                      isSensitiveField(field);

                    const redaction =
                      redactions[field];

                    const isRedacted =
                      redaction?.redacted ??
                      sensitive;

                    return (
                      <div
                        key={`${entry.id}-${field}`}
                        className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                          isRedacted
                            ? "border-amber-200 bg-amber-50"
                            : "border-green-200 bg-green-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isRedacted ? (
                            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                          )}

                          <span className="text-xs truncate">
                            {formatFieldName(field)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            toggleFieldRedaction(
                              field
                            )
                          }
                          className={`text-[10px] font-medium shrink-0 ${
                            isRedacted
                              ? "text-amber-700"
                              : "text-green-700"
                          }`}
                        >
                          {isRedacted
                            ? "REDACTED"
                            : "INCLUDED"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selected.length > 1 && (
        <PrivacyWarning
          title="Risky combination detected"
          severity="warning"
        >
          Combining multiple audit records can reveal more
          information than any single record. Review the
          complete packet rather than reviewing records in
          isolation.
        </PrivacyWarning>
      )}
    </div>
  );
}

function ConfigureStep() {
  const {
    exportFormat,
    setExportFormat,
    includeMetadata,
    setIncludeMetadata,
    dateRangeStart,
    dateRangeEnd,
    setDateRange,
    getSelectedEntries,
  } = useAuditExportStore();

  const selected = getSelectedEntries();

  const fieldCount = new Set(
    selected.flatMap(
      (entry) => entry.fields
    )
  ).size;

  const sensitiveFieldCount = new Set(
    selected
      .flatMap(
        (entry) => entry.fields
      )
      .filter(isSensitiveField)
  ).size;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">
          Packet Metadata
        </h3>

        <p className="text-sm text-muted-foreground mt-1">
          Confirm the final metadata and format before
          export.
        </p>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-4">
          Export format
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {FORMAT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                setExportFormat(option.value)
              }
              className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg ${
                exportFormat === option.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-border hover:border-blue-200"
              }`}
            >
              {option.icon}

              <span className="text-sm font-medium">
                {option.label}
              </span>

              <span className="text-xs text-muted-foreground text-center">
                {option.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-4">
          Audit date range
        </h4>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="date"
            value={dateRangeStart}
            onChange={(event) =>
              setDateRange(
                event.target.value,
                dateRangeEnd
              )
            }
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
          />

          <span className="hidden sm:flex items-center text-muted-foreground">
            to
          </span>

          <input
            type="date"
            value={dateRangeEnd}
            onChange={(event) =>
              setDateRange(
                dateRangeStart,
                event.target.value
              )
            }
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
          />
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includeMetadata}
            onChange={(event) =>
              setIncludeMetadata(
                event.target.checked
              )
            }
            className="h-4 w-4 mt-0.5 rounded"
          />

          <div>
            <span className="text-sm font-medium">
              Include packet metadata
            </span>

            <p className="text-xs text-muted-foreground mt-1">
              Includes timestamps, hashes, and actor
              information where permitted.
            </p>
          </div>
        </label>
      </div>

      <div className="border rounded-lg bg-gray-50 p-4">
        <h4 className="text-sm font-semibold mb-3">
          Final packet summary
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">
              Records
            </p>
            <p className="text-sm font-semibold mt-1">
              {selected.length}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Fields
            </p>
            <p className="text-sm font-semibold mt-1">
              {fieldCount}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Sensitive
            </p>
            <p className="text-sm font-semibold text-amber-600 mt-1">
              {sensitiveFieldCount}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Format
            </p>
            <p className="text-sm font-semibold uppercase mt-1">
              {exportFormat}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExportStep() {
  const {
    auditGrant,
    grantValidation,
    validateAuditGrant,
    getExportBlockReason,
    getExportBlockMessage,
    canExport,
    startExport,
    activeExportJob,
    updateExportProgress,
    completeExport,
    failExport,
    getSelectedEntries,
  } = useAuditExportStore();

  const [confirmed, setConfirmed] =
    useState(false);

  const selected = getSelectedEntries();

  /*
   * Validate the grant when the export screen is opened.
   */
  useEffect(() => {
    validateAuditGrant();
  }, [validateAuditGrant]);

  const blockReason = getExportBlockReason();
  const blockMessage =
    getExportBlockMessage();

  const exportAllowed = canExport();

  const handleValidate = () => {
    validateAuditGrant();
  };

  const handleStartExport = () => {
    const validation =
      validateAuditGrant();

    if (!validation.valid) {
      return;
    }

    if (!canExport()) {
      return;
    }

    startExport();

    /*
     * The actual packet-generation/export API should eventually
     * replace this simulated progress flow.
     *
     * We deliberately do not generate a fake external download
     * URL anymore.
     */
    let progress = 0;

    const interval = window.setInterval(() => {
      progress += 20;

      if (progress >= 100) {
        window.clearInterval(interval);

        const job =
          useAuditExportStore.getState()
            .activeExportJob;

        if (!job) {
          return;
        }

        completeExport(
          `/api/audit/export/${job.id}`,
          0
        );
      } else {
        updateExportProgress(progress);
      }
    }, 400);
  };

  const handleRetry = () => {
    validateAuditGrant();
  };

  const grantStatus = auditGrant
    ? auditGrant.status
    : "missing";

  const isComplete =
    activeExportJob?.status === "complete";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">
          Validate & Export
        </h3>

        <p className="text-sm text-muted-foreground mt-1">
          Perform the final permission and privacy checks
          before generating the audit packet.
        </p>
      </div>

      <PrivacyWarning
        title="Audit export is a disclosure action"
        severity="danger"
      >
        Exporting creates a packet that may be shared
        outside the organization. The current audit grant,
        scope, and redaction state must all be valid.
      </PrivacyWarning>

      <div className="border rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold">
              Audit grant validation
            </h4>

            <p className="text-xs text-muted-foreground mt-1">
              The export is blocked unless the grant is
              active and covers the selected scope.
            </p>
          </div>

          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              grantStatus === "active"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {grantStatus === "active"
              ? "ACTIVE"
              : grantStatus
                  .replace("_", " ")
                  .toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              Grant
            </p>

            <p className="text-sm font-semibold mt-1">
              {auditGrant?.id ?? "None"}
            </p>
          </div>

          <div className="border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              Records
            </p>

            <p className="text-sm font-semibold mt-1">
              {selected.length}
            </p>
          </div>

          <div className="border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              Validation
            </p>

            <p
              className={`text-sm font-semibold mt-1 ${
                grantValidation.valid
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {grantValidation.valid
                ? "Passed"
                : "Blocked"}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={handleValidate}
            className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
          >
            Revalidate Grant
          </button>
        </div>
      </div>

      {blockReason && blockMessage && (
        <PrivacyWarning
          title="Export blocked"
          severity="danger"
        >
          {blockMessage}
        </PrivacyWarning>
      )}

      {grantValidation.reason && (
        <div className="text-xs text-muted-foreground">
          {grantValidation.reason}
        </div>
      )}

      {!blockReason && (
        <PrivacyWarning
          title="Permission check passed"
          severity="info"
        >
          The current audit grant is active and the selected
          packet is within the validated scope.
        </PrivacyWarning>
      )}

      {!isComplete && (
        <label className="flex items-start gap-3 border rounded-lg p-4 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) =>
              setConfirmed(
                event.target.checked
              )
            }
            disabled={!exportAllowed}
            className="h-4 w-4 mt-0.5 rounded"
          />

          <div>
            <p className="text-sm font-medium">
              I have reviewed the packet contents
            </p>

            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              I confirm that the selected records are
              appropriate for this audit, sensitive fields
              are appropriately redacted, and the export is
              within the authorized audit scope.
            </p>
          </div>
        </label>
      )}

      {!isComplete && !activeExportJob && (
        <button
          type="button"
          onClick={handleStartExport}
          disabled={!exportAllowed || !confirmed}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium ${
            exportAllowed && confirmed
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }`}
        >
          <Download className="w-4 h-4" />

          {!exportAllowed
            ? "Export Blocked"
            : !confirmed
              ? "Confirm Review Before Export"
              : "Start Secure Export"}
        </button>
      )}

      {activeExportJob && (
        <div className="space-y-4">
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {activeExportJob.status ===
                "complete"
                  ? "Export complete"
                  : activeExportJob.status ===
                      "failed"
                    ? "Export failed"
                    : "Exporting..."}
              </span>

              <span className="text-sm text-muted-foreground">
                {activeExportJob.progress}%
              </span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  activeExportJob.status ===
                  "complete"
                    ? "bg-green-500"
                    : activeExportJob.status ===
                        "failed"
                      ? "bg-red-500"
                      : "bg-blue-600"
                }`}
                style={{
                  width: `${activeExportJob.progress}%`,
                }}
              />
            </div>

            <p className="text-xs text-muted-foreground mt-2">
              {activeExportJob.recordCount} records
            </p>

            {activeExportJob.error && (
              <p className="text-xs text-red-600 mt-2">
                {activeExportJob.error}
              </p>
            )}
          </div>

          {activeExportJob.status ===
            "complete" && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />

              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">
                  Export complete
                </p>

                <p className="text-xs text-green-700 mt-1">
                  The export job completed successfully.
                </p>
              </div>

              {activeExportJob.downloadUrl && (
                <a
                  href={
                    activeExportJob.downloadUrl
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              )}
            </div>
          )}

          {activeExportJob.status ===
            "failed" && (
            <button
              type="button"
              onClick={handleRetry}
              className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
            >
              Retry Validation
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CompleteStep() {
  const {
    activeExportJob,
    reset,
  } = useAuditExportStore();

  return (
    <div className="text-center py-8 space-y-5">
      <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />

      <h3 className="text-lg font-semibold">
        Export Complete
      </h3>

      <p className="text-muted-foreground max-w-md mx-auto">
        Your audit packet has been generated successfully.
        The packet contains the records that passed the
        audit scope and privacy validation.
      </p>

      <PrivacyWarning
        title="Keep the exported packet secure"
        severity="info"
      >
        Audit packets may contain sensitive organizational
        information. Share the exported packet only with
        authorized recipients.
      </PrivacyWarning>

      <div className="flex items-center justify-center gap-3">
        {activeExportJob?.downloadUrl && (
          <a
            href={
              activeExportJob.downloadUrl
            }
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
        )}

        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 border rounded-lg font-medium hover:bg-muted"
        >
          New Export
        </button>
      </div>
    </div>
  );
}

export default function AuditExportWizard() {
  const {
    currentStep,
    nextStep,
    prevStep,
    getSelectedEntries,
    canExport,
    validateAuditGrant,
    getExportBlockMessage,
  } = useAuditExportStore();

  const selectedCount =
    getSelectedEntries().length;

  const blockMessage =
    getExportBlockMessage();

  const renderStep = () => {
    switch (currentStep) {
      case "select":
        return <SelectStep />;

      case "review":
        return <ReviewStep />;

      case "configure":
        return <ConfigureStep />;

      case "export":
        return <ExportStep />;

      case "complete":
        return <CompleteStep />;

      default:
        return null;
    }
  };

  const handleNext = () => {
    /*
     * Before entering the export step, validate the grant
     * and ensure the packet can actually be exported.
     */
    if (currentStep === "configure") {
      validateAuditGrant();

      if (!canExport()) {
        return;
      }
    }

    nextStep();
  };

  const canProceed =
    currentStep !== "select" ||
    selectedCount > 0;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-blue-600" />
          </div>

          <div>
            <h1 className="text-2xl font-bold">
              Audit Packet Export
            </h1>

            <p className="text-sm text-muted-foreground mt-1">
              Review, redact, validate, and export audit
              records securely.
            </p>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-white">
        <StepIndicator
          currentStep={currentStep}
        />
      </div>

      {blockMessage &&
        currentStep === "configure" && (
          <PrivacyWarning
            title="Export validation required"
            severity="warning"
          >
            {blockMessage}
          </PrivacyWarning>
        )}

      <div className="border rounded-xl bg-white p-5 sm:p-6 shadow-sm">
        {renderStep()}
      </div>

      {currentStep !== "complete" && (
        <div className="flex items-center justify-between border-t pt-5">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === "select"}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-medium ${
              currentStep === "select"
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-muted"
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {currentStep !== "export" && (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium ${
                canProceed
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}