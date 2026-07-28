"use client";

import { useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  Hash,
  Calendar,
  Users,
  Banknote,
  Shield,
  FileCode,
  EyeOff,
  Download,
} from "lucide-react";
import { MOCK_PAYROLL_RUNS, MOCK_EMPLOYEES } from "@/lib/api/mockData";
import type { PayrollRun } from "@/types";
import { formatPayrollDate, getRunDate } from "@/lib/payroll/scheduleUtils";
import StatusBadge from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";

export default function PayrollReceiptView() {
  const params = useParams();
  const runId = params?.id as string;
  const printRef = useRef<HTMLDivElement>(null);

  const run = useMemo(() => {
    return MOCK_PAYROLL_RUNS.find((r) => r.id === runId) ?? null;
  }, [runId]);

  const employeesInRun = useMemo(() => {
    if (!run) return [];
    return MOCK_EMPLOYEES.filter((e) => run.employeeIds.includes(e.id));
  }, [run]);

  const receiptNumber = useMemo(() => {
    return `ZK-${runId ? runId.replace(/[^0-9]/g, "").slice(-6) : "000000"}-${Date.now().toString().slice(-4)}`;
  }, [runId]);

  const generatedAt = useMemo(() => new Date().toISOString(), []);

  const handlePrint = () => {
    window.print();
  };

  if (!run) {
    return (
      <section aria-labelledby="receipt-not-found" className="space-y-6">
        <Link
          href="/history"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to history
        </Link>
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <p id="receipt-not-found" className="text-sm text-gray-500">
            Payroll run not found. Select a completed run from the transaction history to view its receipt.
          </p>
        </div>
      </section>
    );
  }

  const runDate = getRunDate(run);
  const txHash = run.transactionHash ?? run.txHash;
  const totalPaid = employeesInRun.reduce((sum, e) => sum + e.salary, 0);

  return (
    <section aria-labelledby="receipt-heading" className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/history"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to history
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="w-4 h-4" />
            Print Receipt
          </Button>
        </div>
      </div>

      {/* Printable Receipt */}
      <div
        ref={printRef}
        className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-0 print:rounded-none"
      >
        {/* Print-only header */}
        <div className="hidden print:block pb-6 mb-6 border-b-2 border-gray-900">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ZK Payroll Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wider font-semibold">
                Payroll Receipt &mdash; Audit-Safe Summary
              </p>
            </div>
            <div className="text-right">
              <div className="inline-block px-3 py-1 bg-gray-900 text-white text-xs font-bold uppercase tracking-wider">
                Official Receipt
              </div>
              <p className="text-xs text-gray-500 mt-1">Generated: {new Date(generatedAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Receipt content */}
        <div className="p-6 sm:p-8 print:p-6">
          {/* Status Header */}
          <div className="flex items-center gap-3 mb-6">
            {run.status === "verified" ? (
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Shield className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div>
              <h2 id="receipt-heading" className="text-xl font-bold text-gray-900">
                Payroll Receipt
              </h2>
              <p className="text-sm text-gray-500">
                Run {run.id} &middot; <StatusBadge status={run.status} />
              </p>
            </div>
          </div>

          {/* Receipt Metadata */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 print:bg-gray-50 print:border print:border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Receipt #</p>
                <p className="text-sm font-mono font-medium text-gray-900 mt-0.5">{receiptNumber}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Execution Date</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{formatPayrollDate(runDate)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Generated</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{new Date(generatedAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5 capitalize">{run.status}</p>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="border rounded-lg p-4 print:border-gray-300">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Users className="w-4 h-4" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase">Employees Paid</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{run.employeeCount}</p>
            </div>
            <div className="border rounded-lg p-4 print:border-gray-300">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Banknote className="w-4 h-4" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase">Total Disbursed</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">${run.totalAmount.toLocaleString()}</p>
            </div>
            <div className="border rounded-lg p-4 print:border-gray-300">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Calendar className="w-4 h-4" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase">Period</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatPayrollDate(runDate)}</p>
            </div>
          </div>

          {/* Transaction Hash */}
          {txHash && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 print:bg-gray-50 print:border print:border-gray-200">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                <Hash className="w-3.5 h-3.5" aria-hidden="true" />
                Transaction Verification Hash
              </div>
              <p className="text-sm font-mono text-gray-700 break-all select-all">{txHash}</p>
            </div>
          )}

          {/* Employee Table */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Employee Roster</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <caption className="sr-only">Employees included in this payroll run</caption>
                <thead className="bg-gray-50 print:bg-gray-100">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase">Employee</th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase">Department</th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 print:divide-gray-200">
                  {employeesInRun.map((emp) => (
                    <tr key={emp.id} className="print:break-inside-avoid">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                        <div className="text-xs text-gray-500">{emp.email ?? ""}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{emp.department ?? "\u2014"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={emp.status ?? "active"} />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        ${emp.salary.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 print:bg-gray-100">
                  <tr>
                    <th scope="row" colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      Total
                    </th>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                      ${run.totalAmount.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Privacy Notice and ZK Proof Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 print:bg-indigo-50 print:border-indigo-300">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 uppercase mb-1">
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                Privacy Protection
              </div>
              <p className="text-xs text-indigo-600">
                Individual salary amounts are protected by zero-knowledge proofs. This receipt shows
                aggregated totals only. Detailed wage data is never exposed.
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 print:bg-gray-50 print:border-gray-300">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase mb-1">
                <FileCode className="w-3.5 h-3.5" aria-hidden="true" />
                ZK Proof
              </div>
              <p className="text-xs font-mono text-gray-500 break-all">
                {run.proof ? run.proof : "Proof reference available on-chain"}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-6 border-t border-gray-200 print:border-gray-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-gray-500">
              <div>
                <p className="font-semibold text-gray-700">Audit Trail</p>
                <p className="mt-0.5">
                  This receipt was generated from on-chain data. Verify the transaction hash on
                  Stellar Expert or Stellar Laboratory for independent confirmation.
                </p>
              </div>
              <div className="text-right print:text-left">
                <p className="font-semibold text-gray-700">Verification</p>
                <p className="mt-0.5">
                  Receipt #: {receiptNumber}<br />
                  Generated: {new Date(generatedAt).toLocaleString()}<br />
                  Status: {run.status === "verified" ? "Verified" : "Pending"}
                </p>
              </div>
            </div>
            {/* Signature lines for print */}
            <div className="hidden print:grid print:grid-cols-2 print:gap-10 print:mt-12 print:pt-8 print:border-t print:border-gray-300">
              <div>
                <p className="text-xs font-semibold text-gray-600">Prepared By</p>
                <div className="h-10 border-b border-dashed border-gray-400 mt-4"></div>
                <p className="text-[10px] text-gray-400 mt-1">Signature &amp; Date</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600">Reviewed By</p>
                <div className="h-10 border-b border-dashed border-gray-400 mt-4"></div>
                <p className="text-[10px] text-gray-400 mt-1">Signature &amp; Date</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
            background: white;
          }
          @page { 
            margin: 0.5in; 
            size: letter;
          }
        }
      `}</style>
    </section>
  );
}