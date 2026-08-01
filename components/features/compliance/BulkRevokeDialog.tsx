"use client";

import { useState, useMemo } from "react";
import { Shield, Users, Loader2, AlertTriangle, X } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { ViewKey } from "@/types/models";
import { useViewKeyStore } from "@/stores/viewKeys";

interface BulkRevokeDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BulkRevokeDialog({ isOpen, onClose }: BulkRevokeDialogProps) {
  const { viewKeys, revokeViewKey } = useViewKeyStore();
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'select' | 'confirm' | 'success'>('select');

  const activeKeys = viewKeys.filter((key: ViewKey) => key.isActive);
  const selectedKeysArray = useMemo(() => 
    activeKeys.filter(key => selectedKeys.has(key.id)),
    [activeKeys, selectedKeys]
  );

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
        selectedKeysArray.map(async (key) => {
          await revokeViewKey(key.id);
        })
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
        step === 'select' ? 'Bulk Revoke Access'
          : step === 'confirm' ? 'Confirm Bulk Revocation'
          : 'Access Revoked'
      }
      description={
        step === 'select' 
          ? "Select multiple auditor access keys to revoke simultaneously. This will immediately invalidate their access."
          : step === 'confirm'
          ? `Are you sure you want to revoke access for ${selectedKeysArray.length} key${selectedKeysArray.length !== 1 ? 's' : ''}? This cannot be undone.`
          : `Access has been successfully revoked for ${selectedKeysArray.length} auditor key${selectedKeysArray.length !== 1 ? 's' : ''}.`
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
      reasonPlaceholder="e.g., Security concerns, role change, access review complete..."
    >
      {step === 'select' && (
        <div className="space-y-4">
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
                    id={`revoke-key-${key.id}`}
                    type="checkbox"
                    checked={selectedKeys.has(key.id)}
                    onChange={() => handleKeyToggle(key.id)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded mr-3"
                  />
                  <label htmlFor={`revoke-key-${key.id}`} className="flex-1 min-w-0 cursor-pointer">
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
                  </label>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleProceed}
            disabled={selectedKeys.size === 0}
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Proceed to Review ({selectedKeys.size} selected)
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-red-800">Warning</h4>
              <p className="text-sm text-red-700 mt-1">
                This will immediately revoke access for the selected auditors. They will lose all audit access rights.
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
                All selected auditors have been notified that their access has been revoked.
              </p>
            </div>
          </div>
        </div>
      )}
    </ConfirmationDialog>
  );
}

export default BulkRevokeDialog;
