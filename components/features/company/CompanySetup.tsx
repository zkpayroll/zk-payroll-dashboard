"use client";

import { useState, useCallback, useMemo } from "react";
import { Wallet, AlertCircle, CheckCircle } from "lucide-react";
import { useWalletStore } from "@/stores/walletStore";
import { useCompanyStore } from "@/stores/company";
import WalletConnect from "@/components/features/wallet/WalletConnect";
import { CompanyConfigChecker } from "@/components/features/settings/CompanyConfigChecker";
import { trackEvent } from "@/lib/telemetry";
import type { CompanyConfig } from "@/types";
import type { StellarNetwork } from "@/types/stellar";

function isStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}

interface CompanySetupProps {
  onNext?: () => void;
}

function CompanySetup({ onNext }: CompanySetupProps = {}) {
  const { isConnected, publicKey } = useWalletStore();
  const setCompany = useCompanyStore((s) => s.setCompany);

  const [name, setName] = useState("");
  const [treasury, setTreasury] = useState("");
  const [errors, setErrors] = useState<{ name?: string; treasury?: string }>({});
  const [submitted, setSubmitted] = useState(false);

  const previewConfig: CompanyConfig = useMemo(() => ({
    id: "",
    name: name.trim(),
    admin: publicKey ?? "",
    treasury: treasury.trim(),
    employeeCount: 0,
    isActive: true,
    network: (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "TESTNET") as StellarNetwork,
    contracts: {
      registry: "",
      commitment: "",
      verifier: "",
      executor: "",
      audit: "",
    },
  }), [name, publicKey, treasury]);

  const validate = useCallback(() => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Company name is required.";
    if (!treasury.trim()) {
      next.treasury = "Treasury wallet address is required.";
    } else if (!isStellarAddress(treasury.trim())) {
      next.treasury = "Enter a valid Stellar public key (56 characters, starts with G).";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [name, treasury]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate() || !publicKey) return;

      setCompany({
        id: crypto.randomUUID(),
        name: name.trim(),
        admin: publicKey,
        treasury: treasury.trim(),
        employeeCount: 0,
        isActive: true,
      });

      trackEvent('onboarding_completed', { success: true });

      setSubmitted(true);
      setTimeout(() => {
        if (onNext) {
          onNext();
        } else {
          window.location.href = "/";
        }
      }, 1200);
    },
    [validate, publicKey, name, treasury, setCompany, onNext],
  );

  if (!isConnected) {
    return (
      <div className="text-center py-10 space-y-4">
        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto">
          <Wallet className="w-6 h-6 text-indigo-600" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            Wallet connection required
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Connect your Freighter wallet to set up your company.
          </p>
          <WalletConnect />
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="text-center py-10 space-y-3">
        <CheckCircle className="w-10 h-10 text-green-600 mx-auto" aria-hidden="true" />
        <p className="text-sm font-semibold text-gray-900">Company configured!</p>
        <p className="text-sm text-gray-500">Redirecting to the dashboard…</p>
      </div>
    );
  }

  return (
    <>
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <label
          htmlFor="company-name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Company name
        </label>
        <input
          id="company-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. ZK Payroll Inc."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          aria-describedby={errors.name ? "name-error" : undefined}
        />
        {errors.name && (
          <p id="name-error" className="mt-1 text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" aria-hidden="true" />
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="admin-wallet"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Admin wallet
        </label>
        <input
          id="admin-wallet"
          type="text"
          value={publicKey ?? ""}
          readOnly
          className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-500 cursor-not-allowed"
          aria-label="Admin wallet address (pre-filled from connected wallet)"
        />
        <p className="mt-1 text-xs text-gray-500">
          Pre-filled from your connected Freighter wallet.
        </p>
      </div>

      <div>
        <label
          htmlFor="treasury-wallet"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Treasury wallet address
        </label>
        <input
          id="treasury-wallet"
          type="text"
          value={treasury}
          onChange={(e) => setTreasury(e.target.value)}
          placeholder="G..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          aria-describedby={errors.treasury ? "treasury-error" : undefined}
        />
        {errors.treasury && (
          <p id="treasury-error" className="mt-1 text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" aria-hidden="true" />
            {errors.treasury}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="w-full px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        Complete Setup
      </button>
    </form>

    <div className="mt-6 pt-6 border-t border-gray-100">
      <CompanyConfigChecker config={previewConfig} />
    </div>
    </>
  );
}

export default CompanySetup;
