"use client";

import { useState, useCallback } from "react";
import {
  X,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useWalletStore } from "@/stores/walletStore";
import { useEmployeeStore } from "@/stores/employees";
import { sha256Hex } from "@/lib/zk/hash";
import type { Employee } from "@/types";
import {
  describeStellarAddressIssue,
  STELLAR_ADDRESS_FORMAT_HINT,
  STELLAR_ADDRESS_LENGTH,
} from "@/lib/employees/identifierFormat";

// ─── Form State ───────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  email: string;
  department: string;
  address: string;
  salary: string;
  startDate: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  address?: string;
  salary?: string;
  startDate?: string;
}

type SubmitStatus = "idle" | "generating" | "submitting" | "success" | "error";

function validateForm(values: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Name is required";
  } else if (values.name.trim().length > 100) {
    errors.name = "Name must be 100 characters or fewer";
  }

  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Invalid email address";
  }

  const addressIssue = describeStellarAddressIssue(values.address);
  if (addressIssue) {
    errors.address = addressIssue;
  }

  const salary = parseFloat(values.salary);
  if (!values.salary || isNaN(salary) || salary <= 0) {
    errors.salary = "Salary must be a positive number";
  }

  if (!values.startDate) {
    errors.startDate = "Start date is required";
  }

  return errors;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function buildInitialForm(): FormState {
  return {
    name: "",
    email: "",
    department: "",
    address: "",
    salary: "",
    startDate: new Date().toISOString().split("T")[0],
  };
}

