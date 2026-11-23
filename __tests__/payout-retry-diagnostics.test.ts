import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_RETRY_ATTEMPTS,
  PayoutRetryDiagnosticsError,
  assertCanRetryPayout,
  classifyPayoutFailure,
  diagnoseFailedPayoutRetry,
  diagnosePayrollRunRetry,
  formatPayoutRetryDiagnosticsReport,
} from "@/src/payroll/payoutRetryDiagnostics";

describe("classifyPayoutFailure", () => {
  it("prefers an explicit cancellation reason over every other signal", () => {
    expect(
      classifyPayoutFailure({
        status: "failed",
        reconciliationStatus: "failed",
        cancellationReason: "treasury_insufficient",
      }),
    ).toBe("treasury_insufficient");
  });

  it("maps every cancellation reason to its failure code", () => {
    expect(classifyPayoutFailure({ cancellationReason: "treasury_insufficient" })).toBe(
      "treasury_insufficient",
    );
    expect(classifyPayoutFailure({ cancellationReason: "approval_rejected" })).toBe(
      "approval_rejected",
    );
    expect(classifyPayoutFailure({ cancellationReason: "compliance_hold" })).toBe(
      "compliance_hold",
    );
    expect(classifyPayoutFailure({ cancellationReason: "duplicate_batch" })).toBe(
      "duplicate_batch",
    );
    expect(classifyPayoutFailure({ cancellationReason: "manual_request" })).toBe(
      "cancelled_manually",
    );
    expect(classifyPayoutFailure({ cancellationReason: "expired_proof" })).toBe(
      "expired_proof",
    );
  });

  it("treats an unknown cancellation reason as unclassified", () => {
    expect(classifyPayoutFailure({ status: "cancelled", cancellationReason: "unknown" })).toBe(
      "cancelled_manually",
    );
    expect(classifyPayoutFailure({ cancellationReason: "unknown" })).toBe("unknown");
  });

  it("classifies a failed reconciliation as reconciliation_failed", () => {
    expect(
      classifyPayoutFailure({
        status: "failed",
        reconciliationStatus: "failed",
        reconciliationDetails: { processedCount: 0, totalCount: 2 },
      }),
    ).toBe("reconciliation_failed");
  });

  it("classifies reconciliation discrepancies before the raw status", () => {
    expect(
      classifyPayoutFailure({
        status: "failed",
        reconciliationDetails: {
          processedCount: 1,
          totalCount: 2,
          discrepancies: ["Recipient payout mismatch"],
        },
      }),
    ).toBe("discrepancies_found");
  });

  it("classifies a bare submission failure", () => {
    expect(classifyPayoutFailure({ status: "failed" })).toBe("submission_failed");
  });

  it("classifies a cancellation without a known reason", () => {
    expect(classifyPayoutFailure({ status: "cancelled" })).toBe("cancelled_manually");
  });

  it("falls back to unknown when nothing identifies the failure", () => {
    expect(classifyPayoutFailure({})).toBe("unknown");
    expect(classifyPayoutFailure({ status: "pending" })).toBe("unknown");
  });
});

describe("diagnoseFailedPayoutRetry", () => {
  it("allows a retry with remaining attempts for a retryable failure", () => {
    const report = diagnoseFailedPayoutRetry({ status: "failed" });

    expect(report.failureCode).toBe("submission_failed");
    expect(report.canRetry).toBe(true);
    expect(report.retryExhausted).toBe(false);
    expect(report.retryCount).toBe(0);
    expect(report.maxRetries).toBe(DEFAULT_MAX_RETRY_ATTEMPTS);
    expect(report.remainingAttempts).toBe(3);
    expect(report.blockers).toHaveLength(0);
    expect(report.warnings).toHaveLength(1);
    expect(report.primary?.code).toBe("submission_failed");
    expect(report.summary).toContain("Retry available — 3 of 3 attempts remaining.");
    expect(() => new Date(report.evaluatedAt).toISOString()).not.toThrow();
  });

  it("counts remaining attempts against a custom maximum", () => {
    const report = diagnoseFailedPayoutRetry({ status: "failed", retryCount: 1, maxRetries: 5 });

    expect(report.retryCount).toBe(1);
    expect(report.maxRetries).toBe(5);
    expect(report.remainingAttempts).toBe(4);
    expect(report.canRetry).toBe(true);
  });

  it("blocks a retry once attempts are exhausted", () => {
    const report = diagnoseFailedPayoutRetry({
      status: "failed",
      retryCount: 3,
      maxRetries: 3,
    });

    expect(report.retryExhausted).toBe(true);
    expect(report.remainingAttempts).toBe(0);
    expect(report.canRetry).toBe(false);
    expect(report.blockers.map((item) => item.code)).toEqual(["retry_exhausted"]);
    expect(report.warnings.map((item) => item.code)).toEqual(["submission_failed"]);
    expect(report.primary?.code).toBe("retry_exhausted");
    expect(report.summary).toContain("Retry blocked —");
    expect(report.summary).toContain("all of its retry attempts");
  });

  it("blocks a retry when the failure cause itself is a blocker", () => {
    const report = diagnoseFailedPayoutRetry({
      runId: "tx_004",
      status: "cancelled",
      cancellationReason: "treasury_insufficient",
    });

    expect(report.failureCode).toBe("treasury_insufficient");
    expect(report.canRetry).toBe(false);
    expect(report.primary?.severity).toBe("blocker");
    expect(report.primary?.retryable).toBe(false);
    expect(report.primary?.remediation).toEqual({ label: "Fund treasury", href: "/treasury" });
    expect(report.summary).toContain("Retry blocked —");
    expect(report.summary).toContain("did not hold enough funds");
  });

  it("reports both the cause blocker and exhausted attempts together", () => {
    const report = diagnoseFailedPayoutRetry({
      cancellationReason: "compliance_hold",
      retryCount: 3,
      maxRetries: 3,
    });

    expect(report.canRetry).toBe(false);
    expect(report.diagnostics.map((item) => item.code)).toEqual([
      "compliance_hold",
      "retry_exhausted",
    ]);
    expect(report.primary?.code).toBe("compliance_hold");
  });

  it("normalizes unusable retry counts and maximums", () => {
    const report = diagnoseFailedPayoutRetry({
      status: "failed",
      retryCount: -2,
      maxRetries: 0,
    });

    expect(report.retryCount).toBe(0);
    expect(report.maxRetries).toBe(DEFAULT_MAX_RETRY_ATTEMPTS);

    const fractional = diagnoseFailedPayoutRetry({ status: "failed", retryCount: 1.9 });
    expect(fractional.retryCount).toBe(1);

    const missing = diagnoseFailedPayoutRetry({ status: "failed", maxRetries: null });
    expect(missing.maxRetries).toBe(DEFAULT_MAX_RETRY_ATTEMPTS);
  });

  it("keeps every diagnostic free of amounts, wallets, and identifiers", () => {
    const report = diagnoseFailedPayoutRetry({
      runId: "tx_005",
      status: "failed",
      cancellationReason: "duplicate_batch",
    });

    const text = formatPayoutRetryDiagnosticsReport(report);
    expect(text).not.toMatch(/\$\d/);
    expect(text).not.toMatch(/0x[0-9a-f]{6,}/i);
    expect(text).toContain("Privacy notice: this report contains no salary, wallet, or amount values.");
  });
});

