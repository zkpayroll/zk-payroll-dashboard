"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Wallet,
  Loader2,
  ChevronDown,
  Copy,
  ExternalLink,
  LogOut,
  Check,
} from "lucide-react";
import { useStellar } from "@/components/providers/StellarProvider";
import { useWalletStore } from "@/stores/walletStore";

// Truncates a Stellar public key for display: GBXT...J29M
function truncateKey(key: string): string {
  if (key.length <= 10) return key;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function WalletConnect() {
  const { connect, disconnect, isFreighterInstalled } = useStellar();
  const { publicKey, isConnected, isLoading, error, setError } =
    useWalletStore();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // ── Auto-dismiss error toast ────────────────────────────────────────────────
  useEffect(() => {
    if (error) {
      setToastMessage(error);
      const timer = setTimeout(() => {
        setToastMessage(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  // ── Close dropdown on click-outside ─────────────────────────────────────────
  useEffect(() => {
    if (!dropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  // ── Close dropdown on Escape ────────────────────────────────────────────────
  useEffect(() => {
    if (!dropdownOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDropdownOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [dropdownOpen]);

  // ── Copy address to clipboard ───────────────────────────────────────────────
  const copyAddress = useCallback(async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setToastMessage("Failed to copy address");
    }
  }, [publicKey]);

  // ── Handle connect with guard against double-clicks ─────────────────────────
  const handleConnect = useCallback(async () => {
    if (isLoading) return;
    await connect();
  }, [isLoading, connect]);

  // ── Handle disconnect ───────────────────────────────────────────────────────
  const handleDisconnect = useCallback(() => {
    disconnect();
    setDropdownOpen(false);
  }, [disconnect]);

  // ── Stellar Expert URL ──────────────────────────────────────────────────────
  const network = useWalletStore((s) => s.network);
  const stellarExpertUrl = publicKey
    ? `https://stellar.expert/explorer/${network.toLowerCase()}/account/${publicKey}`
    : "#";

  return (
    <div className="relative inline-flex flex-col items-end">
      {/* ── Unconnected State ──────────────────────────────────────────────── */}
      {!isConnected && !isLoading && (
        <button
          onClick={handleConnect}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none shadow-sm"
          aria-label="Connect Freighter wallet"
        >
          <Wallet className="w-4 h-4" aria-hidden="true" />
          Connect Freighter
        </button>
      )}

      {/* ── Connecting / Loading State ─────────────────────────────────────── */}
      {isLoading && !isConnected && (
        <button
          disabled
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-indigo-300 bg-indigo-600/60 cursor-not-allowed shadow-sm"
          aria-label="Connecting wallet, please wait"
          aria-busy="true"
        >
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Connecting…
        </button>
      )}

      {/* ── Connected State ────────────────────────────────────────────────── */}
      {isConnected && publicKey && (
        <div className="relative">
          <button
            ref={triggerRef}
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg font-medium text-gray-900 bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none shadow-sm"
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            aria-controls="wallet-dropdown"
            aria-label={`Wallet menu for ${truncateKey(publicKey)}`}
          >
            {/* Green status dot */}
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
            </span>
            <span className="font-mono text-sm">{truncateKey(publicKey)}</span>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${
                dropdownOpen ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>

          {/* ── Dropdown Menu ──────────────────────────────────────────────── */}
          {dropdownOpen && (
            <div
              ref={dropdownRef}
              id="wallet-dropdown"
              role="menu"
              aria-label="Wallet options"
              className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-gray-200 shadow-xl z-50 py-1 animate-in fade-in-0 zoom-in-95"
            >
              <a
                href={stellarExpertUrl}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none transition-colors"
                onClick={() => setDropdownOpen(false)}
              >
                <ExternalLink
                  className="w-4 h-4 text-gray-400"
                  aria-hidden="true"
                />
                View on Stellar Expert
              </a>
              <button
                role="menuitem"
                onClick={copyAddress}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none transition-colors"
              >
                {copied ? (
                  <Check
                    className="w-4 h-4 text-green-500"
                    aria-hidden="true"
                  />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" aria-hidden="true" />
                )}
                {copied ? "Copied!" : "Copy Address"}
              </button>
              <div className="border-t border-gray-100 my-1" role="separator" />
              <button
                role="menuitem"
                onClick={handleDisconnect}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none transition-colors"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                Disconnect
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Status announcement for screen readers ─────────────────────────── */}
      <span role="status" aria-live="polite" className="sr-only">
        {isLoading
          ? "Connecting wallet"
          : isConnected && publicKey
            ? `Wallet connected: ${truncateKey(publicKey)}`
            : "Wallet disconnected"}
      </span>

      {/* ── Error Toast ────────────────────────────────────────────────────── */}
      {toastMessage && (
        <div
          role="alert"
          className="absolute top-full mt-2 right-0 max-w-xs px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm shadow-lg animate-in slide-in-from-top-2 fade-in-0"
        >
          <div className="flex items-start gap-2">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <p>{toastMessage}</p>
          </div>
          <button
            onClick={() => {
              setToastMessage(null);
              setError(null);
            }}
            className="absolute top-1.5 right-2 text-red-400 hover:text-red-600 text-xs focus-visible:outline-none"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default WalletConnect;
