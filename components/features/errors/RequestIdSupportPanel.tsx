'use client';

import React, { useState } from 'react';
import {
  generateSupportDiagnosticBundle,
  SupportDiagnosticContext,
} from '@/lib/observability/requestIdPanel';
import { Check, Copy, HelpCircle, ShieldCheck, X } from 'lucide-react';

interface RequestIdSupportPanelProps {
  context: SupportDiagnosticContext;
  onClose?: () => void;
  className?: string;
}

export const RequestIdSupportPanel: React.FC<RequestIdSupportPanelProps> = ({
  context,
  onClose,
  className = '',
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedBundle, setCopiedBundle] = useState(false);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(context.requestId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyBundle = async () => {
    try {
      const bundleText = generateSupportDiagnosticBundle(context);
      await navigator.clipboard.writeText(bundleText);
      setCopiedBundle(true);
      setTimeout(() => setCopiedBundle(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      role="region"
      aria-label="Request ID Support Panel"
      className={`bg-card text-card-foreground border rounded-lg p-5 shadow-sm space-y-4 max-w-lg ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-base tracking-tight">Support Diagnostic Panel</h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close support panel"
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Reference this Request ID when communicating with engineering support or troubleshooting system events.
      </p>

      {/* Request ID Display */}
      <div className="bg-muted p-3 rounded-md border flex items-center justify-between gap-2">
        <div className="truncate">
          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
            Request Identifier
          </div>
          <code className="text-sm font-mono font-bold text-foreground truncate block mt-0.5">
            {context.requestId}
          </code>
        </div>
        <button
          type="button"
          onClick={handleCopyId}
          aria-label="Copy Request ID"
          className="px-2.5 py-1.5 text-xs font-medium bg-background border rounded hover:bg-accent transition-colors shrink-0 flex items-center gap-1.5"
        >
          {copiedId ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy ID</span>
            </>
          )}
        </button>
      </div>

      {/* Operation Context Details */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-muted/50 p-2 rounded border">
          <span className="text-muted-foreground block text-[11px]">Operation</span>
          <span className="font-mono font-medium truncate block mt-0.5">
            {context.operation || 'GENERAL'}
          </span>
        </div>
        <div className="bg-muted/50 p-2 rounded border">
          <span className="text-muted-foreground block text-[11px]">Environment</span>
          <span className="font-mono font-medium truncate block mt-0.5">
            {context.environment || 'mainnet'}
          </span>
        </div>
      </div>

      {context.errorMessage && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-2.5 rounded">
          <span className="font-semibold block mb-0.5">Diagnostic Error Event:</span>
          {context.errorMessage}
        </div>
      )}

      {/* Privacy Guarantee Badge */}
      <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 p-2.5 rounded text-xs">
        <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <span>
          <strong>Privacy Assured:</strong> Diagnostic bundles contain sanitized system logs only. No salary, SSN, or private key data is included.
        </span>
      </div>

      {/* Action Bar */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={handleCopyBundle}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {copiedBundle ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Bundle Copied!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy Support Diagnostic Bundle
            </>
          )}
        </button>
      </div>
    </div>
  );
};
