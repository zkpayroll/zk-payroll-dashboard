"use client";

import { useMemo, useCallback, useEffect, useState, useRef } from "react";
import {
  CheckCircle,
  Circle,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Save,
  Trash2,
  X,
  Wallet,
  Cpu,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Info,
  Lock,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { usePayrollWizardStore } from "@/stores/payrollWizard";
import { useWalletStore } from "@/stores/walletStore";
import { useApprovalHistory } from "@/stores/approvalHistory";
import { useSession } from "@/hooks/useSession";
import { EXPECTED_NETWORK } from "@/components/providers/StellarProvider";
import { IncidentBanner } from "@/components/ui/IncidentBanner";
import { MOCK_COMPANIES, MOCK_EMPLOYEES, MOCK_PAYROLL_RUNS, MOCK_TREASURY_BALANCE } from "@/lib/api/mockData";
import PayrollReceipt from "./PayrollReceipt";
import PayrollApprovalAuditTrail from "./PayrollApprovalAuditTrail";
import { usePayrollAuditTrailStore } from "@/stores/payrollAuditTrail";
import ApprovalHistoryDrawer from "./ApprovalHistoryDrawer";
import { PayrollRiskWarnings } from "./PayrollRiskWarnings";
import { WalletReconnectRecoveryBanner } from "@/components/features/wallet/WalletReconnectRecoveryBanner";
import type { PayrollRun, PayrollWizardStep } from "@/types";
import { trackEvent, mapErrorToType, bucketEmployeeCount } from "@/lib/telemetry";

const STEPS: { key: PayrollWizardStep; label: string }[] = [
  { key: "review", label: "Review" },
  { key: "proof", label: "Proof Generation" },
  { key: "confirm", label: "Confirmation" },
  { key: "submit", label: "Submission" },
];

function stepIndex(step: PayrollWizardStep): number {
  return STEPS.findIndex((s) => s.key === step);
}

function findConflictingRuns(employeeIds: string[]): PayrollRun[] {
  return MOCK_PAYROLL_RUNS.filter(
    (run) =>
      run.status === "pending" &&
      run.employeeIds.some((employeeId) => employeeIds.includes(employeeId)),
  );
}

function PayrollWizard() {
  const {
    currentStep,
    employeeIds,
    totalAmount,
    proofStatus,
    proofError,
    submissionStatus,
    submissionError,
    transactionHash,
    nextStep,
    prevStep,
    setEmployeeIds,
    setTotalAmount,
    setProofStatus,
    setProofError,
    setSubmissionStatus,
    setSubmissionError,
    setTransactionHash,
    reset,
    hasDraft,
    restoreDraft,
    clearDraft,
  } = usePayrollWizardStore();
  const logEvent = usePayrollAuditTrailStore((s) => s.logEvent);
  const [payrollRunId, setPayrollRunId] = useState<string | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const draftResolvedRef = useRef(false);
  const initialEventRecordedRef = useRef(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  const walletPublicKey = useWalletStore((s) => s.publicKey) ?? "unknown";
  const addApprovalEvent = useApprovalHistory((s) => s.addEvent);
  const clearApprovalHistory = useApprovalHistory((s) => s.clearHistory);

  useEffect(() => {
    if (
      !draftResolvedRef.current &&
      hasDraft() &&
      employeeIds.length > 0 &&
      submissionStatus !== "success"
    ) {
      setShowDraftBanner(true);
    }
  }, [employeeIds.length, hasDraft, submissionStatus]);

  const { sessionState } = useSession();
  const network = useWalletStore((s) => s.network);
  const isWrongNetwork = network !== EXPECTED_NETWORK;
  const isSessionExpired = sessionState === "expired";

  const selectedEmployees = useMemo(
    () => MOCK_EMPLOYEES.filter((e) => employeeIds.includes(e.id)),
    [employeeIds],
  );
  const conflictingRuns = useMemo(
    () => findConflictingRuns(employeeIds),
    [employeeIds],
  );

  const handleStartPayroll = useCallback(() => {
    const selected = MOCK_EMPLOYEES.map((e) => e.id);
    const runId = `run_${Date.now()}`;
    setPayrollRunId(runId);
    setEmployeeIds(selected);
    setTotalAmount(MOCK_EMPLOYEES.reduce((sum, e) => sum + e.salary, 0));
    draftResolvedRef.current = true;
    initialEventRecordedRef.current = true;

    addApprovalEvent(
      "draft_created",
      walletPublicKey,
      `Payroll draft created with ${selected.length} employees totaling $${MOCK_EMPLOYEES.reduce((sum, e) => sum + e.salary, 0).toLocaleString()}`,
      { employeeCount: selected.length },
    );

    logEvent({
      payrollRunId: runId,
      action: "draft_created",
      actor: "Current Admin",
      actorRole: "admin",
      details: `Payroll run started with ${selected.length} employees totaling $${MOCK_EMPLOYEES.reduce((sum, e) => sum + e.salary, 0).toLocaleString()}`,
    });

    trackEvent("payroll_wizard_started", {
      employeeCountBucket: bucketEmployeeCount(selected.length),
    });
  }, [setEmployeeIds, setTotalAmount, addApprovalEvent, walletPublicKey, logEvent]);

  const handleGenerateProof = useCallback(async () => {
    if (isWrongNetwork) {
      toast.error("Wrong network", {
        description: `Switch your wallet to ${EXPECTED_NETWORK} to continue.`,
      });
      return;
    }

    setProofStatus("generating");
    setProofError(null);

    addApprovalEvent(
      "proof_generation_started",
      walletPublicKey,
      "Zero-knowledge proof generation initiated",
    );

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const success = Math.random() > 0.2;
    if (success) {
      setProofStatus("success");
      if (payrollRunId) {
        logEvent({
          payrollRunId,
          action: "proof_generated",
          actor: "Current Admin",
          actorRole: "admin",
          details: `ZK proof generated successfully for ${selectedEmployees.length} employees totaling $${totalAmount.toLocaleString()}`,
        });
      }
      addApprovalEvent(
        "proof_generation_completed",
        walletPublicKey,
        "Zero-knowledge proof generated and verified successfully",
      );
      trackEvent("payroll_proof_generation_completed", { success: true });
      toast.success("Proof generated successfully");
      nextStep();
    } else {
      setProofStatus("error");
      const errMsg =
        "Proof generation failed: circuit constraint mismatch. Please retry.";
      setProofError(errMsg);
      if (payrollRunId) {
        logEvent({
          payrollRunId,
          action: "proof_failed",
          actor: "Current Admin",
          actorRole: "admin",
          details: errMsg,
        });
      }
      addApprovalEvent(
        "proof_generation_failed",
        walletPublicKey,
        errMsg,
      );
      trackEvent("payroll_proof_generation_completed", {
        success: false,
        error_type: mapErrorToType(errMsg),
      });
      toast.error("Proof generation failed", {
        description: "Circuit constraint mismatch.",
      });
    }
  }, [setProofStatus, setProofError, nextStep, isWrongNetwork, addApprovalEvent, walletPublicKey, payrollRunId, logEvent, selectedEmployees.length, totalAmount]);

  const handleSubmit = useCallback(async () => {
    if (isWrongNetwork) {
      toast.error("Wrong network", {
        description: `Switch your wallet to ${EXPECTED_NETWORK} to continue.`,
      });
      return;
    }

    // Log wallet signing before submission
    if (payrollRunId) {
      logEvent({
        payrollRunId,
        action: "wallet_signing",
        actor: "Current Admin",
        actorRole: "admin",
        details: `Wallet signing initiated for payroll run: ${selectedEmployees.length} employees, $${totalAmount.toLocaleString()} total`,
      });
    }

    setSubmissionStatus("submitting");
    setSubmissionError(null);
    nextStep();

    addApprovalEvent(
      "payroll_confirmed",
      walletPublicKey,
      `Payroll confirmed for ${employeeIds.length} employees totaling $${totalAmount.toLocaleString()}`,
    );

    addApprovalEvent(
      "submission_started",
      walletPublicKey,
      `Payroll submission initiated for ${employeeIds.length} employees totaling $${totalAmount.toLocaleString()}`,
    );

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const success = Math.random() > 0.15;
    if (success) {
      setSubmissionStatus("success");
      const txHash = `0x${Date.now().toString(16)}abc`;
      setTransactionHash(txHash);
      if (payrollRunId) {
        logEvent({
          payrollRunId,
          action: "submitted",
          actor: "Current Admin",
          actorRole: "admin",
          details: `Payroll submitted successfully. Transaction hash: ${txHash}`,
        });
      }
      addApprovalEvent(
        "submission_completed",
        walletPublicKey,
        `Payroll submitted successfully with transaction ${txHash}`,
      );
      trackEvent("payroll_submission_completed", { success: true });
      toast.success("Payroll submitted successfully", {
        description: "Transaction submitted to the Stellar network.",
      });
    } else {
      setSubmissionStatus("error");
      const errMsg =
        "Submission failed: network timeout. The transaction may still be processing.";
      setSubmissionError(errMsg);
      if (payrollRunId) {
        logEvent({
          payrollRunId,
          action: "submission_failed",
          actor: "Current Admin",
          actorRole: "admin",
          details: errMsg,
        });
      }
      addApprovalEvent(
        "submission_failed",
        walletPublicKey,
        "Payroll submission failed due to network timeout",
      );
      trackEvent("payroll_submission_completed", {
        success: false,
        error_type: mapErrorToType(errMsg),
      });
      toast.error("Submission failed", {
        description:
          "Network timeout. The transaction may still be processing.",
      });
    }
  }, [setSubmissionStatus, setSubmissionError, setTransactionHash, nextStep, isWrongNetwork, addApprovalEvent, walletPublicKey, employeeIds, totalAmount, payrollRunId, logEvent, selectedEmployees.length]);

  const handleReviewNext = useCallback(() => {
    if (payrollRunId) {
      logEvent({
        payrollRunId,
        action: "review_initiated",
        actor: "Current Admin",
        actorRole: "admin",
        details: `Review step completed for ${selectedEmployees.length} employees totaling $${totalAmount.toLocaleString()}`,
      });
    }
    nextStep();
  }, [payrollRunId, logEvent, nextStep, selectedEmployees.length, totalAmount]);

  const handleReset = useCallback(() => {
    if (payrollRunId) {
      logEvent({
        payrollRunId,
        action: "cancelled",
        actor: "Current Admin",
        actorRole: "admin",
        details: `Payroll workflow reset. Run was ${submissionStatus === "error" ? "in error state" : "incomplete"}.`,
      });
    }
    reset();
    clearApprovalHistory();
  }, [payrollRunId, logEvent, reset, submissionStatus, clearApprovalHistory]);

  const idx = stepIndex(currentStep);

  return (
    <section aria-labelledby="payroll-wizard-heading" className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 id="payroll-wizard-heading" className="text-lg font-semibold text-gray-900">
          Execute Payroll
        </h2>
        <button
          type="button"
          onClick={() => setHistoryDrawerOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <History className="w-4 h-4" />
          Approval History
        </button>
      </div>

      {isWrongNetwork && (
        <IncidentBanner
          variant="warning"
          message={`Wallet network mismatch: your wallet is connected to ${network}, but this app requires ${EXPECTED_NETWORK}. Switch networks in your wallet to resume payroll actions.`}
        />
      )}

      {/* Wallet Reconnect Recovery Banner */}
      <WalletReconnectRecoveryBanner />

      {showDraftBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <Save className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-amber-800">
              Draft Payroll Recovered
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              An in-progress payroll draft was found. {employeeIds.length}{" "}
              employee
              {employeeIds.length !== 1 ? "s" : ""} selected, total amount: $
              {totalAmount.toLocaleString()}. Your progress was automatically
              saved.
            </p>
            <p className="text-xs text-amber-600 mt-2">
              Sensitive fields (proof artifacts, transaction hashes) are never
              persisted in drafts.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => {
                  setShowDraftBanner(false);
                  draftResolvedRef.current = true;
                  if (!initialEventRecordedRef.current) {
                    initialEventRecordedRef.current = true;
                    addApprovalEvent(
                      "draft_created",
                      walletPublicKey,
                      `Payroll draft restored with ${employeeIds.length} employees totaling $${totalAmount.toLocaleString()}`,
                      { employeeCount: employeeIds.length, restored: true },
                    );
                  }
                }}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors"
              >
                Continue with draft
              </button>
              <button
                type="button"
                onClick={() => {
                  if (payrollRunId) {
                    logEvent({
                      payrollRunId,
                      action: "cancelled",
                      actor: "Current Admin",
                      actorRole: "admin",
                      details: `Payroll draft discarded. ${employeeIds.length} employees selected, $${totalAmount.toLocaleString()} total was pending.`,
                    });
                  }
                  clearDraft();
                  clearApprovalHistory();
                  setShowDraftBanner(false);
                  draftResolvedRef.current = true;
                }}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-white text-amber-700 hover:bg-amber-50 border border-amber-300 transition-colors inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Discard draft
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowDraftBanner(false);
              draftResolvedRef.current = true;
            }}
            className="text-amber-400 hover:text-amber-600 transition-colors"
            aria-label="Dismiss draft banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <nav
        aria-label="Payroll execution progress"
        className="flex items-center"
      >
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center shrink-0">
            <div className="flex items-center gap-2">
              {i < idx ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : i === idx ? (
                <Loader2
                  className={`w-5 h-5 ${
                    currentStep === "proof" || currentStep === "submit"
                      ? "text-indigo-600 animate-spin"
                      : "text-indigo-600"
                  }`}
                />
              ) : (
                <Circle className="w-5 h-5 text-gray-300" />
              )}
              <span
                className={`text-sm font-medium ${
                  i <= idx ? "text-gray-900" : "text-gray-400"
                } ${i !== idx ? "hidden sm:block" : "block"}`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-8 sm:w-12 h-px mx-2 sm:mx-3 ${
                  i < idx ? "bg-green-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </nav>

      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        {currentStep === "review" && (
          <ReviewStep
            employeeIds={employeeIds}
            selectedEmployees={selectedEmployees}
            totalAmount={totalAmount}
            onStart={handleStartPayroll}
            onNext={handleReviewNext}
            isWrongNetwork={isWrongNetwork}
          />
        )}
        {currentStep === "proof" && (
          <ProofStep
            status={proofStatus}
            error={proofError}
            onGenerate={handleGenerateProof}
            onRetry={handleGenerateProof}
            onBack={prevStep}
            isWrongNetwork={isWrongNetwork}
          />
        )}
        {currentStep === "confirm" && (
          <ConfirmStep
            employeeIds={employeeIds}
            selectedEmployees={selectedEmployees}
            totalAmount={totalAmount}
            conflictingRuns={conflictingRuns}
            onBack={prevStep}
            onSubmit={handleSubmit}
            isWrongNetwork={isWrongNetwork}
            isSessionExpired={isSessionExpired}
          />
        )}
        {currentStep === "submit" && (
          <SubmitStep
            status={submissionStatus}
            error={submissionError}
            transactionHash={transactionHash}
            totalAmount={totalAmount}
            employeeCount={employeeIds.length}
            onRetry={handleSubmit}
            onReset={handleReset}
            isWrongNetwork={isWrongNetwork}
          />
        )}
      </div>

      {/* Approval Audit Trail */}
      {payrollRunId && (
        <div className="mt-8">
          <PayrollApprovalAuditTrail payrollRunId={payrollRunId} />
        </div>
      )}
      <ApprovalHistoryDrawer
        open={historyDrawerOpen}
        onOpenChange={setHistoryDrawerOpen}
      />
    </section>
  );
}

function ReviewStep({
  employeeIds,
  selectedEmployees,
  totalAmount,
  onStart,
  onNext,
  isWrongNetwork,
}: {
  employeeIds: string[];
  selectedEmployees: { id: string; name: string; salary: number }[];
  totalAmount: number;
  onStart: () => void;
  onNext: () => void;
  isWrongNetwork: boolean;
}) {
  if (employeeIds.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">
          No payroll run configured. Start a new payroll run to proceed.
        </p>
        <button
          type="button"
          onClick={onStart}
          disabled={isWrongNetwork}
          title={isWrongNetwork ? "Switch to Testnet in Freighter" : undefined}
          className="px-6 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Payroll Run
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Payroll Review</h3>
      <p className="text-sm text-gray-600">
        Review the employees and amounts included in this payroll run before
        generating the ZK proof.
      </p>
      <div className="border rounded-lg divide-y">
        {selectedEmployees.map((emp) => (
          <div key={emp.id} className="px-4 py-3 flex justify-between">
            <span className="text-sm text-gray-900">{emp.name}</span>
            <span className="text-sm font-medium text-gray-900">
              ${emp.salary.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row sm:justify-between items-center gap-3 sm:gap-0 pt-4 border-t">
        <span className="text-sm font-semibold text-gray-900 w-full sm:w-auto text-center sm:text-left">
          Total: ${totalAmount.toLocaleString()}
        </span>
        <button
          type="button"
          onClick={onNext}
          className="w-full sm:w-auto px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ProofStep({
  status,
  error,
  onGenerate,
  onRetry,
  onBack,
  isWrongNetwork,
}: {
  status: "idle" | "generating" | "success" | "error";
  error: string | null;
  onGenerate: () => void;
  onRetry: () => void;
  onBack: () => void;
  isWrongNetwork: boolean;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">
        ZK Proof Generation
      </h3>
      <p className="text-sm text-gray-600">
        A zero-knowledge proof will be generated locally in the browser to prove
        the validity of this payroll run without revealing individual salary
        details.
      </p>

      {status === "idle" && (
        <div className="text-center py-6">
          <button
            type="button"
            onClick={onGenerate}
            disabled={isWrongNetwork}
            title={
              isWrongNetwork ? "Switch to Testnet in Freighter" : undefined
            }
            className="px-6 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Generate Proof
          </button>
        </div>
      )}

      {status === "generating" && (
        <div className="text-center py-6 space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-sm text-gray-600">
            Generating ZK proof... This may take a few moments.
          </p>
          <div className="w-48 h-1.5 bg-gray-200 rounded-full mx-auto overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full animate-pulse"
              style={{ width: "60%" }}
            />
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="text-center py-6 space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="w-full sm:w-auto px-4 py-2 rounded-md bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 border border-red-200 transition-colors inline-flex justify-center items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      <div className="flex pt-4 border-t">
        <button
          type="button"
          onClick={onBack}
          className="w-full sm:w-auto px-4 py-2 rounded-md bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>
    </div>
  );
}

function ConfirmStep({
  selectedEmployees,
  totalAmount,
  conflictingRuns,
  onBack,
  onSubmit,
  isWrongNetwork,
  isSessionExpired,
}: {
  employeeIds: string[];
  selectedEmployees: { id: string; name: string; salary: number }[];
  totalAmount: number;
  conflictingRuns: PayrollRun[];
  onBack: () => void;
  onSubmit: () => void;
  isWrongNetwork: boolean;
  isSessionExpired: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const store = usePayrollWizardStore();

  const { isProofNearingExpiration, treasuryBalanceOverride } = store;
  const treasuryBalance =
    treasuryBalanceOverride !== null && treasuryBalanceOverride !== undefined
      ? treasuryBalanceOverride
      : MOCK_TREASURY_BALANCE.balance;

  const currentPeriod = useMemo(() => {
    const d = new Date();
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  }, []);

  const company = MOCK_COMPANIES[0] || {
    treasury: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
  };

  // Compute Blockers & Warnings
  const blockers = useMemo(() => {
    const list: string[] = [];

    // 1. Treasury balance check
    if (treasuryBalance < totalAmount) {
      list.push(
        `Treasury balance is insufficient: $${treasuryBalance.toLocaleString()} available, $${totalAmount.toLocaleString()} required.`,
      );
    }

    // 2. Proof status check
    if (store.proofStatus !== "success") {
      list.push(
        "Zero-Knowledge proof is missing or invalid. Please go back and generate a proof.",
      );
    }

    // 3. Employee validation check
    const hasInvalidEmployees = selectedEmployees.some((emp) => {
      const fullEmp = MOCK_EMPLOYEES.find((e) => e.id === emp.id);
      return !fullEmp || fullEmp.status === "inactive" || !fullEmp.address;
    });
    if (hasInvalidEmployees) {
      list.push(
        "Payroll contains inactive or invalid employee data. Wallet signing cannot proceed.",
      );
    }

    // 4. Missing required assets check
    if (totalAmount <= 0) {
      list.push(
        "Required assets missing: Total run amount must be greater than 0.",
      );
    }
    if (selectedEmployees.length === 0) {
      list.push("No employees selected for this payroll run.");
    }

    // 5. Stale session check
    if (isSessionExpired) {
      list.push("Your session has expired. Wallet signing cannot proceed with stale authentication. Please re-authenticate before submitting.");
    }

    return list;
  }, [treasuryBalance, totalAmount, store.proofStatus, selectedEmployees, isSessionExpired]);

  const warnings = useMemo(() => {
    const list: string[] = [];

    // 1. Treasury buffer warning
    if (
      treasuryBalance >= totalAmount &&
      treasuryBalance - totalAmount < 25000
    ) {
      list.push(
        `Treasury balance ($${treasuryBalance.toLocaleString()}) is approaching the minimum safety buffer threshold (less than $25,000 remaining after run).`,
      );
    }

    // 2. Proof expiration warning
    if (store.proofStatus === "success" && isProofNearingExpiration) {
      list.push(
        "The generated ZK proof is nearing its expiration. Submit now or re-generate if delayed.",
      );
    }

    // 3. Optional metadata warning
    const hasMissingOptionalMetadata = selectedEmployees.some((emp) => {
      const fullEmp = MOCK_EMPLOYEES.find((e) => e.id === emp.id);
      return (
        fullEmp &&
        (!fullEmp.email || !fullEmp.startDate || fullEmp.status === "pending")
      );
    });
    if (hasMissingOptionalMetadata) {
      list.push(
        "Some selected employees are missing optional payroll metadata (email or start date) or are in pending status.",
      );
    }

    if (conflictingRuns.length > 0) {
      list.push(
        `Payroll draft conflict detected with ${conflictingRuns
          .map((run) => run.id)
          .join(", ")}. Another admin is already preparing this employee batch.`,
      );
    }

    return list;
  }, [treasuryBalance, totalAmount, store.proofStatus, isProofNearingExpiration, selectedEmployees, conflictingRuns]);

  const state: "ready" | "warning" | "blocked" = useMemo(() => {
    if (blockers.length > 0) return "blocked";
    if (warnings.length > 0) return "warning";
    return "ready";
  }, [blockers, warnings]);

  const reviewChecklist = [
    {
      label: "Employee records reviewed",
      detail: `${selectedEmployees.length} employee${selectedEmployees.length === 1 ? "" : "s"} included in this run`,
      status: selectedEmployees.length > 0 && !blockers.some((block) => block.includes("inactive or invalid"))
        ? "complete"
        : "blocked",
    },
    {
      label: "Treasury balance verified",
      detail: `$${treasuryBalance.toLocaleString()} available for a $${totalAmount.toLocaleString()} run`,
      status: treasuryBalance >= totalAmount ? "complete" : "blocked",
    },
    {
      label: "ZK proof verified",
      detail: store.proofStatus === "success" ? "Proof commitment is ready for signing" : "Generate and verify a proof before submitting",
      status: store.proofStatus === "success" ? "complete" : "blocked",
    },
    {
      label: "Payroll conflicts checked",
      detail: conflictingRuns.length > 0
        ? `${conflictingRuns.length} overlapping draft${conflictingRuns.length === 1 ? "" : "s"} require attention`
        : "No overlapping payroll drafts found",
      status: conflictingRuns.length > 0 ? "blocked" : "complete",
    },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header and status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Review &amp; Confirm Payroll
          </h3>
          <p className="text-sm text-gray-600">
            Review the final breakdown and verification checks before signing
            the transaction.
          </p>
        </div>
        <div className="shrink-0 flex items-center">
          {state === "ready" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
              <ShieldCheck className="w-4 h-4 text-green-600" />
              Ready
            </span>
          )}
          {state === "warning" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Warning
            </span>
          )}
          {state === "blocked" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              Blocked
            </span>
          )}
        </div>
      </div>

      <section
        aria-labelledby="payroll-review-checklist-heading"
        className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 sm:p-5"
      >
        <div className="mb-3">
          <h4
            id="payroll-review-checklist-heading"
            className="text-sm font-semibold text-gray-900"
          >
            Final review checklist
          </h4>
          <p className="mt-1 text-xs text-gray-600">
            Confirm each item before you sign this payroll transaction.
          </p>
        </div>
        <ul className="space-y-2" aria-label="Final payroll review checklist">
          {reviewChecklist.map((item) => {
            const isBlocked = item.status === "blocked";
            return (
              <li
                key={item.label}
                className={`flex items-start gap-3 rounded-md border bg-white p-3 ${
                  isBlocked ? "border-red-200" : "border-green-200"
                }`}
              >
                {isBlocked ? (
                  <ShieldAlert
                    className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
                    aria-hidden="true"
                  />
                ) : (
                  <CheckCircle
                    className="mt-0.5 h-5 w-5 shrink-0 text-green-600"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className={`mt-0.5 break-words text-xs ${isBlocked ? "text-red-700" : "text-gray-600"}`}>
                    {item.detail}
                  </p>
                </div>
                <span className={`ml-auto shrink-0 text-xs font-semibold ${isBlocked ? "text-red-700" : "text-green-700"}`}>
                  {isBlocked ? "Needs attention" : "Ready"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Dynamic Alerts */}
      {state === "ready" && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-green-800">
              All Checks Passed
            </h4>
            <p className="text-sm text-green-700 mt-0.5">
              Treasury is funded, proof is verified, and all employee records
              are validated. Ready for submission.
            </p>
          </div>
        </div>
      )}

      {state === "warning" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-amber-800">
              Payroll Warnings Detected
            </h4>
            <p className="text-sm text-amber-700 mt-0.5">
              Please review the following non-blocking issues before proceeding.
              You can still submit this payroll.
            </p>
            <ul className="list-disc list-inside text-xs text-amber-700 mt-2 space-y-1">
              {warnings.map((warn, i) => (
                <li key={i}>{warn}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {state === "blocked" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-800">
              Submission Blocked
            </h4>
            <p className="text-sm text-red-700 mt-0.5">
              Critical validation failures must be resolved before this payroll
              can be executed. Wallet signing is disabled.
            </p>
            <ul className="list-disc list-inside text-xs text-red-700 mt-2 space-y-1">
              {blockers.map((block, i) => (
                <li key={i}>{block}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Operational Risk Warnings */}
      <PayrollRiskWarnings
        treasuryBalance={treasuryBalance}
        totalAmount={totalAmount}
        selectedEmployees={selectedEmployees}
        allEmployees={MOCK_EMPLOYEES}
      />

      {conflictingRuns.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-800">Draft conflict detected</h4>
            <p className="text-sm text-red-700 mt-0.5">
              Another payroll draft is already tracking the selected employee batch. Resolve or discard the overlapping run before submitting.
            </p>
            <ul className="list-disc list-inside text-xs text-red-700 mt-2 space-y-1">
              {conflictingRuns.map((run) => (
                <li key={run.id}>
                  Run {run.id} is still pending review.
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Grid: Payroll Info & Asset summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Run Information */}
        <div className="border border-gray-150 rounded-lg p-4 space-y-3 bg-gray-50/50">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-indigo-600" />
            Payroll Run Details
          </h4>
          <div className="grid grid-cols-2 gap-y-2 text-sm pt-1">
            <span className="text-gray-500">Payroll Period</span>
            <span className="font-semibold text-gray-800 text-right">
              {currentPeriod}
            </span>

            <span className="text-gray-500">Total Employees</span>
            <span className="font-semibold text-gray-800 text-right">
              {selectedEmployees.length}
            </span>

            <span className="text-gray-500">Target Asset</span>
            <span className="font-semibold text-gray-800 text-right">
              USDC (Stellar Classic)
            </span>
          </div>
        </div>

        {/* Card 2: Financial/Asset breakdown */}
        <div className="border border-gray-150 rounded-lg p-4 space-y-3 bg-gray-50/50">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-indigo-600" />
            Asset Summary
          </h4>
          <div className="grid grid-cols-2 gap-y-2 text-sm pt-1">
            <span className="text-gray-500">Net Salary Transfer</span>
            <span className="font-semibold text-gray-800 text-right">
              ${totalAmount.toLocaleString()} USDC
            </span>

            <span className="text-gray-500">Network Transaction Fee</span>
            <span className="font-semibold text-gray-800 text-right">
              ~0.0001 XLM (Free)
            </span>

            <span className="text-gray-500">Total Authorized Amount</span>
            <span className="font-bold text-indigo-700 text-right">
              ${totalAmount.toLocaleString()} USDC
            </span>
          </div>
        </div>
      </div>

      {/* Employees mini-directory review */}
      <div className="border border-gray-250 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b">
          <h4 className="text-sm font-semibold text-gray-700">
            Employee Summary
          </h4>
        </div>
        <div className="divide-y max-h-48 overflow-y-auto">
          {selectedEmployees.map((emp) => {
            const fullEmp = MOCK_EMPLOYEES.find((e) => e.id === emp.id);
            return (
              <div
                key={emp.id}
                className="px-4 py-2.5 flex justify-between items-center text-sm"
              >
                <div>
                  <p className="font-medium text-gray-800">{emp.name}</p>
                  <p className="text-xs text-gray-500">
                    {fullEmp?.department || "N/A"} •{" "}
                    {fullEmp?.address
                      ? `${fullEmp.address.substring(0, 6)}...${fullEmp.address.substring(50)}`
                      : "No Address"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-gray-900">
                    ${emp.salary.toLocaleString()} USDC
                  </span>
                  {fullEmp?.status === "pending" && (
                    <span className="block text-[10px] text-amber-600 font-medium">
                      Pending Onboarding
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Treasury and Proof details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Treasury wallet details */}
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold text-gray-800">
              Treasury Readiness
            </h4>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                treasuryBalance < totalAmount
                  ? "bg-red-100 text-red-800"
                  : treasuryBalance - totalAmount < 25000
                    ? "bg-amber-100 text-amber-800"
                    : "bg-green-100 text-green-800"
              }`}
            >
              {treasuryBalance < totalAmount
                ? "Insufficient"
                : treasuryBalance - totalAmount < 25000
                  ? "Low Buffer"
                  : "Funded"}
            </span>
          </div>
          <div className="text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Wallet Balance:</span>
              <span className="font-semibold text-gray-900">
                ${treasuryBalance.toLocaleString()} USDC
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Run Requirement:</span>
              <span className="font-semibold text-red-600">
                -${totalAmount.toLocaleString()} USDC
              </span>
            </div>
            <div className="flex justify-between border-t pt-1.5">
              <span className="text-gray-600 font-medium">
                Projected Balance:
              </span>
              <span className="font-bold text-gray-900">
                ${Math.max(0, treasuryBalance - totalAmount).toLocaleString()}{" "}
                USDC
              </span>
            </div>
            <p className="text-[10px] text-gray-500 font-mono break-all mt-2 bg-gray-50 p-1.5 rounded">
              Treasury Address: {company.treasury}
            </p>
          </div>
        </div>

        {/* ZK Proof Status details */}
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold text-gray-800">
              Zero-Knowledge Proof Status
            </h4>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                store.proofStatus === "success"
                  ? isProofNearingExpiration
                    ? "bg-amber-100 text-amber-800"
                    : "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {store.proofStatus === "success"
                ? isProofNearingExpiration
                  ? "Nearing Expiry"
                  : "Verified"
                : "Missing"}
            </span>
          </div>
          <div className="text-sm space-y-1.5">
            <div className="flex items-center gap-1.5 text-gray-700">
              <Cpu className="w-4 h-4 text-indigo-500" />
              <span>ZK proof generated in browser</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-700">
              <Lock className="w-4 h-4 text-indigo-500" />
              <span>Protects individual salary privacy</span>
            </div>
            <div className="mt-2 text-[10px] text-gray-500 font-mono bg-gray-50 p-1.5 rounded">
              <p className="font-semibold text-gray-600">Verification Hash:</p>
              <p className="truncate">
                {store.proofStatus === "success"
                  ? "0xzkproof_verified_hash_9f4082ba"
                  : "No active proof commitment"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Expected Blockchain Actions */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 space-y-2">
        <h4 className="text-sm font-semibold text-gray-800">
          Expected Blockchain Transaction Actions
        </h4>
        <div className="space-y-1 text-xs text-gray-600 font-mono">
          <div className="flex items-start gap-1.5">
            <span className="text-indigo-600 shrink-0">1.</span>
            <span>
              Verify the on-chain ZK Proof commitment on the Stellar contract
              address.
            </span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-indigo-600 shrink-0">2.</span>
            <span>
              Execute batch payment of ${totalAmount.toLocaleString()} USDC to
              zk-payroll escrow from treasury {company.treasury.substring(0, 6)}
              ...{company.treasury.substring(50)}.
            </span>
          </div>
        </div>
      </div>

      {/* Explicit Confirmation Checkbox */}
      <div className="bg-indigo-50/50 border border-indigo-150 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <input
            id="confirm-checkbox"
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={state === "blocked"}
            className="w-4 h-4 text-indigo-600 border-gray-300 rounded mt-0.5 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <label htmlFor="confirm-checkbox" className="cursor-pointer select-none">
            <span className="text-sm font-medium text-gray-900 block">
              Confirm Payroll Execution Summary
            </span>
            <p className="text-xs text-gray-600 mt-0.5">
              I acknowledge that I have reviewed the employees listed, validated
              the required treasury balance, and verify that the Zero-Knowledge
              commitment represents the exact batch payouts. This action
              triggers wallet signing.
            </p>
          </label>
        </div>
      </div>

      {/* Navigation Buttons */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 mb-4">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">
            Irreversible Action
          </p>
          <p className="text-sm text-amber-700 mt-1">
            Once submitted, this payroll transaction cannot be reversed. Please ensure all details are correct.
          </p>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-between pt-4 border-t gap-3 sm:gap-0">

        <button
          type="button"
          onClick={onBack}
          className="w-full sm:w-auto px-4 py-2 rounded-md bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!confirmed || state === "blocked" || isWrongNetwork || isSessionExpired}
          title={
            isWrongNetwork
              ? "Switch to Testnet in Freighter"
              : state === "blocked"
                ? "Resolve blocking errors to proceed"
                : !confirmed
                  ? "Check the confirmation box to submit"
                  : undefined
          }
          className="w-full sm:w-auto px-6 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors inline-flex justify-center items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse"
        >
          <Lock className="w-4 h-4" />
          Submit Payroll
        </button>
      </div>
    </div>
  );
}

function SubmitStep({
  status,
  error,
  transactionHash,
  totalAmount,
  employeeCount,
  onRetry,
  onReset,
  isWrongNetwork,
}: {
  status: "idle" | "submitting" | "success" | "error";
  error: string | null;
  transactionHash: string | null;
  totalAmount: number;
  employeeCount: number;
  onRetry: () => void;
  onReset: () => void;
  isWrongNetwork: boolean;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Submission</h3>

      {status === "submitting" && (
        <div className="text-center py-8 space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-sm text-gray-600">
            Submitting payroll transaction to Stellar network...
          </p>
        </div>
      )}

      {status === "success" && (
        <PayrollReceipt
          totalAmount={totalAmount}
          employeeCount={employeeCount}
          transactionHash={transactionHash}
          onReset={onReset}
        />
      )}

      {status === "error" && (
        <div className="text-center py-8 space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <h4 className="text-lg font-semibold text-red-700">
            Submission Failed
          </h4>
          <p className="text-sm text-red-600">{error}</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-4">
            <button
              type="button"
              onClick={onRetry}
              disabled={isWrongNetwork}
              title={
                isWrongNetwork
                  ? `Switch to ${EXPECTED_NETWORK} in your wallet`
                  : undefined
              }
              className="px-4 py-2 rounded-md bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 border border-red-200 transition-colors inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry Submission
            </button>
            <button
              type="button"
              onClick={onReset}
              className="w-full sm:w-auto px-4 py-2 rounded-md bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors inline-flex justify-center"
            >
              Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PayrollWizard;
