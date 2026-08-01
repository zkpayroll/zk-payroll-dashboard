"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Clock,
  XCircle,
  ArrowRight,
  ShieldAlert,
  Lock,
  UserCheck,
  RefreshCw,
} from "lucide-react";
import { MOCK_TRANSACTIONS, MOCK_EMPLOYEES } from "@/lib/api/mockData";
import type { PayrollTransaction } from "@/types";
import { toast } from "sonner";
import { AlertTriangle, Info } from "lucide-react";
import type { ElementType } from "react";

type ExceptionSource = "payroll-engine" | "reconciliation" | "compliance";
type ExceptionSeverity = "blocking" | "warning" | "info";
type ExceptionStatus = "open" | "investigating" | "resolved";

type ExceptionItem = {
  tx: PayrollTransaction;
  employeeNames: string[];
  reasonCode: string;
  nextStep: string;
};

interface EmployeeException {
  id: string;
  employeeId: string;
  employeeName: string;
  address: string;
  runId: string;
  type: "blocked_wallet" | "invalid_commitment" | "inactive_employee" | "failed_state";
  severity: "critical" | "warning";
  reason: string;
  resolution: string;
}

const REASON_CODES: Record<PayrollTransaction["status"], string> = {
  pending: "Awaiting ZK proof generation",
  failed: "Transaction submission failed",
  verified: "",
  cancelled: "Transaction was cancelled by user",
};

const NEXT_STEPS: Record<PayrollTransaction["status"], string> = {
  pending: "Generate proof and reattempt submission",
  failed: "Review failure details and retry",
  verified: "No action required",
  cancelled: "Create a new payroll run if needed",
};

const STATUS_ICONS: Record<PayrollTransaction["status"], ElementType> = {
  pending: Clock,
  failed: XCircle,
  verified: UserCheck,
  cancelled: Lock,
};

const STATUS_CLASSES: Record<PayrollTransaction["status"], string> = {
  pending: "text-amber-600",
  failed: "text-red-600",
  verified: "text-green-600",
  cancelled: "text-gray-500",
};

export interface PayrollExceptionItem {
  id: string;
  runId: string;
  title: string;
  summary: string;
  source: ExceptionSource;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  nextAction: string;
  redactedValueLabel: string;
  createdAt: string;
}

interface PayrollExceptionsQueueProps {
  exceptions?: PayrollExceptionItem[];
}

const SEVERITY_ORDER: ExceptionSeverity[] = ["blocking", "warning", "info"];

const SEVERITY_META: Record<
  ExceptionSeverity,
  { label: string; description: string; icon: ElementType; className: string }
