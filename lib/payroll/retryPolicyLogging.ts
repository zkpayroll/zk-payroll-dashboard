import type { PayoutRetryDiagnosticsReport } from "@/src/payroll/payoutRetryDiagnostics";

/** Privacy-safe retry decision sink shared by recovery and execution views. */
export function logRetryPolicyDecision(
  runId: string,
  report: PayoutRetryDiagnosticsReport,
): void {
  console.info("[payroll-retry] policy decision", {
    runId,
    decision: report.canRetry ? "allow" : "deny",
    failureCode: report.failureCode,
    retryCount: report.retryCount,
    maxRetries: report.maxRetries,
  });
}
