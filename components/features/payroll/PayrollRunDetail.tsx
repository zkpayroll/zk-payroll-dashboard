"use client";

import { useMemo, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  Users,
  Shield,
  FileCode,
  LinkIcon,
  EyeOff,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { MOCK_EMPLOYEES, MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import type { PayrollRun, ProofReference } from "@/types/models";
import StatusBadge from "@/components/ui/StatusBadge";
import ProofFreshnessBadge from "@/components/features/proofs/ProofFreshnessBadge";
import { evaluateProofFreshness } from "@/lib/formatting/proofFreshness";
import PayrollApprovalAuditTrail from "./PayrollApprovalAuditTrail";
import {
  classifyRun,
  formatPayrollDate,
  getRunDate,
  RUN_KIND_STYLES,
} from "@/lib/payroll/scheduleUtils";
import ReconciliationDiffPanel from "@/components/features/payroll/ReconciliationDiffPanel";



import type { LucideIcon } from "lucide-react";

const STATUS_ICONS: Record<string, LucideIcon> = {
  verified: CheckCircle,
  pending: Clock,
  failed: XCircle,
  cancelled: XCircle,
};

export function findPayrollRun(id: string, runs = MOCK_PAYROLL_RUNS): PayrollRun | undefined {
  return runs.find((run) => run.id === id);
}

export type LockState = "submission" | "confirmation" | "reconciliation" | "cancellation" | null;

export function getPayrollLockState(run: PayrollRun): LockState {
  if (run.status === "cancelled") {
    return "cancellation";
  }
  if (run.status === "pending") {
    const txHash = run.transactionHash ?? run.txHash;
    return txHash ? "confirmation" : "submission";
  }
  if (run.status === "verified") {
    return "reconciliation";
  }
  return null;
}

interface PayrollRunDetailProps {
  run?: PayrollRun;
  /** Optional proof metadata driving the freshness warning experience. */
  proofReference?: ProofReference | null;
}

export default function PayrollRunDetail({ run: propRun, proofReference }: PayrollRunDetailProps = {}) {
  const router = useRouter();
  const params = useParams();
  const runId = params?.id as string;

  const [isLoading, setIsLoading] = useState(!propRun);

  useEffect(() => {
    if (propRun) {
      setIsLoading(false);
      return;
    }
    const t = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(t);
  }, [propRun]);

  const run = useMemo(() => {
    if (propRun) return propRun;
    return findPayrollRun(runId) ?? null;
  }, [propRun, runId]);

  const employeesInRun = useMemo(() => {
    if (!run) return [];
    return MOCK_EMPLOYEES.filter((e) => run.employeeIds.includes(e.id));
  }, [run]);

  if (isLoading) {
    return (
      <section aria-label="Loading payroll run details" className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
            <div className="h-4 bg-gray-200 rounded w-32" />
            <div className="h-8 bg-gray-200 rounded w-64" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!run) {
    return (
      <section aria-labelledby="run-not-found-heading" className="space-y-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 id="run-not-found-heading" className="text-lg font-semibold text-gray-900 mb-1">
            Payroll Run Not Found
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            The payroll run with ID &ldquo;{runId}&rdquo; could not be found.
          </p>
          <button
            type="button"
            onClick={() => router.push("/history")}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            View Transaction History
          </button>
        </div>
      </section>
    );
  }

  const kind = classifyRun(run);
  const kindStyles = RUN_KIND_STYLES[kind];
  const runDate = getRunDate(run);
  const StatusIcon = STATUS_ICONS[run.status] ?? Clock;
  const txHash = run.transactionHash ?? run.txHash;
  const lockState = getPayrollLockState(run);
  const freshness = evaluateProofFreshness({ reference: proofReference });

  return (
    <section aria-labelledby="payroll-run-detail-heading" className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back
        </button>
      </div>

      {lockState && (
        <div
          role="alert"
          aria-label={`Payroll Run Locked: ${lockState}`}
          className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3"
        >
          <Lock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold text-amber-800 uppercase tracking-wider text-xs">
              Payroll Run Locked ({lockState})
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              {lockState === "submission" &&
                "This payroll run is locked for submission. The transaction details are finalized and cannot be edited while submission is in progress."}
              {lockState === "confirmation" &&
                "This payroll run is locked for confirmation. It is currently awaiting on-chain verification on the Stellar network. No edits are allowed."}
              {lockState === "reconciliation" &&
                "This payroll run is locked for reconciliation. The transaction is verified on-chain. Edits are disabled to preserve the audit trail."}
              {lockState === "cancellation" &&
                "This payroll run has been cancelled and is locked. No further modifications or processing can be performed."}
            </p>
          </div>
        </div>
      )}

      <header className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${kindStyles.badge}`}
            >
              <StatusIcon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1
                id="payroll-run-detail-heading"
                className="text-xl font-semibold text-gray-900"
              >
                Payroll run · {formatPayrollDate(runDate)}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">Run ID: {run.id}</p>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${kindStyles.badge}`}
                >
                  {kindStyles.label}
                </span>
                <StatusBadge status={run.status} />
              </div>
            </div>
          </div>
          {kind === "scheduled" && !lockState && !freshness.blocksExecution && (
            <Link
              href="/payroll/execute"
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors shrink-0"
            >
              Process payroll
            </Link>
          )}
          {kind === "scheduled" && !lockState && freshness.blocksExecution && (
            <span
              data-testid="execution-blocked-by-proof"
              role="alert"
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-gray-100 text-gray-500 text-sm font-medium cursor-not-allowed shrink-0"
            >
              Execution blocked — proof expired
            </span>
          )}
        </div>
      </header>

      {/* Run metadata */}
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        <h3 className="text-sm font-semibold text-gray-900">Run Metadata</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-medium uppercase">Date</span>
            </div>
            <p className="text-sm font-medium text-gray-900">
              {formatPayrollDate(runDate)}
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium uppercase">Employees</span>
            </div>
            <p className="text-sm font-medium text-gray-900">
              {run.employeeCount} employees
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Shield className="w-4 h-4" />
              <span className="text-xs font-medium uppercase">Total Amount</span>
            </div>
            <p className="text-sm font-medium text-gray-900">
              ${run.totalAmount.toLocaleString()}
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <FileCode className="w-4 h-4" />
              <span className="text-xs font-medium uppercase">ZK Proof</span>
            </div>
            <p className="text-sm font-mono text-gray-900 truncate" title={run.proof}>
              {run.proof
                ? `${run.proof.slice(0, 12)}...${run.proof.slice(-8)}`
                : "Pending generation"}
            </p>
            {proofReference && (
              <div className="mt-2">
                <ProofFreshnessBadge reference={proofReference} />
              </div>
            )}
          </div>
        </div>

        {txHash && (
          <div className="flex items-center gap-2 text-sm">
            <LinkIcon className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">Transaction:</span>
            <span className="font-mono text-xs text-gray-900 truncate">
              {txHash}
            </span>
          </div>
        )}

        {run.executedAt && (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-gray-600">
              Executed at {formatPayrollDate(new Date(run.executedAt))}
            </span>
          </div>
        )}
      </div>

      {/* Privacy notice */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start gap-3">
        <EyeOff className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-medium text-indigo-800">Privacy Preserved</h3>
          <p className="text-sm text-indigo-700 mt-1">
            Individual salary amounts are never displayed. This view shows
            only participation status per employee. Zero-knowledge proofs
            verify correctness without revealing sensitive data.
          </p>
        </div>
      </div>

      {/* Employee-level results */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b">
          <h3 className="text-sm font-semibold text-gray-900">
            Employee Results
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Participation status for each employee in this payroll run.
            Individual salary amounts are protected by ZK proofs.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">
              Employee participation results for payroll run {run.id}
            </caption>
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">
                  Employee
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">
                  Department
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">
                  Salary
                </th>
                <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-600 uppercase">
                  Commitment
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employeesInRun.map((emp) => (
                <tr key={emp.id}>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                    {emp.email && (
                      <div className="text-xs text-gray-500">{emp.email}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {emp.department ?? "—"}
                  </td>
                  <td className="px-6 py-4">
                    {run.status === "verified" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3" />
                        Included
                      </span>
                    ) : run.status === "pending" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        <XCircle className="w-3 h-3" />
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <EyeOff className="w-3 h-3" />
                      Private
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono text-gray-500">
                      {emp.salaryCommitment?.slice(0, 10)}...
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {employeesInRun.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-gray-500">
            No employee records found for this payroll run.
          </div>
        )}

        <div className="px-4 sm:px-6 py-3 border-t text-xs text-gray-500">
          {employeesInRun.length} employee{employeesInRun.length !== 1 ? "s" : ""} in this run
        </div>
      </div>

      {/* Approval Audit Trail */}
      <PayrollApprovalAuditTrail payrollRunId={run.id} compact />
      <ReconciliationDiffPanel run={run} employees={employeesInRun} />

      <div className="flex flex-wrap gap-3">
        <Link
          href="/history"
          className="inline-flex items-center px-4 py-2 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          View transaction history
        </Link>
        {run.status === "verified" && (
          <Link
            href={`/payroll/receipts/${run.id}`}
            className="inline-flex items-center px-4 py-2 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            View Receipt
          </Link>
        )}
      </div>
    </section>
  );
}