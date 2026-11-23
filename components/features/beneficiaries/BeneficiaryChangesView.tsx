"use client";

import { useState } from "react";
import { Shield, ShieldAlert, ArrowRight, RotateCcw, AlertTriangle } from "lucide-react";
import {
  createBeneficiaryChangeRequest,
  submitVerificationStep,
  maskAddress,
  type BeneficiaryChangeRequest,
  type WorkflowEvaluationContext,
  type VerificationStepType,
} from "@/src/payroll/beneficiaryChangeVerificationWorkflow";
import {
  validateBeneficiaryChange,
  validateBeneficiaryConfirmation,
  validateBeneficiaryRecovery,
} from "@/lib/beneficiary-validation";
import DashboardBeneficiaryVerificationStatusCheck from "@/components/features/dashboard/DashboardBeneficiaryVerificationStatusCheck";
import { BeneficiaryChangeGuidance } from "@/components/features/employees/BeneficiaryChangeGuidance";

export interface BeneficiaryChangesViewProps {
  initialRequests?: BeneficiaryChangeRequest[];
  context?: WorkflowEvaluationContext;
  operatorId?: string;
  defaultCurrentAddress?: string;
}

const DEFAULT_CURRENT_ADDRESS = "GBUQWP3BOUZX34ULNQG23RQ6F4BVWCIYU2IAMRU5MPJUJJZI7DNVMD56";