describe("diagnosePayrollRunRetry", () => {
  const failedRun = {
    id: "tx_005",
    status: "failed" as const,
    reconciliationStatus: "failed" as const,
    reconciliationDetails: { processedCount: 0, totalCount: 2 },
  };

  it("reads the failure signals from a payroll run", () => {
    const report = diagnosePayrollRunRetry(failedRun);

    expect(report.runId).toBe("tx_005");
    expect(report.failureCode).toBe("reconciliation_failed");
    expect(report.canRetry).toBe(true);
    expect(report.primary?.title).toBe("Reconciliation failed");
    expect(report.primary?.remediation.href).toBe("/reconciliation");
    expect(report.summary).toContain("Retry available");
  });

  it("blocks the retry when the run exhausted its attempts", () => {
    const report = diagnosePayrollRunRetry(failedRun, { retryCount: 3 });

    expect(report.canRetry).toBe(false);
    expect(report.retryExhausted).toBe(true);
    expect(report.primary?.code).toBe("retry_exhausted");
  });

  it("carries the cancellation reason through from the run", () => {
    const report = diagnosePayrollRunRetry({
      id: "tx_007",
      status: "cancelled",
      cancellationReason: "compliance_hold",
    });

    expect(report.failureCode).toBe("compliance_hold");
    expect(report.canRetry).toBe(false);
    expect(report.primary?.remediation.href).toBe("/compliance");
  });
});

describe("assertCanRetryPayout", () => {
  it("returns quietly when the report allows a retry", () => {
    const report = diagnoseFailedPayoutRetry({ status: "failed" });
    expect(() => assertCanRetryPayout(report)).not.toThrow();
  });

  it("throws a typed error carrying the report when the retry is blocked", () => {
    const report = diagnoseFailedPayoutRetry({
      cancellationReason: "duplicate_batch",
    });

    let thrown: unknown;
    try {
      assertCanRetryPayout(report);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(PayoutRetryDiagnosticsError);
    const error = thrown as PayoutRetryDiagnosticsError;
    expect(error.name).toBe("PayoutRetryDiagnosticsError");
    expect(error.report).toEqual(report);
    expect(error.message).toContain("Retry blocked: [duplicate_batch]");
    expect(error.message).toContain("already executed");
  });
});

describe("formatPayoutRetryDiagnosticsReport", () => {
  it("renders the summary, every diagnostic, and its next step", () => {
    const report = diagnoseFailedPayoutRetry({
      status: "failed",
      retryCount: 3,
    });
    const text = formatPayoutRetryDiagnosticsReport(report);

    expect(text.split("\n")[0]).toBe(report.summary);
    expect(text).toContain("[warning] Submission failed:");
    expect(text).toContain("[blocker] Retry attempts exhausted:");
    expect(text).toContain("Next step: Retry the run");
    expect(text).toContain("Next step: View history");
  });

  it("includes remediation links for classified causes", () => {
    const report = diagnoseFailedPayoutRetry({
      cancellationReason: "treasury_insufficient",
    });
    const text = formatPayoutRetryDiagnosticsReport(report);

    expect(text).toContain("[blocker] Treasury underfunded:");
    expect(text).toContain("Next step: Fund treasury");
  });
});
