"use client";

import { useState, useEffect, type ComponentType } from "react";
import {
  AlertTriangle,
  Database,
  Download,
  FileText,
  Lock,
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
import { canExport, getExportRestrictionReason, ROLE_LABELS } from "@/lib/auth/roles";
import type { UserRole } from "@/types";

interface ExportDefinition {
  permissionKey: string;
  title: string;
  description: string;
  scope: string;
  format: string;
  fields: string[];
  privacy: string;
  actionLabel: string;
  Icon: ComponentType<{ className?: string }>;
  onClick?: () => void;
}

function toCsvRow(values: Array<string | number | null | undefined>) {
  return values
    .map((value) => {
      const text = value == null ? "" : String(value);
      return /[\",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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
    permissionKey: "payroll-history",
    title: "Payroll history CSV",
    description: "Aggregate payroll runs for operations review and spreadsheet analysis.",
    scope: "Payroll runs",
    format: "CSV",
    fields: ["run id", "date", "status", "total amount", "employee count", "transaction hash"],
    privacy: "Individual employee names, wallet addresses, and salaries are not included.",
    actionLabel: "Download CSV",
    Icon: Download,
    onClick: exportPayrollHistory,
  },
  {
    permissionKey: "employee-directory",
    title: "Redacted employee directory",
    description: "A privacy-safe roster export for department and status reconciliation.",
    scope: "Employees",
    format: "CSV",
    fields: ["employee id", "department", "status", "active flag", "salary commitment"],
    privacy: "Names, emails, wallet addresses, and raw salary values remain controlled.",
    actionLabel: "Download CSV",
    Icon: Database,
    onClick: exportEmployeeDirectory,
  },
  {
    permissionKey: "audit-requests",
    title: "Audit access requests",
    description: "Auditor request queue for compliance handoff and access review.",
    scope: "Compliance",
    format: "CSV",
    fields: ["request id", "requester", "organization", "scope", "status", "created date"],
    privacy: "Requester email addresses and detailed rationale text are omitted from the export.",
    actionLabel: "Download CSV",
    Icon: ShieldCheck,
    onClick: exportAuditAccess,
  },
  {
    permissionKey: "audit-report",
    title: "Cryptographic audit report",
    description: "Print-friendly audit ledger with payroll totals and verification metadata.",
    scope: "Audit ledger",
    format: "Print",
    fields: ["verification metadata", "run id", "recipients", "shielded amount", "status"],
    privacy: "The print report uses aggregated payouts and redacted recipient lists.",
    actionLabel: "Print report",
    Icon: Printer,
    onClick: () => window.print(),
  },
  {
    permissionKey: "treasury-snapshot",
    title: "Treasury funding snapshot",
    description: "Current balance and projected payroll coverage for funding operations.",
    scope: "Treasury",
    format: "Summary",
    fields: ["current balance", "projected payroll", "last funded date"],
    privacy: "Treasury exports avoid employee-level payroll detail by default.",
    actionLabel: "View details",
    Icon: FileText,
  },
];

function ExportCard({
  exportDef,
  role,
}: {
  exportDef: ExportDefinition;
  role: UserRole | null;
}) {
  const { title, description, scope, format, fields, privacy, actionLabel, Icon, onClick, permissionKey } = exportDef;
  const hasPermission = role ? canExport(role, permissionKey) : false;
  const restrictionReason = role ? getExportRestrictionReason(role, permissionKey) : "Log in to access exports.";

  const isLocked = !hasPermission;

  return (
    <article
      className={`rounded-lg border bg-white p-5 shadow-sm transition-all ${
        isLocked
          ? "border-gray-200 opacity-70 grayscale-[30%]"
          : "border-gray-200 hover:border-indigo-200 hover:shadow-md"
      }`}
      aria-disabled={isLocked}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-md p-2 ${
              isLocked ? "bg-gray-100 text-gray-400" : "bg-gray-100 text-gray-700"
            }`}
          >
            {isLocked ? (
              <Lock className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Icon className="h-5 w-5" aria-hidden="true" />
            )}
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

      <div className="mt-4">
        {isLocked ? (
          <div
            className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
            title={restrictionReason ?? undefined}
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            {actionLabel}
          </div>
        ) : onClick ? (
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

      {isLocked && restrictionReason && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 flex items-start gap-1.5">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{restrictionReason}</span>
        </div>
      )}
    </article>
  );
}

function ExportCenter() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchRole() {
      try {
        const res = await fetch("/api/auth/session", { method: "GET", cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setSessionLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setRole(data.role);
          setSessionLoading(false);
        }
      } catch {
        if (!cancelled) setSessionLoading(false);
      }
    }

    fetchRole();
    return () => { cancelled = true; };
  }, []);

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
          {role && (
            <p className="mt-1 text-xs text-gray-500">
              Signed in as <span className="font-medium text-gray-700">{ROLE_LABELS[role]}</span>. Restricted exports are locked per your role permissions.
            </p>
          )}
        </div>
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <p className="font-semibold">Privacy boundary</p>
          <p className="mt-1 text-xs leading-5">
            Exports prefer aggregate values, commitments, and audit metadata over names, wallets, emails, or raw salary detail.
          </p>
        </div>
      </div>

      {sessionLoading && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
          Loading session permissions...
        </div>
      )}

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
        {exportDefinitions.map((def) => (
          <ExportCard key={def.permissionKey} exportDef={def} role={role} />
        ))}
      </div>
    </section>
  );
}

export default ExportCenter;
