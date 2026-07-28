"use client";

import { useState, type ComponentType } from "react";
import {
  AlertTriangle,
  Database,
  Download,
  FileText,
  HelpCircle,
  Printer,
  ShieldCheck,
} from "lucide-react";
import {
  MOCK_AUDIT_REQUESTS,
  MOCK_EMPLOYEES,
  MOCK_PAYROLL_RUNS,
  MOCK_TRANSACTIONS,
  MOCK_TREASURY_BALANCE,
} from "@/lib/api/mockData";

interface ExportDefinition {
  title: string;
  description: string;
  scope: string;
  format: string;
  fields: string[];
  privacy: string;
  actionLabel: string;
  Icon: ComponentType<{ className?: string }>;
  onClick?: () => void;
  /**
   * Optional permission info shown as a tooltip.
   * When set, the action button is wrapped in a container with an info icon
   * that explains permission constraints based on role, scope, or grant expiry.
   */
  permissionTooltip?: {
    roles: string;
    detail: string;
    warning?: string;
  };
}

function toCsvRow(values: Array<string | number | null | undefined>) {
  return values
    .map((value) => {
      const text = value == null ? "" : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    })
    .join(",");
}

function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const csv = rows.map(toCsvRow).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportPayrollHistory() {
  downloadCsv("payroll-history.csv", [
    ["Run ID", "Date", "Status", "Total Amount", "Employee Count", "Transaction Hash"],
    ...MOCK_TRANSACTIONS.map((transaction) => [
      transaction.id,
      new Date(transaction.createdAt).toISOString().slice(0, 10),
      transaction.status,
      transaction.totalAmount,
      transaction.employeeCount,
      transaction.txHash ?? "Pending",
    ]),
  ]);
}

function exportEmployeeDirectory() {
  downloadCsv("employee-directory-redacted.csv", [
    ["Employee ID", "Department", "Status", "Active", "Salary Commitment"],
    ...MOCK_EMPLOYEES.map((employee) => [
      employee.id,
      employee.department,
      employee.status,
      employee.isActive ? "Yes" : "No",
      employee.salaryCommitment,
    ]),
  ]);
}

function exportAuditAccess() {
  downloadCsv("audit-access-requests.csv", [
    ["Request ID", "Requester", "Organization", "Scope", "Status", "Created At"],
    ...MOCK_AUDIT_REQUESTS.map((request) => [
      request.id,
      request.requesterName,
      request.requesterOrg,
      request.scope,
      request.status,
      new Date(request.createdAt).toISOString().slice(0, 10),
    ]),
  ]);
}

const exportDefinitions: ExportDefinition[] = [
  {
    title: "Payroll history CSV",
    description: "Aggregate payroll runs for operations review and spreadsheet analysis.",
    scope: "Payroll runs",
    format: "CSV",
    fields: ["run id", "date", "status", "total amount", "employee count", "transaction hash"],
    privacy: "Individual employee names, wallet addresses, and salaries are not included.",
    actionLabel: "Download CSV",
    Icon: Download,
    onClick: exportPayrollHistory,
    permissionTooltip: {
      roles: "Admin, Operator, Auditor",
      detail: "Payroll history is accessible to all dashboard roles. Auditors see aggregated totals only; employee-level detail requires a view key.",
    },
  },
  {
    title: "Redacted employee directory",
    description: "A privacy-safe roster export for department and status reconciliation.",
    scope: "Employees",
    format: "CSV",
    fields: ["employee id", "department", "status", "active flag", "salary commitment"],
    privacy: "Names, emails, wallet addresses, and raw salary values remain controlled.",
    actionLabel: "Download CSV",
    Icon: Database,
    onClick: exportEmployeeDirectory,
    permissionTooltip: {
      roles: "Admin, Operator",
      detail: "Employee directory exports are available to admins and operators. Auditors do not have access to employee roster data to maintain privacy boundaries.",
      warning: "Not available to Auditor role",
    },
  },
  {
    title: "Audit access requests",
    description: "Auditor request queue for compliance handoff and access review.",
    scope: "Compliance",
    format: "CSV",
    fields: ["request id", "requester", "organization", "scope", "status", "created date"],
    privacy: "Requester email addresses and detailed rationale text are omitted from the export.",
    actionLabel: "Download CSV",
    Icon: ShieldCheck,
    onClick: exportAuditAccess,
    permissionTooltip: {
      roles: "Admin, Auditor",
      detail: "Audit access exports are limited to admins and auditors. Operators cannot export audit access data to prevent unauthorized compliance data access.",
      warning: "Not available to Operator role",
    },
  },
  {
    title: "Cryptographic audit report",
    description: "Print-friendly audit ledger with payroll totals and verification metadata.",
    scope: "Audit ledger",
    format: "Print",
    fields: ["verification metadata", "run id", "recipients", "shielded amount", "status"],
    privacy: "The print report uses aggregated payouts and redacted recipient lists.",
    actionLabel: "Print report",
    Icon: Printer,
    onClick: () => window.print(),
    permissionTooltip: {
      roles: "Admin, Operator, Auditor",
      detail: "The cryptographic audit report is available to all roles. Report output uses shielded amounts and redacted recipient identifiers to protect privacy.",
    },
  },
  {
    title: "Treasury funding snapshot",
    description: "Current balance and projected payroll coverage for funding operations.",
    scope: "Treasury",
    format: "Summary",
    fields: ["current balance", "projected payroll", "last funded date"],
    privacy: "Treasury exports avoid employee-level payroll detail by default.",
    actionLabel: "View details",
    Icon: FileText,
    permissionTooltip: {
      roles: "Admin",
      detail: "Treasury funding details are admin-only. Operators and auditors cannot access treasury balance or funding projection data.",
      warning: "Admin role only",
    },
  },
];

