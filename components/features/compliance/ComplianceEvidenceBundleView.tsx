"use client";

import { useState, useMemo } from "react";
import {
  ShieldCheck,
  FileCheck,
  Lock,
  Download,
  CheckCircle2,
  Clock,
  Copy,
  Search,
  ExternalLink,
  Shield,
  Layers,
  Terminal,
  UserCheck,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useEvidenceBundleStore } from "@/stores/evidenceBundles";
import { Button } from "@/components/ui/button";
import type { ComplianceEvidenceBundle } from "@/types/models";

export default function ComplianceEvidenceBundleView() {
  const { bundles, selectedBundleId, selectBundle, verifyBundle } =
    useEvidenceBundleStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<
    "receipts" | "proof" | "metadata" | "history"
  >("receipts");
  const [revealedCommitments, setRevealedCommitments] = useState<Set<string>>(
    new Set()
  );
  const [isVerifying, setIsVerifying] = useState(false);

  // Filtered bundles
  const filteredBundles = useMemo(() => {
    return bundles.filter((b) => {
      const matchesSearch =
        b.bundleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.payrollRunId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.transactionMetadata.txHash
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || b.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bundles, searchQuery, statusFilter]);

  const activeBundle = useMemo(() => {
    return (
      bundles.find((b) => b.bundleId === selectedBundleId) ||
      filteredBundles[0] ||
      bundles[0]
    );
  }, [bundles, selectedBundleId, filteredBundles]);

  const handleVerify = async () => {
    if (!activeBundle) return;
    setIsVerifying(true);
    await new Promise((res) => setTimeout(res, 800));
    const success = verifyBundle(activeBundle.bundleId);
    setIsVerifying(false);

    if (success) {
      toast.success("Bundle Verification Passed", {
        description: `Cryptographic proof and 5 consistency checks validated for ${activeBundle.bundleId}.`,
      });
    } else {
      toast.error("Verification Failed", {
        description: "Consistency check failed for bundle artifacts.",
      });
    }
  };

  const handleDownloadJson = () => {
    if (!activeBundle) return;
    const blob = new Blob([JSON.stringify(activeBundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeBundle.bundleId}_evidence_bundle.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Evidence Bundle Exported", {
      description: `Downloaded ${activeBundle.bundleId}_evidence_bundle.json`,
    });
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`, {
      description: "Copied to system clipboard.",
    });
  };

  const toggleCommitmentReveal = (commitHash: string) => {
    setRevealedCommitments((prev) => {
      const next = new Set(prev);
      if (next.has(commitHash)) {
        next.delete(commitHash);
      } else {
        next.add(commitHash);
      }
      return next;
    });
  };

  if (!activeBundle) {
    return (
      <div className="p-8 text-center text-gray-500 bg-white rounded-lg border">
        No compliance evidence bundles found.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300" data-testid="compliance-evidence-bundle-view">
      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-xl text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Zero-Knowledge Audit-Safe
              </span>
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full text-xs font-medium">
                Redacted Remuneration Inputs
              </span>
            </div>
            <h2 className="text-xl font-bold mt-2">Compliance Evidence Bundles</h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Consolidated audit receipts, zero-knowledge verifier proof references,
              Soroban transaction metadata, and multi-signature approval logs.
              Guarantees full regulatory auditability without exposing employee salary details.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={handleVerify}
              disabled={isVerifying}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? "animate-spin" : ""}`} />
              {isVerifying ? "Verifying..." : "Verify Consistency"}
            </Button>

            <Button
              onClick={handleDownloadJson}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download Bundle JSON
            </Button>
          </div>
        </div>
      </div>

      {/* Filter and Selection Header */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search & Filter Inputs */}
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search bundle ID, title, txHash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-lg border border-gray-300 bg-white px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="verified">Verified Only</option>
            <option value="pending_review">Pending Review</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Bundle Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="bundle-select" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Active Bundle:
          </label>
          <select
            id="bundle-select"
            aria-label="Select active bundle"
            value={activeBundle.bundleId}
            onChange={(e) => selectBundle(e.target.value)}
            className="text-xs font-semibold rounded-lg border border-indigo-200 bg-indigo-50/50 text-indigo-900 px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {filteredBundles.map((b) => (
              <option key={b.bundleId} value={b.bundleId}>
                {b.bundleId} — {b.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Bundle Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Verification Status */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>VERIFICATION STATUS</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-gray-900 capitalize">
              {activeBundle.verificationStatus.isVerified ? "Verified" : "Pending"}
            </span>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {activeBundle.verificationStatus.checksPassed}/{activeBundle.verificationStatus.totalChecks} Checks
            </span>
          </div>
          <p className="text-[11px] text-gray-500 truncate">
            Daemon: {activeBundle.verificationStatus.verifiedBy}
          </p>
        </div>

        {/* ZK Proof Status */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>ZK PROOF REFERENCE</span>
            <Lock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-gray-900">
              {activeBundle.proofReference.proofId.slice(0, 14)}...
            </span>
            <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 uppercase">
              {activeBundle.proofReference.proofStatus}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 truncate font-mono">
            Digest: {activeBundle.proofReference.publicSignalsDigest.slice(0, 16)}...
          </p>
        </div>

        {/* Financial Summary */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>AUDIT DISBURSEMENT</span>
            <FileCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-gray-900">
              ${activeBundle.receipts.reduce((s, r) => s + r.totalDisbursed, 0).toLocaleString()}
            </span>
            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
              {activeBundle.receipts.reduce((s, r) => s + r.recipientCount, 0)} Recipients
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            {activeBundle.receipts.length} Audit-Safe Receipts
          </p>
        </div>

        {/* Network & Ledger */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>SETTLEMENT LEDGER</span>
            <Terminal className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-gray-900 uppercase">
              {activeBundle.transactionMetadata.network}
            </span>
            <span className="text-xs font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              #{activeBundle.transactionMetadata.ledgerSequence}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 truncate font-mono">
            TxHash: {activeBundle.transactionMetadata.txHash.slice(0, 14)}...
          </p>
        </div>
      </div>

      {/* Main Bundle Details Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50/50 px-4">
          <button
            type="button"
            onClick={() => setActiveTab("receipts")}
            className={`px-4 py-3 text-xs font-semibold transition-colors relative flex items-center gap-1.5 ${
              activeTab === "receipts"
                ? "text-indigo-600 border-b-2 border-indigo-600 bg-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            Audit-Safe Receipts ({activeBundle.receipts.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("proof")}
            className={`px-4 py-3 text-xs font-semibold transition-colors relative flex items-center gap-1.5 ${
              activeTab === "proof"
                ? "text-indigo-600 border-b-2 border-indigo-600 bg-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            ZK Proof Reference
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("metadata")}
            className={`px-4 py-3 text-xs font-semibold transition-colors relative flex items-center gap-1.5 ${
              activeTab === "metadata"
                ? "text-indigo-600 border-b-2 border-indigo-600 bg-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Transaction Metadata
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-4 py-3 text-xs font-semibold transition-colors relative flex items-center gap-1.5 ${
              activeTab === "history"
                ? "text-indigo-600 border-b-2 border-indigo-600 bg-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Approval History ({activeBundle.approvalHistory.length})
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6">
          {/* TAB 1: AUDIT SAFE RECEIPTS */}
          {activeTab === "receipts" && (
            <div className="space-y-6">
              <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Privacy Rule Enforcement:</strong> Individual salary breakdown amounts are excluded from receipts.
                  Recipient lists are represented strictly as zero-knowledge cryptographic commitment hashes (SHA-256 / Pedersen).
                </p>
              </div>

              <div className="space-y-4">
                {activeBundle.receipts.map((rcpt) => (
                  <div
                    key={rcpt.receiptId}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50/30 hover:bg-gray-50 transition-colors space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/80 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-900">
                            {rcpt.receiptId}
                          </span>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            {rcpt.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          Issued: {new Date(rcpt.timestamp).toLocaleString()}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-gray-400 font-semibold uppercase">Disbursed Total</p>
                        <p className="text-base font-bold text-gray-900">
                          ${rcpt.totalDisbursed.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Commitments list */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-indigo-600" />
                          Recipient Commitment Hashes ({rcpt.recipientCommitments.length})
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {rcpt.recipientCommitments.map((hash, idx) => {
                          const isRevealed = revealedCommitments.has(hash);
                          return (
                            <div
                              key={hash + idx}
                              className="bg-white border border-gray-200 rounded px-3 py-1.5 flex items-center justify-between text-xs font-mono"
                            >
                              <span className="text-gray-700 truncate mr-2">
                                Recipient #{idx + 1}:{" "}
                                {isRevealed ? hash : `${hash.slice(0, 14)}..................[REDACTED]`}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => toggleCommitmentReveal(hash)}
                                  className="text-gray-400 hover:text-gray-600 p-1"
                                  title={isRevealed ? "Hide commitment hash" : "Reveal full commitment hash"}
                                >
                                  {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(hash, `Commitment #${idx + 1}`)}
                                  className="text-gray-400 hover:text-indigo-600 p-1"
                                  title="Copy commitment hash"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Cryptographic Signature */}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-mono">
                      <span>Receipt Hash: {rcpt.receiptHash}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(rcpt.signature, "Receipt Signature")}
                        className="text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Signature Digest
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: ZK PROOF REFERENCE */}
          {activeTab === "proof" && (
            <div className="space-y-6">
              <div className="bg-indigo-900 text-white rounded-lg p-5 shadow-inner space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-indigo-400" />
                    Zero-Knowledge Proof Artifacts
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase">
                    {activeBundle.proofReference.proofStatus}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <p className="text-[10px] text-indigo-300 font-semibold uppercase">Proof Reference ID</p>
                    <p className="text-sm font-mono font-bold text-white">{activeBundle.proofReference.proofId}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] text-indigo-300 font-semibold uppercase">Verifier Soroban Contract</p>
                    <p className="text-xs font-mono text-indigo-100 truncate">{activeBundle.proofReference.verifierContract}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] text-indigo-300 font-semibold uppercase">Circuit WASM Hash</p>
                    <p className="text-xs font-mono text-indigo-100 truncate">{activeBundle.proofReference.circuitHash}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] text-indigo-300 font-semibold uppercase">Public Signals Digest</p>
                    <p className="text-xs font-mono text-indigo-100 truncate">{activeBundle.proofReference.publicSignalsDigest}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-indigo-800/80 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-indigo-300 gap-2">
                  <span>
                    Verified At:{" "}
                    {activeBundle.proofReference.verifiedAt
                      ? new Date(activeBundle.proofReference.verifiedAt).toLocaleString()
                      : "N/A"}
                  </span>
                  <span>
                    Expiration: {new Date(activeBundle.proofReference.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Raw Digest Card */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Raw ZK Proof Digest
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(activeBundle.proofReference.rawProofHash, "Raw Proof Hash")}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy Digest
                  </button>
                </div>
                <div className="bg-gray-900 text-gray-100 font-mono text-xs p-3 rounded overflow-x-auto">
                  {activeBundle.proofReference.rawProofHash}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TRANSACTION METADATA */}
          {activeTab === "metadata" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Ledger & Settlement Details
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-gray-500">Stellar Network</span>
                      <span className="font-bold text-gray-900 uppercase">
                        {activeBundle.transactionMetadata.network}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-gray-500">Ledger Sequence</span>
                      <span className="font-mono font-bold text-gray-900">
                        #{activeBundle.transactionMetadata.ledgerSequence}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-gray-500">Transaction Fee</span>
                      <span className="font-mono font-medium text-gray-900">
                        {activeBundle.transactionMetadata.feeStroops} stroops
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-gray-500">Transaction Hash</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            activeBundle.transactionMetadata.txHash,
                            "Transaction Hash"
                          )
                        }
                        className="text-indigo-600 hover:underline font-mono text-[11px] flex items-center gap-1"
                      >
                        {activeBundle.transactionMetadata.txHash.slice(0, 10)}...
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Contract Addresses */}
                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Soroban Contract Deployments
                  </h4>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-gray-500">Registry:</span>
                      <span className="text-gray-800 truncate max-w-[200px]">
                        {activeBundle.transactionMetadata.contractAddresses.registry}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-gray-500">Commitment:</span>
                      <span className="text-gray-800 truncate max-w-[200px]">
                        {activeBundle.transactionMetadata.contractAddresses.commitment}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-gray-500">Verifier:</span>
                      <span className="text-gray-800 truncate max-w-[200px]">
                        {activeBundle.transactionMetadata.contractAddresses.verifier}
                      </span>
                    </div>
                    <div className="flex justify-between border-b pb-1.5">
                      <span className="text-gray-500">Executor:</span>
                      <span className="text-gray-800 truncate max-w-[200px]">
                        {activeBundle.transactionMetadata.contractAddresses.executor}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Audit:</span>
                      <span className="text-gray-800 truncate max-w-[200px]">
                        {activeBundle.transactionMetadata.contractAddresses.audit}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: APPROVAL HISTORY */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Immutable Lifecycle & Audit Events
              </h4>

              <div className="relative border-l-2 border-indigo-200 ml-4 space-y-6 py-2">
                {activeBundle.approvalHistory.map((evt, idx) => (
                  <div key={evt.id || idx} className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 bg-indigo-600 text-white rounded-full p-1 ring-4 ring-white">
                      <CheckCircle2 className="w-3 h-3" />
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-900 capitalize">
                          {evt.type.replace(/_/g, " ")}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {new Date(evt.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{evt.details}</p>
                      <p className="text-[11px] font-semibold text-indigo-700">
                        Actor: {evt.actor}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
