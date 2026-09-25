"use client";

import { useState, useMemo } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  RefreshCw,
  Coins,
  ShieldAlert,
} from "lucide-react";
import { useWalletStore } from "@/stores/walletStore";
import { useEnvironmentStore } from "@/stores/environment";
import {
  MOCK_TREASURY_BALANCE,
  MOCK_TRANSACTIONS,
} from "@/lib/api/mockData";

export interface QueueItem {
  id: string;
  type: "low_balance" | "unsupported_asset" | "stale_wallet" | "pending_funding";
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  actionLabel: string;
  link: string;
  actionCallback?: () => void;
}

export default function AdminActionQueue() {
  const { isConnected, network } = useWalletStore();
  const expectedNetwork = useEnvironmentStore((s) => s.getActiveProfileConfig().stellarNetwork);
  const [walletSynced, setWalletSynced] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSyncWallet = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setWalletSynced(true);
    }, 1000);
  };

  const queueItems = useMemo<QueueItem[]>(() => {
    const items: QueueItem[] = [];

    const { balance, projectedPayroll } = MOCK_TREASURY_BALANCE;
    if (balance < projectedPayroll) {
      items.push({
        id: "low-balance-critical",
        type: "low_balance",
        title: "Critical: Low Treasury Balance",
        description: `Treasury balance ($${balance.toLocaleString()}) is insufficient for the next projected payroll run ($${projectedPayroll.toLocaleString()}).`,
        severity: "critical",
        actionLabel: "Fund Treasury",
        link: "/treasury",
      });
    } else if (balance - projectedPayroll < 25000) {
      items.push({
        id: "low-balance-warning",
        type: "low_balance",
        title: "Warning: Low Treasury Safety Buffer",
        description: `Treasury surplus after next payroll will be below the recommended $25,000 safety buffer.`,
        severity: "warning",
        actionLabel: "Fund Treasury",
        link: "/treasury",
      });
    }

    const mockXlmBalance = 1.8;
    if (mockXlmBalance < 5.0) {
      items.push({
        id: "low-xlm-balance",
        type: "low_balance",
        title: "Warning: Low XLM Fee Balance",
        description: `Treasury XLM balance (${mockXlmBalance} XLM) is close to the minimum reserve limit. Fund XLM to avoid fee failures.`,
        severity: "warning",
        actionLabel: "Fund XLM",
        link: "/treasury",
      });
    }

    const mockTreasuryAssets = [
      { code: "USDC", balance: 45000, isSupported: true },
      { code: "EURC", balance: 12000, isSupported: false },
    ];
    mockTreasuryAssets.forEach((asset) => {
      if (!asset.isSupported) {
        items.push({
          id: `unsupported-asset-${asset.code}`,
          type: "unsupported_asset",
          title: `Unsupported Asset Detected: ${asset.code}`,
          description: `Treasury holds a balance of ${asset.balance.toLocaleString()} ${asset.code}, which is not an approved asset for payroll operations.`,
          severity: "warning",
          actionLabel: "Manage Assets",
          link: "/treasury",
        });
      }
    });

    if (isConnected) {
      if (network !== expectedNetwork) {
        items.push({
          id: "wallet-network-mismatch",
          type: "stale_wallet",
          title: "Critical: Wallet Network Mismatch",
          description: `Connected wallet is on ${network}, but the system is configured for ${expectedNetwork}.`,
          severity: "critical",
          actionLabel: "Switch Network",
          link: "/settings",
        });
      } else if (!walletSynced) {
        items.push({
          id: "wallet-stale-sync",
          type: "stale_wallet",
          title: "Warning: Stale Wallet State",
          description: "Wallet state has not been synchronized with the network in the last 2 hours.",
          severity: "warning",
          actionLabel: "Sync Wallet State",
          link: "#",
          actionCallback: handleSyncWallet,
        });
      }
    }

    const pendingTx = MOCK_TRANSACTIONS.filter((tx) => tx.status === "pending");
    pendingTx.forEach((tx) => {
      items.push({
        id: `pending-funding-${tx.id}`,
        type: "pending_funding",
        title: `Pending Funding: Payroll Run ${tx.id}`,
        description: `Payroll run for $${tx.totalAmount.toLocaleString()} with ${tx.employeeCount} employee(s) is awaiting execution.`,
        severity: "info",
        actionLabel: "Execute Run",
        link: "/payroll/execute",
      });
    });

    return items;
  }, [isConnected, network, walletSynced, expectedNetwork]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <ShieldAlert className="h-5 w-5 text-red-600" aria-hidden="true" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />;
      default:
        return <Coins className="h-5 w-5 text-blue-600" aria-hidden="true" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "warning":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const getBorderColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "border-l-4 border-l-red-500 border-gray-200";
      case "warning":
        return "border-l-4 border-l-amber-500 border-gray-200";
      default:
        return "border-l-4 border-l-blue-500 border-gray-200";
    }
  };

  return (
    <section aria-labelledby="action-queue-heading" className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
      <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h2 id="action-queue-heading" className="text-base font-semibold text-gray-900">
            Treasury Action Queue
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            High-priority treasury risks and required actions
          </p>
        </div>
        {queueItems.length > 0 && (
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
            {queueItems.length} active risk{queueItems.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {queueItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm font-medium text-gray-900">All Clear</p>
          <p className="text-xs text-gray-500 mt-1">No treasury risks or actions detected.</p>
        </div>
      ) : (
        <ul className="space-y-4" aria-label="treasury action queue">
          {queueItems.map((item) => (
            <li
              key={item.id}
              className={`flex flex-col gap-3 rounded-lg border p-4 ${getBorderColor(item.severity)} bg-gray-50`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="mt-0.5 shrink-0">{getSeverityIcon(item.severity)}</div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-medium text-gray-900">{item.title}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${getSeverityBadge(item.severity)}`}>
                        {item.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-600">{item.description}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-gray-200/60 pt-3">
                {item.actionCallback ? (
                  <button
                    type="button"
                    onClick={item.actionCallback}
                    disabled={syncing}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                  >
                    {syncing ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    {item.actionLabel}
                  </button>
                ) : (
                  <a
                    href={item.link}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    {item.actionLabel}
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
