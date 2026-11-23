'use client';

import React from 'react';
import {
  getDeactivatedAssetWarning,
  AssetStatusInfo,
} from '@/lib/assets/deactivatedAsset';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface DeactivatedAssetBannerProps {
  assetSymbol: string;
  assetsList?: AssetStatusInfo[];
  onSwitchAsset?: () => void;
  className?: string;
}

export const DeactivatedAssetBanner: React.FC<DeactivatedAssetBannerProps> = ({
  assetSymbol,
  assetsList,
  onSwitchAsset,
  className = '',
}) => {
  const warning = getDeactivatedAssetWarning(assetSymbol, assetsList);

  if (!warning.isDeactivated) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`bg-destructive/15 border border-destructive/30 text-destructive-foreground rounded-lg p-4 shadow-sm ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm tracking-tight text-destructive">
              {warning.title}
            </h4>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-destructive/20 text-destructive border border-destructive/30">
              Deactivated
            </span>
          </div>

          <p className="text-xs mt-1 text-foreground/90 leading-relaxed">
            {warning.message}
          </p>

          <p className="text-xs mt-2 font-medium text-destructive">
            <strong>Recommended Action:</strong> {warning.remediation}
          </p>

          {warning.deactivatedAt && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Deactivated on: {warning.deactivatedAt}
            </p>
          )}

          {onSwitchAsset && (
            <div className="mt-3">
              <button
                type="button"
                onClick={onSwitchAsset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors focus:outline-none focus:ring-2 focus:ring-destructive"
              >
                Switch Asset Configuration
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