export function BeneficiaryChangesView({
  initialRequests,
  context: initialContext,
  operatorId = "operator-1",
  defaultCurrentAddress = DEFAULT_CURRENT_ADDRESS,
}: BeneficiaryChangesViewProps) {
  const [requests, setRequests] = useState<BeneficiaryChangeRequest[]>(
    initialRequests ?? [
      createBeneficiaryChangeRequest({
        id: "bcr-sample-1",
        employeeRef: "emp-ref-101",
        currentAddressMasked: maskAddress(defaultCurrentAddress),
        proposedAddressMasked: maskAddress("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF7E"),
        requestedBy: "operator-admin",
        now: Date.now() - 3600 * 1000,
      }),
    ],
  );

  const context: WorkflowEvaluationContext = initialContext ?? {
    now: Date.now(),
    isPayrollInProgress: false,
  };

  // Form states
  const [newAddress, setNewAddress] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [understoodChecked, setUnderstoodChecked] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Recovery states
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryAdminConfirmed, setRecoveryAdminConfirmed] = useState(false);
  const [recoveryErrors, setRecoveryErrors] = useState<string[]>([]);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);

  const handleInitiateChange = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccess(null);

    if (context.isPayrollInProgress) {
      setFormErrors(["Beneficiary changes cannot be applied while an active payroll cycle is in progress."]);
      return;
    }

    const changeValidation = validateBeneficiaryChange(newAddress.trim(), defaultCurrentAddress);
    const confirmationValidation = validateBeneficiaryConfirmation(confirmChecked, understoodChecked);

    const allErrors = [...changeValidation.errors, ...confirmationValidation.errors];
    if (allErrors.length > 0) {
      setFormErrors(allErrors);
      return;
    }

    setFormErrors([]);
    const newReq = createBeneficiaryChangeRequest({
      id: `bcr-${Date.now()}`,
      employeeRef: `emp-${Math.floor(1000 + Math.random() * 9000)}`,
      currentAddressMasked: maskAddress(defaultCurrentAddress),
      proposedAddressMasked: maskAddress(newAddress.trim()),
      requestedBy: operatorId,
      now: context.now,
    });

    setRequests((prev) => [newReq, ...prev]);
    setNewAddress("");
    setConfirmChecked(false);
    setUnderstoodChecked(false);
    setFormSuccess("Beneficiary change request submitted. Complete verification steps to proceed.");
  };

  const handleAdvanceStep = (requestId: string, step: VerificationStepType) => {
    if (context.isPayrollInProgress) {
      return;
    }

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        try {
          return submitVerificationStep(req, step, operatorId, context.now);
        } catch {
          return req;
        }
      }),
    );
  };

  const handleRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoverySuccess(null);

    const validation = validateBeneficiaryRecovery(recoveryCode.trim(), recoveryAdminConfirmed);
    if (!validation.valid) {
      setRecoveryErrors(validation.errors);
      return;
    }

    setRecoveryErrors([]);
    setRecoveryCode("");
    setRecoveryAdminConfirmed(false);
    setRecoverySuccess("Previous beneficiary successfully restored under 24-hour administrative undo policy.");
  };

  return (
    <div className="space-y-6" data-testid="beneficiary-changes-view">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Beneficiary Management</h1>
        <p className="text-sm text-gray-600">
          Manage, verify, and review employee beneficiary payout destinations without exposing private salary or personal identity data.
        </p>
      </div>

      {context.isPayrollInProgress && (
        <div
          role="alert"
          data-testid="payroll-in-progress-lock"
          className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold">Active payroll lock</h2>
            <p className="mt-1 text-sm">
              Beneficiary changes cannot be applied while an active payroll cycle is in progress. Wait for the active payroll cycle to conclude before making changes.
            </p>
          </div>
        </div>
      )}

      {/* Aggregate status check */}
      <DashboardBeneficiaryVerificationStatusCheck requests={requests} context={context} />

      {/* Main layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Active Requests List */}
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900">Beneficiary Change Requests</h2>
          {requests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              No beneficiary change requests.
            </div>
          ) : (
            <div className="space-y-4" data-testid="beneficiary-requests-list">
              {requests.map((req) => (
                <div
                  key={req.id}
                  data-testid={`beneficiary-request-${req.id}`}
                  className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                      <span className="font-mono text-xs font-semibold text-gray-500">{req.id}</span>
                    </div>
                    <span
                      data-testid={`request-status-badge-${req.id}`}
                      className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800"
                    >
                      {req.status}
                    </span>
                  </div>

                  <div className="my-3 flex items-center justify-between text-sm">
                    <div>
                      <span className="text-xs text-gray-500">Current beneficiary:</span>
                      <p className="font-mono text-sm font-medium text-gray-800" data-testid="current-masked-address">
                        {req.currentAddressMasked}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    <div>
                      <span className="text-xs text-gray-500">Proposed beneficiary:</span>
                      <p className="font-mono text-sm font-medium text-gray-800" data-testid="proposed-masked-address">
                        {req.proposedAddressMasked}
                      </p>
                    </div>
                  </div>

                  <BeneficiaryChangeGuidance request={req} context={context} />

                  {req.status === "pending_verification" && !context.isPayrollInProgress && (
                    <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                      {!req.completedSteps.includes("contributor_confirmation") && (
                        <button
                          type="button"
                          onClick={() => handleAdvanceStep(req.id, "contributor_confirmation")}
                          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Confirm as contributor
                        </button>
                      )}
                      {!req.completedSteps.includes("two_factor_auth") && (
                        <button
                          type="button"
                          onClick={() => handleAdvanceStep(req.id, "two_factor_auth")}
                          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Verify 2FA
                        </button>
                      )}
                      {!req.completedSteps.includes("dual_operator_signoff") && (
                        <button
                          type="button"
                          onClick={() => handleAdvanceStep(req.id, "dual_operator_signoff")}
                          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Dual operator sign-off
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: Request Change Form & Recovery Flow */}
        <div className="space-y-6">
          {/* Initiate Request Form */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">Request Beneficiary Change</h2>
            <p className="mt-1 text-xs text-gray-500">
              Submit a new Stellar public key for verification. Changes require multi-step sign-off and cooling-off.
            </p>

            {formSuccess && (
              <div
                role="status"
                data-testid="form-success-notice"
                className="mt-3 rounded border border-green-200 bg-green-50 p-2 text-xs text-green-800"
              >
                {formSuccess}
              </div>
            )}

            {formErrors.length > 0 && (
              <div
                role="alert"
                data-testid="form-error-alert"
                className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-800"
              >
                <ul className="list-disc space-y-1 pl-4">
                  {formErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleInitiateChange} className="mt-4 space-y-3">
              <div>
                <label htmlFor="new-beneficiary-address" className="block text-xs font-medium text-gray-700">
                  New beneficiary address (Stellar public key)
                </label>
                <input
                  id="new-beneficiary-address"
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="G..."
                  disabled={context.isPayrollInProgress}
                  data-testid="beneficiary-new-address-input"
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-1.5 text-xs font-mono shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmChecked}
                    onChange={(e) => setConfirmChecked(e.target.checked)}
                    disabled={context.isPayrollInProgress}
                    data-testid="beneficiary-confirm-checkbox"
                    className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>You must confirm the beneficiary change</span>
                </label>

                <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={understoodChecked}
                    onChange={(e) => setUnderstoodChecked(e.target.checked)}
                    disabled={context.isPayrollInProgress}
                    data-testid="beneficiary-understood-checkbox"
                    className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>You must understand the version impact</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={context.isPayrollInProgress}
                data-testid="beneficiary-submit-button"
                className="w-full rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Submit beneficiary request
              </button>
            </form>
          </div>

          {/* 24-Hour Recovery Undo Panel */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-gray-700" aria-hidden="true" />
              <h2 className="text-base font-semibold text-gray-900">24-Hour Undo Recovery</h2>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Administrators can revert to a previous beneficiary within the 24-hour undo window using a valid recovery code.
            </p>

            {recoverySuccess && (
              <div
                role="status"
                data-testid="recovery-success-notice"
                className="mt-3 rounded border border-green-200 bg-green-50 p-2 text-xs text-green-800"
              >
                {recoverySuccess}
              </div>
            )}

            {recoveryErrors.length > 0 && (
              <div
                role="alert"
                data-testid="recovery-error-alert"
                className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-800"
              >
                <ul className="list-disc space-y-1 pl-4">
                  {recoveryErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleRecovery} className="mt-4 space-y-3">
              <div>
                <label htmlFor="recovery-code-input" className="block text-xs font-medium text-gray-700">
                  Recovery code (32 alphanumeric chars)
                </label>
                <input
                  id="recovery-code-input"
                  type="text"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder="32-character code"
                  data-testid="beneficiary-recovery-code-input"
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-1.5 text-xs font-mono shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recoveryAdminConfirmed}
                    onChange={(e) => setRecoveryAdminConfirmed(e.target.checked)}
                    data-testid="beneficiary-recovery-admin-checkbox"
                    className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Administrator confirmation is required</span>
                </label>
              </div>

              <button
                type="submit"
                data-testid="beneficiary-recovery-button"
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Revert beneficiary change
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BeneficiaryChangesView;