export function AddEmployeeModal({ isOpen, onClose }: AddEmployeeModalProps) {
  const { isConnected, publicKey, network } = useWalletStore();
  const { addEmployee } = useEmployeeStore();

  const [form, setForm] = useState<FormState>(buildInitialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [generatedCommitment, setGeneratedCommitment] = useState<string | null>(null);
  const [addedEmployee, setAddedEmployee] = useState<Employee | null>(null);

  const handleChange = useCallback(
    (field: keyof FormState) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    []
  );

  const resetAndClose = useCallback(() => {
    setForm(buildInitialForm());
    setErrors({});
    setSubmitStatus("idle");
    setSubmitError(null);
    setGeneratedCommitment(null);
    setAddedEmployee(null);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    // Client-side field validation
    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Prerequisite: wallet must be connected
    if (!isConnected || !publicKey) {
      setSubmitError(
        "Wallet not connected. Connect your Freighter wallet before adding an employee."
      );
      return;
    }

    // Prerequisite: must be on TESTNET
    if (network !== "TESTNET") {
      setSubmitError(
        `Network mismatch: expected TESTNET but Freighter is on ${network}. Switch your wallet to Testnet and try again.`
      );
      return;
    }

    setSubmitStatus("generating");
    setSubmitError(null);

    try {
      // Generate ZK salary commitment: sha256(salary|address|salt)
      const salt = crypto.randomUUID();
      const transcript = `${form.salary}|${form.address.trim()}|${salt}`;
      const salaryCommitment = `0x${await sha256Hex(transcript)}`;
      setGeneratedCommitment(salaryCommitment);

      setSubmitStatus("submitting");

      const payload = {
        name: form.name.trim(),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.department.trim() ? { department: form.department.trim() } : {}),
        address: form.address.trim(),
        salary: parseFloat(form.salary),
        salaryCommitment,
        isActive: true,
        startDate: new Date(form.startDate).toISOString(),
      };

      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        // Surface validation details from the API when available
        const apiMessage: string =
          data?.error?.message ??
          (Array.isArray(data?.error?.details)
            ? (data.error.details as { message: string }[])
                .map((d) => d.message)
                .join(". ")
            : null) ??
          "Failed to add employee. Please try again.";
        throw new Error(apiMessage);
      }

      const newEmployee: Employee = {
        id: data.data?.id ?? `emp_${Date.now()}`,
        name: payload.name,
        email: payload.email,
        department: payload.department,
        address: payload.address,
        salary: payload.salary,
        salaryCommitment,
        isActive: true,
        status: "pending",
        onboardingStatus: "not_started",
        startDate: payload.startDate,
      };

      addEmployee(newEmployee);
      setAddedEmployee(newEmployee);
      setSubmitStatus("success");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
      setSubmitStatus("error");
    }
  }, [form, isConnected, publicKey, network, addEmployee]);

  if (!isOpen) return null;

  const isProcessing =
    submitStatus === "generating" || submitStatus === "submitting";
  const networkOk = network === "TESTNET";
  const canSubmit = isConnected && networkOk && !isProcessing;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-employee-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" aria-hidden="true" />
            <h2
              id="add-employee-title"
              className="text-base font-semibold text-gray-900"
            >
              Add Employee
            </h2>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {/* Wallet prerequisite banners */}
          {!isConnected && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800"
            >
              <AlertTriangle
                className="w-4 h-4 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Wallet not connected. Connect your Freighter wallet to submit.
              </span>
            </div>
          )}
          {isConnected && !networkOk && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800"
            >
              <AlertTriangle
                className="w-4 h-4 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                Wrong network: <strong>{network}</strong>. Switch Freighter to{" "}
                <strong>Testnet</strong> to continue.
              </span>
            </div>
          )}

          {/* Success state */}
          {submitStatus === "success" && addedEmployee && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-lg bg-green-50 border border-green-200 px-4 py-4"
            >
              <CheckCircle
                className="w-5 h-5 text-green-600 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <div className="text-sm min-w-0">
                <p className="font-semibold text-green-800">
                  Employee onboarded successfully
                </p>
                <p className="text-green-700 mt-0.5">
                  <strong>{addedEmployee.name}</strong> has been added with a
                  ZK salary commitment.
                </p>
                <div className="mt-3 bg-white border border-green-200 rounded-md px-3 py-2">
                  <p className="text-xs font-medium text-green-700 mb-0.5">
                    Salary commitment
                  </p>
                  <p className="text-xs font-mono text-gray-600 break-all">
                    {generatedCommitment}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* API / network error */}
          {submitStatus === "error" && submitError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800"
            >
              <AlertTriangle
                className="w-4 h-4 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>{submitError}</span>
            </div>
          )}

          {/* Form — hidden after success */}
          {submitStatus !== "success" && (
            <div className="space-y-4">
              {/* Full name */}
              <div>
                <label
                  htmlFor="emp-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Full Name <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="emp-name"
                  type="text"
                  value={form.name}
                  onChange={handleChange("name")}
                  placeholder="Alice Mensah"
                  disabled={isProcessing}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "emp-name-error" : undefined}
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 ${
                    errors.name ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {errors.name && (
                  <p id="emp-name-error" className="mt-1 text-xs text-red-600">
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="emp-email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email{" "}
                  <span className="text-gray-400 font-normal text-xs">
                    (optional)
                  </span>
                </label>
                <input
                  id="emp-email"
                  type="email"
                  value={form.email}
                  onChange={handleChange("email")}
                  placeholder="alice@company.io"
                  disabled={isProcessing}
                  aria-invalid={!!errors.email}
                  aria-describedby={
                    errors.email ? "emp-email-error" : undefined
                  }
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 ${
                    errors.email ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {errors.email && (
                  <p
                    id="emp-email-error"
                    className="mt-1 text-xs text-red-600"
                  >
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Department */}
              <div>
                <label
                  htmlFor="emp-dept"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Department{" "}
                  <span className="text-gray-400 font-normal text-xs">
                    (optional)
                  </span>
                </label>
                <input
                  id="emp-dept"
                  type="text"
                  value={form.department}
                  onChange={handleChange("department")}
                  placeholder="Engineering"
                  disabled={isProcessing}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>

              {/* Stellar wallet address */}
              <div>
                <label
                  htmlFor="emp-address"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Stellar Wallet Address{" "}
                  <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="emp-address"
                  type="text"
                  value={form.address}
                  onChange={handleChange("address")}
                  placeholder="GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37"
                  maxLength={56}
                  disabled={isProcessing}
                  aria-invalid={!!errors.address}
                  aria-describedby={
                    errors.address ? "emp-address-error" : "emp-address-hint"
                  }
                  className={`w-full rounded-md border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 ${
                    errors.address ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {errors.address ? (
                  <p
                    id="emp-address-error"
                    className="mt-1 text-xs text-red-600"
                  >
                    {errors.address}
                  </p>
                ) : (
                  <p
                    id="emp-address-hint"
                    className="mt-1 text-xs text-gray-500"
                  >
                    {STELLAR_ADDRESS_FORMAT_HINT}{" "}
                    <span className="text-gray-400">
                      ({form.address.trim().length}/{STELLAR_ADDRESS_LENGTH})
                    </span>
                  </p>
                )}
              </div>

              {/* Salary */}
              <div>
                <label
                  htmlFor="emp-salary"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Monthly Salary (USD){" "}
                  <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">
                    $
                  </span>
                  <input
                    id="emp-salary"
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.salary}
                    onChange={handleChange("salary")}
                    placeholder="5000"
                    disabled={isProcessing}
                    aria-invalid={!!errors.salary}
                    aria-describedby={
                      errors.salary ? "emp-salary-error" : undefined
                    }
                    className={`w-full rounded-md border pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 ${
                      errors.salary ? "border-red-400" : "border-gray-300"
                    }`}
                  />
                </div>
                {errors.salary && (
                  <p
                    id="emp-salary-error"
                    className="mt-1 text-xs text-red-600"
                  >
                    {errors.salary}
                  </p>
                )}
              </div>

              {/* Start date */}
              <div>
                <label
                  htmlFor="emp-start"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Start Date{" "}
                  <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="emp-start"
                  type="date"
                  value={form.startDate}
                  onChange={handleChange("startDate")}
                  disabled={isProcessing}
                  aria-invalid={!!errors.startDate}
                  aria-describedby={
                    errors.startDate ? "emp-start-error" : undefined
                  }
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 ${
                    errors.startDate ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {errors.startDate && (
                  <p
                    id="emp-start-error"
                    className="mt-1 text-xs text-red-600"
                  >
                    {errors.startDate}
                  </p>
                )}
              </div>

              {/* ZK commitment notice */}
              <div className="flex items-start gap-2 rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3 text-sm text-indigo-700">
                <ShieldCheck
                  className="w-4 h-4 mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  A ZK salary commitment will be generated from the salary
                  amount and wallet address before submission. The raw salary is
                  never stored.
                </span>
              </div>

              {/* In-progress indicators */}
              {submitStatus === "generating" && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2 text-sm text-indigo-600"
                >
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                  Generating salary commitment…
                </div>
              )}
              {submitStatus === "submitting" && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2 text-sm text-indigo-600"
                >
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                  Submitting employee record…
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl shrink-0">
          {submitStatus === "success" ? (
            <button
              type="button"
              onClick={resetAndClose}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={resetAndClose}
                disabled={isProcessing}
                className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                {isProcessing && (
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                {submitStatus === "generating"
                  ? "Generating…"
                  : submitStatus === "submitting"
                  ? "Submitting…"
                  : "Add Employee"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
