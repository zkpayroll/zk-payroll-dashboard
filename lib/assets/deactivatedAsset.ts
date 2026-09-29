import { sanitize } from '../sanitize';

export type AssetStatus = 'active' | 'deactivated' | 'paused';

export interface AssetStatusInfo {
  symbol: string;
  name: string;
  status: AssetStatus;
  deactivatedAt?: string;
  deactivationReason?: string;
}

export interface DeactivatedAssetWarningInfo {
  isDeactivated: boolean;
  symbol: string;
  title: string;
  message: string;
  remediation: string;
  deactivatedAt?: string;
  reason?: string;
}

export const DEFAULT_ASSET_STATUS_LIST: AssetStatusInfo[] = [
  { symbol: 'XLM', name: 'Stellar Lumens', status: 'active' },
  { symbol: 'USDC', name: 'USD Coin', status: 'active' },
  { symbol: 'EURC', name: 'Euro Coin', status: 'active' },
  {
    symbol: 'USDC_DEPRECATED',
    name: 'USD Coin (V1 Legacy)',
    status: 'deactivated',
    deactivatedAt: '2026-08-15',
    deactivationReason: 'Upgraded to V2 multi-chain asset contract',
  },
  {
    symbol: 'OLD_TOKEN',
    name: 'Legacy Utility Token',
    status: 'deactivated',
    deactivatedAt: '2026-01-01',
    deactivationReason: 'Token contract retired by issuer',
  },
];

export function isAssetDeactivated(
  symbol: string,
  customList: AssetStatusInfo[] = DEFAULT_ASSET_STATUS_LIST
): boolean {
  if (!symbol) return false;
  const normalizedSymbol = symbol.trim().toUpperCase();
  const asset = customList.find(
    (a) => a.symbol.toUpperCase() === normalizedSymbol
  );
  return asset ? asset.status === 'deactivated' : false;
}

export function getDeactivatedAssetWarning(
  symbol: string,
  customList: AssetStatusInfo[] = DEFAULT_ASSET_STATUS_LIST
): DeactivatedAssetWarningInfo {
  const normalizedSymbol = symbol ? symbol.trim().toUpperCase() : 'UNKNOWN';
  const asset = customList.find(
    (a) => a.symbol.toUpperCase() === normalizedSymbol
  );

  const isDeactivated = asset ? asset.status === 'deactivated' : false;

  if (!isDeactivated) {
    return {
      isDeactivated: false,
      symbol: normalizedSymbol,
      title: 'Asset Active',
      message: `Asset ${normalizedSymbol} is active and available for payroll processing.`,
      remediation: 'No action required.',
    };
  }

  const rawReason = asset?.deactivationReason || 'Asset has been retired by treasury policy.';
  const sanitizedReason = sanitize(rawReason);

  return {
    isDeactivated: true,
    symbol: normalizedSymbol,
    title: `Deactivated Asset Alert: ${normalizedSymbol}`,
    message: `Asset '${normalizedSymbol}' has been deactivated and is not permitted for payroll disbursements. ${sanitizedReason}`,
    remediation: `Please select an active settlement asset (such as USDC or XLM) from Treasury Settings prior to submitting this batch.`,
    deactivatedAt: asset?.deactivatedAt,
    reason: sanitizedReason,
  };
}