> = {
  blocking: {
    label: "Blocking",
    description: "Issues that stop payroll from continuing safely.",
    icon: AlertTriangle,
    className: "border-red-200 bg-red-50 text-red-700",
  },
  warning: {
    label: "Warning",
    description: "Issues that need review before the next payroll step.",
    icon: ShieldAlert,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  info: {
    label: "Info",
    description: "Informational notices that do not require immediate action.",
    icon: Info,
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
};

const SOURCE_LABELS: Record<ExceptionSource, string> = {
  "payroll-engine": "Payroll engine",
  reconciliation: "Reconciliation",
  compliance: "Compliance",
};

const MOCK_EMPLOYEE_EXCEPTIONS: EmployeeException[] = [
  {
    id: "ex_001",
    employeeId: "emp_003",
    employeeName: "Amara Diallo",
    address: "GBVXCPHJMZ5HZJMBBP3YMBM6HXKH3JRXJBHXJHXJHXJHXJHXJHXJHX",
    runId: "tx_003",
    type: "inactive_employee",
    severity: "critical",
    reason: "Employee status is set to inactive, but they were included in the active run.",
    resolution: "Activate employee status or exclude them from the current payroll draft.",
  },
  {
    id: "ex_002",
    employeeId: "emp_004",
    employeeName: "Kofi Boateng",
    address: "GCZJM2ZPKZM5LZPM2CZJM2ZPKZM5LZPM2CZJM2ZPKZM5LZPM2CZJM2",
    runId: "tx_003",
    type: "blocked_wallet",
    severity: "critical",
    reason: "Target Stellar address is blocked by compliance filter.",
    resolution: "Perform compliance review or update wallet address.",
  },
  {
    id: "ex_003",
    employeeId: "emp_001",
    employeeName: "Alice Mensah",
    address: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    runId: "tx_003",
    type: "invalid_commitment",
    severity: "warning",
    reason: "ZK commitment hash mismatch detected against on-chain records.",
    resolution: "Re-generate ZK proof commitment for this employee.",
  },
  {
    id: "ex_004",
    employeeId: "emp_002",
    employeeName: "Kwame Asante",
    address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    runId: "tx_003",
    type: "failed_state",
    severity: "critical",
    reason: "Transaction execution failed during individual settlement transfer.",
    resolution: "Retry individual payout to this wallet address.",
  },
];

export default function PayrollExceptionsQueue() {
  const [activeTab, setActiveTab] = useState<"transactions" | "employees">("transactions");
  const [employeeExceptions, setEmployeeExceptions] = useState<EmployeeException[]>(MOCK_EMPLOYEE_EXCEPTIONS);

  const exceptions = useMemo<ExceptionItem[]>(() => {
    return MOCK_TRANSACTIONS.filter(
      (tx) => tx.status === "pending" || tx.status === "failed",
    ).map((tx) => ({
      tx,
      employeeNames: MOCK_EMPLOYEES.slice(0, tx.employeeCount).map((e) => e.name),
      reasonCode: REASON_CODES[tx.status],
      nextStep: NEXT_STEPS[tx.status],
    }));
  }, []);

  const handleResolveException = (id: string, actionType: string) => {
    setEmployeeExceptions((prev) => prev.filter((item) => item.id !== id));
    toast.success(`Resolved exception: ${actionType}`);
  };

  return (
    <section aria-labelledby="exceptions-heading" className="rounded-lg bg-white p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-4 mb-4 gap-4">
        <h2 id="exceptions-heading" className="text-base font-semibold text-gray-900">
          Payroll Exceptions Queue
        </h2>
        <div role="tablist" aria-label="Payroll exceptions views" className="flex bg-gray-100 p-0.5 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("transactions")}
            role="tab"
            aria-selected={activeTab === "transactions"}
            aria-controls="transaction-exceptions-panel"
            id="transaction-exceptions-tab"
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === "transactions"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Transaction Exceptions ({exceptions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("employees")}
            role="tab"
            aria-selected={activeTab === "employees"}
            aria-controls="employee-exceptions-panel"
            id="employee-exceptions-tab"
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === "employees"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Employee Exceptions ({employeeExceptions.length})
          </button>
        </div>
      </div>

      {activeTab === "transactions" ? (
        exceptions.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No run exceptions — all payroll items are clear.</p>
        ) : (
          <ul
            className="space-y-3"
            aria-label="exceptions queue"
            role="tabpanel"
            id="transaction-exceptions-panel"
            aria-labelledby="transaction-exceptions-tab"
          >
            {exceptions.map(({ tx, employeeNames, reasonCode, nextStep }) => {
              const Icon = STATUS_ICONS[tx.status] ?? AlertCircle;
              const colorClass = STATUS_CLASSES[tx.status] ?? "text-gray-600";

              return (
                <li
                  key={tx.id}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${colorClass}`} aria-hidden />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          Payroll run {tx.id}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                            tx.status === "failed"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        ${tx.totalAmount.toLocaleString()} · {tx.employeeCount} employee(s) ·{" "}
                        {new Date(tx.timestamp).toLocaleDateString()}
                      </p>
                      {employeeNames.length > 0 && (
                        <p className="mt-1 text-xs text-gray-500">
                          {employeeNames.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="ml-7 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
                    <span className="font-medium">Reason: </span>
                    {reasonCode}
                  </div>

                  <div className="ml-7 flex items-center gap-1 text-xs text-indigo-600">
                    <ArrowRight className="h-3 w-3" aria-hidden />
                    <span>{nextStep}</span>
                  </div>

                  <div className="ml-7">
                    <a
                      href="/payroll"
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      Go to payroll wizard →
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : employeeExceptions.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">No employee payout exceptions detected.</p>
      ) : (
        <ul
          className="space-y-4"
          aria-label="employee exceptions queue"
          role="tabpanel"
          id="employee-exceptions-panel"
          aria-labelledby="employee-exceptions-tab"
        >
          {employeeExceptions.map((ex) => {
            return (
              <li
                key={ex.id}
                className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert
                      className={`mt-0.5 h-5 w-5 shrink-0 ${
                        ex.severity === "critical" ? "text-red-500" : "text-amber-500"
                      }`}
                      aria-hidden
                    />
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{ex.employeeName}</h3>
                      <p className="font-mono text-xxs text-gray-400 truncate max-w-xs sm:max-w-md">
                        {ex.address}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Associated Run: <span className="font-medium text-gray-700">{ex.runId}</span>
                      </p>
                    </div>
                  </div>
                  <span
                    role="status"
                    aria-label={ex.severity}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                      ex.severity === "critical"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {ex.severity}
                  </span>
                </div>

                <div className="rounded-md bg-gray-50 p-3 text-xs space-y-2">
                  <div>
                    <span className="font-semibold text-gray-700">Reason ({ex.type}): </span>
                    <span className="text-gray-600">{ex.reason}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Resolution: </span>
                    <span className="text-gray-600">{ex.resolution}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-end">
                  {ex.type === "blocked_wallet" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleResolveException(ex.id, "Compliance Review")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Compliance Check
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveException(ex.id, "Wallet Updated")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors"
                      >
                        Update Wallet
                      </button>
                    </>
                  )}
                  {ex.type === "invalid_commitment" && (
                    <button
                      type="button"
                      onClick={() => handleResolveException(ex.id, "Commitment Regenerated")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Re-generate Commitment
                    </button>
                  )}
                  {ex.type === "inactive_employee" && (
                    <button
                      type="button"
                      onClick={() => handleResolveException(ex.id, "Employee Activated")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Activate Employee
                    </button>
                  )}
                  {ex.type === "failed_state" && (
                    <button
                      type="button"
                      onClick={() => handleResolveException(ex.id, "Payout Retried")}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry Payout
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
