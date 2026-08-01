"use client";

import { useState } from "react";
import {
  CheckCircle,
  Clock,
  XCircle,
  Copy,
  ExternalLink,
  Calendar,
  Users,
  DollarSign,
  Shield,
  Hash,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import StatusBadge from "@/components/ui/StatusBadge";
import Badge from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PayrollTransaction } from "@/types";

interface TransactionDetailDrawerProps {
  transaction: PayrollTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invalidTxId?: string | null;
}

function TransactionDetailDrawer({
  transaction,
  open,
  onOpenChange,
  invalidTxId,
}: TransactionDetailDrawerProps) {
  const [showProof, setShowProof] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!transaction && !invalidTxId) return null;

  if (invalidTxId) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader className="space-y-4 pb-6 border-b">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <SheetTitle className="text-2xl">Transaction Details</SheetTitle>
                <SheetDescription>
                  View complete information about this payroll transaction
                </SheetDescription>
              </div>
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive">Invalid ID</Badge>
              <span className="text-sm text-gray-500">•</span>
              <span className="text-sm text-gray-600 font-mono">
                {invalidTxId}
              </span>
            </div>
          </SheetHeader>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h4 className="text-lg font-bold text-gray-900 mb-2">Transaction Not Found</h4>
            <p className="text-sm text-gray-500 max-w-sm px-4">
              The transaction ID <code className="px-1.5 py-0.5 bg-red-50 rounded text-red-700 font-mono text-xs font-semibold">{invalidTxId}</code> could not be located in our records.
            </p>
            <div className="mt-8 p-4 bg-gray-50 rounded-lg text-xs text-gray-500 max-w-sm border border-gray-100">
              Please double check the transaction link or verify that the transaction exists in your account history.
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!transaction) return null;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const maskValue = (value: string, visibleChars = 8) => {
    if (value.length <= visibleChars * 2) return value;
    return `${value.slice(0, visibleChars)}...${value.slice(-visibleChars)}`;
  };

  const getStatusIcon = () => {
    switch (transaction.status) {
      case "verified":
        return (
          <CheckCircle className="w-5 h-5 text-green-600" aria-hidden="true" />
        );
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-600" aria-hidden="true" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-600" aria-hidden="true" />;
      case "cancelled":
        return <XCircle className="w-5 h-5 text-gray-500" aria-hidden="true" />;
    }
  };

  const getStatusBadge = () => {
    return <StatusBadge status={transaction.status} />;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "UTC",
      }),
    };
  };

  const createdDate = formatDate(transaction.createdAt);
  const processedDate = transaction.timestamp
    ? formatDate(transaction.timestamp)
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader className="space-y-4 pb-6 border-b">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <SheetTitle className="text-2xl">Transaction Details</SheetTitle>
              <SheetDescription>
                View complete information about this payroll transaction
              </SheetDescription>
            </div>
            {getStatusIcon()}
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <span className="text-sm text-gray-500">•</span>
            <span className="text-sm text-gray-600 font-mono">
              {transaction.id}
            </span>
          </div>
        </SheetHeader>

        {/* Announce clipboard actions to assistive technology */}
        <div role="status" aria-live="polite" className="sr-only">
          {copiedField === "txHash" && "Transaction hash copied to clipboard"}
          {copiedField === "proof" &&
            "Zero-knowledge proof copied to clipboard"}
        </div>

        <ScrollArea className="h-[calc(100vh-200px)] pr-4">
          <div className="space-y-6 py-6">
            {/* Transaction Summary */}
            <section>
              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4" aria-hidden="true" />
                Transaction Summary
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Total Amount</span>
                  <span className="text-lg font-semibold text-gray-900">
                    ${transaction.totalAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    <Users className="w-4 h-4" aria-hidden="true" />
                    Employees Paid
                  </span>
                  <span className="font-medium text-gray-900">
                    {transaction.employeeCount}
                  </span>
                </div>
              </div>
            </section>

            {/* Timestamps */}
            <section>
              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" aria-hidden="true" />
                Timeline
              </h4>
              <div className="space-y-3">
                <div className="p-3 border border-gray-200 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Created</div>
                  <div className="text-sm font-medium text-gray-900">
                    {createdDate.date}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {createdDate.time}
                  </div>
                </div>
                {processedDate && (
                  <div className="p-3 border border-gray-200 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">
                      {transaction.status === "verified"
                        ? "Verified"
                        : "Processed"}
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {processedDate.date}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {processedDate.time}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Verification Status */}
            <section>
              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4" aria-hidden="true" />
                Verification
              </h4>
              <div className="space-y-3">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      Status
                    </span>
                    {getStatusBadge()}
                  </div>
                  <div className="text-xs text-gray-600">
                    {transaction.status === "verified" &&
                      "This transaction has been cryptographically verified and is immutable on the blockchain."}
                    {transaction.status === "pending" &&
                      "This transaction is awaiting verification. The zero-knowledge proof is being processed."}
                    {transaction.status === "failed" &&
                      "This transaction failed verification. Please contact support if you believe this is an error."}
                    {transaction.status === "cancelled" &&
                      "This transaction has been cancelled."}
                  </div>
                </div>

                {/* Zero-Knowledge Proof */}
                {transaction.proof && (
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Shield className="w-4 h-4" aria-hidden="true" />
                        ZK Proof
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowProof(!showProof)}
                        aria-expanded={showProof}
                        aria-label={
                          showProof
                            ? "Hide zero-knowledge proof"
                            : "Show zero-knowledge proof"
                        }
                        className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                      >
                        {showProof ? (
                          <>
                            <EyeOff className="w-3 h-3" aria-hidden="true" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" aria-hidden="true" />
                            Show
                          </>
                        )}
                      </button>
                    </div>
                    <div className="font-mono text-xs text-gray-900 bg-gray-50 p-2 rounded break-all">
                      {showProof
                        ? transaction.proof
                        : maskValue(transaction.proof, 12)}
                    </div>
                    {showProof && (
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(transaction.proof, "proof")
                        }
                        aria-label="Copy zero-knowledge proof to clipboard"
                        className="mt-2 text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" aria-hidden="true" />
                        {copiedField === "proof" ? "Copied!" : "Copy proof"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Blockchain Details */}
            {transaction.txHash && (
              <section>
                <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Hash className="w-4 h-4" aria-hidden="true" />
                  Blockchain Details
                </h4>
                <div className="space-y-3">
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="text-xs text-gray-500 mb-2">
                      Transaction Hash
                    </div>
                    <div className="font-mono text-sm text-gray-900 break-all mb-3">
                      {transaction.txHash}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(transaction.txHash!, "txHash")
                        }
                        aria-label="Copy transaction hash to clipboard"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        <Copy className="w-3 h-3" aria-hidden="true" />
                        {copiedField === "txHash" ? "Copied!" : "Copy"}
                      </button>
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${transaction.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View transaction on Stellar Expert explorer (opens in a new tab)"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        View on Explorer
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Company Information */}
            <section>
              <h4 className="text-sm font-semibold text-gray-900 mb-4">
                Organization
              </h4>
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Company ID</div>
                <div className="font-mono text-sm text-gray-900 break-all">
                  {transaction.companyId}
                </div>
              </div>
            </section>

            {/* Privacy Notice */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Shield
                  className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <div className="text-xs text-blue-900">
                  <div className="font-medium mb-1">Privacy Protected</div>
                  <div className="text-blue-800">
                    Individual employee salaries and personal information remain
                    encrypted. Only aggregate totals and verification proofs are
                    visible to maintain privacy while ensuring transparency.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default TransactionDetailDrawer;