function PermissionTooltip({
  tooltip,
}: {
  tooltip: NonNullable<ExportDefinition["permissionTooltip"]>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
        aria-label={`Permission info: ${tooltip.detail}`}
      >
        <HelpCircle className="w-3.5 h-3.5" />
        <span>Permissions</span>
      </button>
      {isOpen && (
        <div
          role="tooltip"
          className="absolute bottom-full left-0 mb-2 w-72 bg-gray-900 text-white text-xs rounded-lg shadow-xl p-4 z-50 animate-in fade-in slide-in-from-bottom-1 duration-150"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Role Access: {tooltip.roles}</span>
            </div>
            <p className="text-gray-300 leading-relaxed">{tooltip.detail}</p>
            {tooltip.warning && (
              <div className="flex items-start gap-1.5 pt-2 border-t border-gray-700">
                <HelpCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-amber-300">{tooltip.warning}</p>
              </div>
            )}
          </div>
          <div className="absolute -bottom-1 left-4 w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      )}
    </div>
  );
}

function ExportCenter() {
  const verifiedRuns = MOCK_PAYROLL_RUNS.filter((run) => run.status === "verified").length;
  const totalPayroll = MOCK_TRANSACTIONS.reduce((sum, transaction) => sum + transaction.totalAmount, 0);

  return (
    <section aria-labelledby="export-center-heading" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-700">Operations</p>
          <h2 id="export-center-heading" className="mt-1 text-2xl font-semibold text-gray-900">
            Export Center
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            Download supported payroll, compliance, and treasury outputs from one place while keeping sensitive payroll fields controlled.
          </p>
        </div>
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <p className="font-semibold">Privacy boundary</p>
          <p className="mt-1 text-xs leading-5">
            Exports prefer aggregate values, commitments, and audit metadata over names, wallets, emails, or raw salary detail.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Available outputs</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{exportDefinitions.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Verified runs</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{verifiedRuns}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Treasury coverage</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            ${MOCK_TREASURY_BALANCE.balance.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            ${totalPayroll.toLocaleString()} tracked payroll volume
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {exportDefinitions.map(({ title, description, scope, format, fields, privacy, actionLabel, Icon, onClick, permissionTooltip }) => (
          <article key={title} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-gray-100 p-2 text-gray-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{description}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                {format}
              </span>
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Scope</dt>
                <dd className="mt-1 text-gray-900">{scope}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Fields</dt>
                <dd className="mt-1 text-gray-900">{fields.join(", ")}</dd>
              </div>
            </dl>

            <div className="mt-4 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{privacy}</p>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {onClick ? (
                  <button
                    type="button"
                    onClick={onClick}
                    className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {actionLabel}
                  </button>
                ) : (
                  <a
                    href="/treasury"
                    className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    {actionLabel}
                  </a>
                )}
              </div>
              {permissionTooltip && (
                <PermissionTooltip tooltip={permissionTooltip} />
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ExportCenter;