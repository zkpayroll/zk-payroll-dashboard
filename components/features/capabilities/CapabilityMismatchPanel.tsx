"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useContractCapabilitiesStore } from "@/stores/contractCapabilities";
import type { ContractCapability, CapabilityMismatchWarning, MismatchSeverity } from "@/stores/contractCapabilities";

const SEVERITY_CONFIG: Record<MismatchSeverity, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  info: { color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", icon: <Info className="w-4 h-4" />, label: "Info" },
  warning: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: <AlertTriangle className="w-4 h-4" />, label: "Warning" },
  critical: { color: "text-red-700", bg: "bg-red-50", border: "border-red-200", icon: <ShieldAlert className="w-4 h-4" />, label: "Critical" },
};

function WarningBanner({ warning, onDismiss }: { warning: CapabilityMismatchWarning; onDismiss: () => void }) {
  const config = SEVERITY_CONFIG[warning.severity];

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${config.bg} ${config.border}`}>
      <div className={`shrink-0 mt-0.5 ${config.color}`}>{config.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${config.color}`}>{warning.message}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${config.bg} ${config.color} font-medium`}>{config.label}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{warning.details}</p>
        {warning.actionLabel && (
          <button className="mt-2 text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
            {warning.actionLabel}
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 p-1 hover:bg-white/50 rounded text-muted-foreground"
        title="Dismiss"
      >
        <XCircle className="w-4 h-4" />
      </button>
    </div>
  );
}

function CapabilityRow({ capability }: { capability: ContractCapability }) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    supported: { icon: <CheckCircle2 className="w-4 h-4 text-green-500" />, label: "Supported", color: "text-green-700" },
    unsupported: { icon: <XCircle className="w-4 h-4 text-red-500" />, label: "Unsupported", color: "text-red-700" },
    unknown: { icon: <Info className="w-4 h-4 text-gray-400" />, label: "Unknown", color: "text-gray-500" },
    deprecated: { icon: <AlertTriangle className="w-4 h-4 text-amber-500" />, label: "Deprecated", color: "text-amber-700" },
  };

  const status = statusConfig[capability.status];

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50"
      >
        {status.icon}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{capability.name}</span>
          <span className={`ml-2 text-xs font-medium ${status.color}`}>{status.label}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Required: {capability.requiredVersion}
          {capability.currentVersion && ` | Current: ${capability.currentVersion}`}
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t bg-muted/30 text-sm space-y-2 pt-3">
          <p>{capability.description}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Status:</span> {status.label}</div>
            <div><span className="text-muted-foreground">Last checked:</span> {new Date(capability.lastChecked).toLocaleString()}</div>
            {capability.mismatchSeverity && (
              <div><span className="text-muted-foreground">Mismatch severity:</span> {capability.mismatchSeverity}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CapabilityMismatchPanel() {
  const {
    capabilities,
    scanning,
    lastScanAt,
    contractAddress,
    scanContract,
    setScanning,
    setCapabilities,
    dismissWarning,
    dismissAllWarnings,
    getActiveWarnings,
    getUnsupportedCapabilities,
    hasBlockingMismatch,
  } = useContractCapabilitiesStore();

  const activeWarnings = getActiveWarnings();
  const unsupported = getUnsupportedCapabilities();
  const blocking = hasBlockingMismatch();

  useEffect(() => {
    if (capabilities.length === 0) {
      const now = new Date().toISOString();
      setCapabilities([
        {
          id: "cap_zk_proofs",
          name: "ZK Payroll Proofs",
          description: "Zero-knowledge proof generation and verification for payroll transactions",
          requiredVersion: ">=2.0.0",
          currentVersion: "1.8.3",
          status: "deprecated",
          mismatchSeverity: "warning",
          lastChecked: now,
        },
        {
          id: "cap_batch_processing",
          name: "Batch Processing",
          description: "Ability to process multiple payroll transactions in a single batch",
          requiredVersion: ">=1.5.0",
          currentVersion: "2.1.0",
          status: "supported",
          mismatchSeverity: null,
          lastChecked: now,
        },
        {
          id: "cap_multi_asset",
          name: "Multi-Asset Support",
          description: "Support for multiple token types in a single payroll run",
          requiredVersion: ">=3.0.0",
          currentVersion: null,
          status: "unsupported",
          mismatchSeverity: "critical",
          lastChecked: now,
        },
        {
          id: "cap_compliance",
          name: "Compliance Module",
          description: "Built-in compliance checking and audit trail generation",
          requiredVersion: ">=1.2.0",
          currentVersion: "1.2.0",
          status: "supported",
          mismatchSeverity: null,
          lastChecked: now,
        },
        {
          id: "cap_recurring",
          name: "Recurring Payments",
          description: "Scheduled and recurring payroll payment support",
          requiredVersion: ">=2.5.0",
          currentVersion: "2.3.1",
          status: "deprecated",
          mismatchSeverity: "warning",
          lastChecked: now,
        },
      ]);
    }
  }, [capabilities.length, setCapabilities]);

  const handleScan = () => {
    scanContract("GA...EXAMPLE");
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contract Capabilities</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor contract capability mismatches and compatibility warnings
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning..." : "Scan Contract"}
        </button>
      </div>

      {/* Blocking mismatch alert */}
      {blocking && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Blocking capability mismatch detected</p>
            <p className="text-sm text-red-700 mt-0.5">
              The deployed contract is missing required capabilities. Some features may not work correctly.
            </p>
          </div>
        </div>
      )}

      {/* Scan info */}
      {lastScanAt && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5" />
          Last scanned: {new Date(lastScanAt).toLocaleString()}
          {contractAddress && <span className="font-mono">({contractAddress})</span>}
        </div>
      )}

      {/* Warnings */}
      {activeWarnings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Active Warnings ({activeWarnings.length})
            </h3>
            <button
              onClick={dismissAllWarnings}
              className="text-xs text-muted-foreground hover:underline"
            >
              Dismiss all
            </button>
          </div>
          {activeWarnings.map((warning) => (
            <WarningBanner
              key={warning.id}
              warning={warning}
              onDismiss={() => dismissWarning(warning.id)}
            />
          ))}
        </div>
      )}

      {/* Capabilities list */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Capabilities ({capabilities.length})</h3>
        {capabilities.map((cap) => (
          <CapabilityRow key={cap.id} capability={cap} />
        ))}
      </div>
    </div>
  );
}
