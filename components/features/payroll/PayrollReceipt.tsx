"use client";

import { CheckCircle2, Hash, Users, Banknote, Calendar, ArrowRight, Printer, History } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { validateSettlementReceiptId } from "@/lib/validation/settlementReceipt";

interface PayrollReceiptProps {
  totalAmount: number;
  employeeCount: number;
  transactionHash: string | null;
  receiptId?: string | null;
  onReset: () => void;
}

export default function PayrollReceipt({
  totalAmount,
  employeeCount,
  transactionHash,
  receiptId,
  onReset,
}: PayrollReceiptProps) {
  const timestamp = new Date().toLocaleString();
  const receiptValidation = validateSettlementReceiptId(receiptId);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in duration-300">
      {/* Success Badge */}
      <div className="flex justify-center mb-6">
        <div className="bg-green-100 p-3 rounded-full">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
      </div>

      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-gray-900">Payroll Processed</h3>
        <p className="text-gray-500 mt-1">Transaction confirmed on network</p>
      </div>

      {!receiptValidation.isValid && (
        <div role="alert" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Settlement receipt unavailable</p>
          <p className="mt-1">{receiptValidation.message} Contact an administrator before treating this receipt as settled.</p>
        </div>
      )}

      {/* Receipt Style Container */}
      <div className="bg-white border-2 border-dashed border-gray-200 rounded-lg p-6 space-y-6 relative overflow-hidden">
        {/* Top/Bottom "Teeth" Effect (CSS-only approximation) */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[radial-gradient(circle,transparent_20%,white_20%)] bg-[length:10px_10px] bg-repeat-x" />
        
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Transaction Statement</p>
            <p className="text-xs text-gray-500 mt-1">{timestamp}</p>
          </div>
          <div className="text-right text-indigo-600 font-mono text-xs">#ZK-{Date.now().toString().slice(-6)}</div>
        </div>

        <div className="space-y-4 pt-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Settlement Receipt ID</span>
            <span className="font-mono text-gray-900">
              {receiptValidation.isValid ? receiptValidation.normalized : "Unavailable"}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Users className="w-4 h-4" />
              <span>Employees Paid</span>
            </div>
            <span className="font-semibold text-gray-900">{employeeCount}</span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Banknote className="w-4 h-4" />
              <span>Total Disbursed</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">${totalAmount.toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>Execution Date</span>
            </div>
            <span className="text-gray-900">{new Date().toLocaleDateString()}</span>
          </div>
        </div>

        {transactionHash && (
          <div className="bg-gray-50 rounded p-3 mt-4">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase mb-1.5">
              <Hash className="w-3 h-3" /> Hash
            </div>
            <p className="text-[10px] font-mono text-gray-500 break-all leading-relaxed">
              {transactionHash}
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-dashed border-gray-200 text-center">
            <p className="text-[10px] text-gray-400 font-medium italic">Privacy Protected by ZK Proofs</p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 space-y-3 print:hidden">
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handlePrint}
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </Button>
          <Link href="/history" className="contents">
            <Button variant="outline" className="gap-2">
              <History className="w-4 h-4" />
              View History
            </Button>
          </Link>
        </div>
        
        <Button 
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-11"
          onClick={onReset}
        >
          Start New Payroll Run
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
