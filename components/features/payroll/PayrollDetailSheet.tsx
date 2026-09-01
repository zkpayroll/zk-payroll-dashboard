"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import StatusBadge from "@/components/ui/StatusBadge";
import PeriodLabelBadge from "@/components/features/payroll/PeriodLabelBadge";
import { formatPeriodLabel } from "@/lib/date/periodLabel";
import {
  classifyRun,
  formatPayrollDate,
  getRunDate,
  RUN_KIND_STYLES,
} from "@/lib/payroll/scheduleUtils";
import type { PayrollRun } from "@/types/models";
import {
  Calendar,
  CheckCircle,
  Clock,
  EyeOff,
  FileCode,
  Shield,
  Users,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MOCK_EMPLOYEES } from "@/lib/api/mockData";

const STATUS_ICONS: Record<string, LucideIcon> = {
  verified: CheckCircle,
  pending: Clock,
  failed: XCircle,
  cancelled: XCircle,
};

interface PayrollDetailSheetProps {
  run: PayrollRun | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PayrollDetailSheet({
  run,
  open,
  onOpenChange,
}: PayrollDetailSheetProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const employeesInRun = useMemo(() => {
    if (!run) return [];
    return MOCK_EMPLOYEES.filter((e) => run.employeeIds.includes(e.id));
  }, [run]);

  if (!run) return null;

  const kind = classifyRun(run);
  const kindStyles = RUN_KIND_STYLES[kind];
  const runDate = getRunDate(run);
  const StatusIcon = STATUS_ICONS[run.status] ?? Clock;
  const txHash = run.transactionHash ?? run.txHash;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "flex flex-col h-[85vh] w-full rounded-t-xl"
            : "flex flex-col w-full sm:max-w-xl"
        }
      >
        <SheetHeader className="shrink-0 space-y-4 pb-6 border-b">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${kindStyles.badge}`}
            >
              <StatusIcon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <SheetTitle className="text-xl">
                Payroll run &middot; {formatPayrollDate(runDate)}
              </SheetTitle>
              <SheetDescription>Run ID: {run.id}</SheetDescription>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${kindStyles.badge}`}
                >
                  {kindStyles.label}
                </span>
                <PeriodLabelBadge period={run} size="xs" variant="badge" />
                <StatusBadge status={run.status} />
              </div>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-6">
            <section>
              <h4 className="text-sm font-semibold text-gray-900 mb-4">
                Run Metadata
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="text-xs font-medium uppercase">Pay Period</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {formatPeriodLabel(run)}
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="text-xs font-medium uppercase">Date</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {formatPayrollDate(runDate)}
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                    <Users className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="text-xs font-medium uppercase">Employees</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {run.employeeCount} employees
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                    <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="text-xs font-medium uppercase">Total</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    ${run.totalAmount.toLocaleString()}
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                    <FileCode className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="text-xs font-medium uppercase">ZK Proof</span>
                  </div>
                  <p className="text-sm font-mono text-gray-900 truncate" title={run.proof}>
                    {run.proof
                      ? `${run.proof.slice(0, 12)}...${run.proof.slice(-8)}`
                      : "Pending generation"}
                  </p>
                </div>
              </div>
            </section>

            {txHash && (
              <section>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  Transaction
                </h4>
                <p className="font-mono text-xs text-gray-900 break-all bg-gray-50 p-3 rounded-lg">
                  {txHash}
                </p>
              </section>
            )}

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start gap-3">
              <EyeOff className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h4 className="text-sm font-medium text-indigo-800">Privacy Preserved</h4>
                <p className="text-sm text-indigo-700 mt-1">
                  Individual salary amounts are never displayed. Zero-knowledge proofs
                  verify correctness without revealing sensitive data.
                </p>
              </div>
            </div>

            <section>
              <h4 className="text-sm font-semibold text-gray-900 mb-4">
                Employee Results
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                Participation status for each employee in this payroll run.
              </p>
              {employeesInRun.length > 0 ? (
                <div className="divide-y divide-gray-100 border rounded-lg overflow-hidden">
                  {employeesInRun.map((emp) => (
                    <div key={emp.id} className="flex items-center justify-between p-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                        {emp.email && (
                          <p className="text-xs text-gray-500">{emp.email}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {run.status === "verified" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3" aria-hidden="true" />
                            Included
                          </span>
                        ) : run.status === "pending" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3" aria-hidden="true" />
                            Failed
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No employee records found for this payroll run.
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                {employeesInRun.length} employee{employeesInRun.length !== 1 ? "s" : ""} in this run
              </p>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
