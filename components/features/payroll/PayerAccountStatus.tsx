"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Wallet } from "lucide-react";
import { useWalletStore } from "@/stores/walletStore";
import { useOptionalStellar } from "@/components/providers/StellarProvider";

type PayerStatus = "disconnected" | "checking" | "active" | "missing" | "unavailable" | "wrong_network";

const COPY: Record<PayerStatus, { label: string; detail: string; tone: string }> = {
  disconnected: {
    label: "Wallet not connected",
    detail: "Connect the payer wallet before continuing.",
    tone: "border-gray-200 bg-gray-50 text-gray-700",
  },
  checking: {
    label: "Checking payer account",
    detail: "Confirming that the account exists on the selected Stellar network.",
    tone: "border-blue-200 bg-blue-50 text-blue-800",
  },
  active: {
    label: "Payer account found",
    detail: "Horizon found the payer account on the selected network. Balance and asset authorization are checked separately.",
    tone: "border-green-200 bg-green-50 text-green-800",
  },
  missing: {
    label: "Payer account not found",
    detail: "Fund or activate the payer account on this network, then check again.",
    tone: "border-amber-300 bg-amber-50 text-amber-900",
  },
  unavailable: {
    label: "Account status unavailable",
    detail: "Horizon could not verify the payer account. Check the network connection and retry.",
    tone: "border-amber-300 bg-amber-50 text-amber-900",
  },
  wrong_network: {
    label: "Wallet network mismatch",
    detail: "Switch the wallet to the selected payroll network before continuing.",
    tone: "border-red-200 bg-red-50 text-red-800",
  },
};

/** Checks payer account existence without rendering its address or balances. */
export function PayerAccountStatus() {
  const publicKey = useWalletStore((state) => state.publicKey);
  const connected = useWalletStore((state) => state.isConnected);
  const stellar = useOptionalStellar();
  const [status, setStatus] = useState<PayerStatus>("disconnected");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!connected || !publicKey) {
      setStatus("disconnected");
      return;
    }
    if (stellar?.isWrongNetwork) {
      setStatus("wrong_network");
      return;
    }
    if (!stellar?.horizonUrl) {
      setStatus("unavailable");
      return;
    }

    const controller = new AbortController();
    setStatus("checking");
    fetch(`${stellar.horizonUrl.replace(/\/$/, "")}/accounts/${encodeURIComponent(publicKey)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then((response) => {
        if (response.status === 404) {
          setStatus("missing");
        } else {
          setStatus(response.ok ? "active" : "unavailable");
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("unavailable");
      });

    return () => controller.abort();
  }, [connected, publicKey, stellar?.horizonUrl, stellar?.isWrongNetwork, refreshKey]);

  const copy = COPY[status];
  const Icon = status === "active" ? CheckCircle2 : status === "checking" ? Loader2 : status === "disconnected" ? Wallet : AlertTriangle;

  return (
    <section
      aria-label="Payer account status"
      data-testid="payer-account-status"
      data-status={status}
      role={status === "missing" || status === "unavailable" || status === "wrong_network" ? "alert" : "status"}
      className={`rounded-lg border p-4 ${copy.tone}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${status === "checking" ? "animate-spin" : ""}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold">{copy.label}</h4>
          <p className="mt-1 text-sm">{copy.detail}</p>
          <p className="mt-1 text-xs opacity-80">Only account availability is checked; the address and balance are not displayed.</p>
        </div>
        {status === "disconnected" && stellar && (
          <button type="button" onClick={() => void stellar.connect().catch(() => setStatus("unavailable"))} className="shrink-0 text-xs font-medium underline underline-offset-2">
            Connect wallet
          </button>
        )}
        {(status === "missing" || status === "unavailable") && (
          <button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium underline underline-offset-2">
            <RefreshCw className="h-3 w-3" aria-hidden="true" /> Check again
          </button>
        )}
      </div>
    </section>
  );
}

export default PayerAccountStatus;
