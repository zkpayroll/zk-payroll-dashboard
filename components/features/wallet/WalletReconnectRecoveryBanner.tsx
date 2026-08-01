"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AlertTriangle, Wifi, WifiOff, RefreshCw, X } from "lucide-react";
import { useWalletStore } from "@/stores/walletStore";
import { useStellar } from "@/components/providers/StellarProvider";
import { toast } from "sonner";

type SessionState = "idle" | "stale" | "reconnecting" | "recovered";

/**
 * Banner that warns users when wallet session is stale and guides them
 * through reconnecting without losing payroll context.
 *
 * Detects session drift by:
 * - Monitoring connection status changes
 * - Tracking last successful connection time
 * - Comparing wallet polling intervals
 */
export function WalletReconnectRecoveryBanner() {
  const walletState = useWalletStore((s: any) => s);
  const isConnected = walletState?.isConnected;
  const publicKey = walletState?.publicKey;

  let connect: (() => Promise<void>) | undefined;
  try {
    const stellar = useStellar();
    connect = stellar?.connect;
  } catch {
    // Component rendered outside StellarProvider or mock
  }

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [lastConnectedTime, setLastConnectedTime] = useState<number>(
    Date.now(),
  );
  const [dismissed, setDismissed] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const SESSION_STALE_THRESHOLD = 30000; // 30 seconds

  // Monitor connection changes
  useEffect(() => {
    if (isConnected && publicKey) {
      // Connection is active
      setLastConnectedTime(Date.now());
      if (sessionState === "stale" || sessionState === "reconnecting") {
        setSessionState("recovered");
        toast.success("Wallet reconnected successfully");
        setTimeout(() => setSessionState("idle"), 3000);
      }
    }
  }, [isConnected, publicKey, sessionState]);

  // Detect stale sessions
  useEffect(() => {
    if (!isConnected || sessionState !== "idle" || dismissed) return;

    const staleCheckInterval = setInterval(() => {
      const timeSinceLastConnection = Date.now() - lastConnectedTime;

      if (
        timeSinceLastConnection > SESSION_STALE_THRESHOLD &&
        sessionState === "idle"
      ) {
        setSessionState("stale");
      }
    }, 5000);

    return () => clearInterval(staleCheckInterval);
  }, [isConnected, lastConnectedTime, sessionState, dismissed]);

  const handleReconnect = useCallback(async () => {
    setIsReconnecting(true);
    setSessionState("reconnecting");

    try {
      await connect?.();
      // Connection update is handled by the useEffect above
    } catch (error) {
      toast.error("Reconnection failed", {
        description:
          error instanceof Error ? error.message : "Please try again",
      });
      setSessionState("stale");
    } finally {
      setIsReconnecting(false);
    }
  }, [connect]);

  const handleDismiss = () => {
    setDismissed(true);
    // Reset after 1 minute if still disconnected
    const timer = setTimeout(() => {
      if (!isConnected) setDismissed(false);
    }, 60000);

    return () => clearTimeout(timer);
  };

  if (sessionState === "idle" || dismissed) return null;

  const isStale = sessionState === "stale";
  const isRecovering = sessionState === "reconnecting";
  const isRecovered = sessionState === "recovered";

  const bgColor = isRecovered
    ? "bg-green-50 border-green-200"
    : isRecovering
      ? "bg-blue-50 border-blue-200"
      : "bg-red-50 border-red-200";

  const icon = isRecovered ? Wifi : isRecovering ? RefreshCw : WifiOff;

  const Icon = icon;
  const iconColor = isRecovered
    ? "text-green-600"
    : isRecovering
      ? "text-blue-600"
      : "text-red-600";

  const textColor = isRecovered
    ? "text-green-800"
    : isRecovering
      ? "text-blue-800"
      : "text-red-800";

  const descTextColor = isRecovered
    ? "text-green-700"
    : isRecovering
      ? "text-blue-700"
      : "text-red-700";

  return (
    <div
      className={`border ${bgColor} rounded-lg p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2`}
      role="alert"
      aria-live="polite"
      aria-label={
        isRecovered
          ? "Wallet reconnected"
          : isRecovering
            ? "Reconnecting wallet"
            : "Wallet session stale"
      }
    >
      <Icon
        className={`w-5 h-5 ${iconColor} mt-0.5 shrink-0 ${isRecovering ? "animate-spin" : ""}`}
        aria-hidden="true"
      />

      <div className="flex-1">
        {isStale && (
          <>
            <h3 className={`text-sm font-semibold ${textColor}`}>
              Wallet Session Stale
            </h3>
            <p className={`text-sm ${descTextColor} mt-1`}>
              Your wallet connection may have been interrupted. Payroll data is
              safe, but you&apos;ll need to reconnect to continue signing or
              submitting.
            </p>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleReconnect}
                disabled={isRecovering}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRecovering ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Reconnecting...
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4" />
                    Reconnect Wallet
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-4 py-2 rounded-md border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 transition-colors"
              >
                Dismiss
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              💡 <strong>Tip:</strong> Keep your browser open while signing
              payroll. Avoid disconnecting your wallet during confirmation.
            </p>
          </>
        )}

        {isRecovering && (
          <>
            <h3 className={`text-sm font-semibold ${textColor}`}>
              Reconnecting Wallet...
            </h3>
            <p className={`text-sm ${descTextColor} mt-1`}>
              Attempting to restore your wallet connection. Your payroll data
              remains safe.
            </p>
          </>
        )}

        {isRecovered && (
          <>
            <h3 className={`text-sm font-semibold ${textColor}`}>
              Wallet Reconnected
            </h3>
            <p className={`text-sm ${descTextColor} mt-1`}>
              Your wallet session has been restored. You can now continue with
              payroll signing and submission.
            </p>
          </>
        )}
      </div>

      {isStale && (
        <button
          type="button"
          onClick={handleDismiss}
          className="text-red-400 hover:text-red-600 transition-colors p-1"
          aria-label="Dismiss wallet reconnect banner"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Hook to check if wallet session is likely stale.
 * Returns true if connection was lost for more than threshold.
 */
export function useWalletSessionState() {
  const { isConnected } = useWalletStore();
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (isConnected) {
      setIsStale(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsStale(true);
    }, 30000);

    return () => clearTimeout(timer);
  }, [isConnected]);

  return { isStale, isConnected };
}
