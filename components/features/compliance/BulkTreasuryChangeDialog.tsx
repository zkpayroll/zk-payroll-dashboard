"use client";

import { useState } from "react";
import { Shield, Users, AlertTriangle, Loader2 } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { useViewKeyStore } from "@/stores/viewKeys";
import type { ViewKey } from "@/types/models";

interface BulkTreasuryChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BulkTreasuryChangeDialog({ isOpen, onClose }: BulkTreasuryChangeDialogProps) {
  const { viewKeys, revokeViewKey } = useViewKeyStore();
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'select' | 'confirm' | 'success'>('select');

  const activeKeys = viewKeys.filter((key: ViewKey) => key.isActive);
  const selectedKeysArray = Array.from(selectedKeys)
    .map(id => activeKeys.find(key => key.id === id))
    .filter((key): key is ViewKey => key !== undefined);

  const handleKeyToggle = (keyId: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(keyId)) {
        next.delete(keyId);
      } else {
        next.add(keyId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedKeys.size === activeKeys.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(activeKeys.map(key => key.id)));
    }
  };

  const handleProceed = () => {
    if (selectedKeys.size === 0) return;
    setStep('confirm');
  };

  const handleConfirm = async (reason?: string) => {
    if (!reason) {
      throw new Error('Please provide a reason for revoking access');
    }

    setIsLoading(true);
    try {
      await Promise.all(
        Array.from(selectedKeys).map(id => revokeViewKey(id))
      );
      
      setStep('success');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep('select');
      setSelectedKeys(new Set());
    }, 300);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <ConfirmationDialog
      title={
        step === 'select' ? 'Bulk Revoke Auditor Access'
          : step === 'confirm' ? 'Confirm Bulk Revocation'
          : 'Access Revoked'
      }
      description={
        step === 'select'
          ? "Select multiple auditor access keys to revoke simultaneously. This will immediately invalidate their access across the entire audit system."
          : step === 'confirm'
          ? `Are you sure you want to revoke access for ${selectedKeysArray.length} auditor? This cannot be undone.`
          : `Access has been successfully revoked for ${selectedKeysArray.length} auditor.`
      }
      warning={
        step === 'select' 
          ? "This action will revoke multiple audit access rights simultaneously. All audits involving these keys will be immediately halted."
          : step === 'confirm'
          ? "This will immediately revoke access for selected auditors. All active audits will be stopped and reported to compliance."
          : "All selected access rights have been revoked and logged. Audit activity with these keys is now blocked."
      }
      confirmText={step === 'confirm' ? 'Revoke Access' : 'Done'}
      cancelText={step === 'success' ? 'Close' : 'Cancel'}
      variant="danger"
      icon="shield"
      isOpen={isOpen}
      onConfirm={step === 'confirm' ? (reason) => handleConfirm(reason) : async () => {}}
      onCancel={step === 'success' ? handleClose : handleClose}
      isLoading={isLoading}
      showReasonField={step === 'confirm'}
      reasonLabel="Revocation Reason"
      reasonPlaceholder="e.g., Security audit, compliance violation, role change, access review complete..."
    >
      {step === 'select' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-amber-800">High Risk Action</h4>
                <p className="text-xs text-amber-700 mt-1">
                  This action affects audit access across the entire organization. Please review your selection carefully.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {activeKeys.length} active key{activeKeys.length !== 1 ? 's' : ''} available
            </div>
            <button
              onClick={handleSelectAll}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              {selectedKeys.size === activeKeys.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {activeKeys.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No active view keys to revoke.</p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
              {activeKeys.map((key: ViewKey) => (
                <div
                  key={key.id}
                  className="flex items-center p-4 hover:bg-gray-50 cursor-pointer select-none"
                >
                  <input
                    id={`treasury-key-${key.id}`}
                    type="checkbox"
                    checked={selectedKeys.has(key.id)}
                    onChange={() => handleKeyToggle(key.id)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded mr-3"
                  />
                  <label htmlFor={`treasury-key-${key.id}`} className="flex-1 min-w-0 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {key.auditorName}
                      </p>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800 ml-2">
                        {key.scope === 'full-audit' ? 'Full Audit' : 'Read-only'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {key.auditorOrg} • Expires {formatDate(key.expiresAt)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Granted {formatDate(key.createdAt)}
                    </p>
                  </label>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleProceed}
            disabled={selectedKeys.size === 0}
            className="w-full py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Review & Revoke Access ({selectedKeys.size} selected)
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-red-800">Confirmation Required</h4>
              <p className="text-sm text-red-700 mt-1">
                This will immediately revoke access for {selectedKeysArray.length} auditor.
                All audits involving these keys will be blocked and reported to compliance.
              </p>
            </div>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-green-800">Access Successfully Revoked</h4>
              <p className="text-sm text-green-700 mt-1">
                All selected auditors have been notified. Active audits have been halted and logged.
              </p>
            </div>
          </div>
        </div>
      )}
    </ConfirmationDialog>
  );
}

export default BulkTreasuryChangeDialog;
