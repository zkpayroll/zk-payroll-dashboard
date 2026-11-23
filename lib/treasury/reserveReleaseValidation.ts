import type { TreasuryBalance, PayrollObligation } from "@/stores/treasury";

export type ReserveReleaseRiskLevel = "safe" | "blocked";

export interface ReserveReleaseValidationResult {
  riskLevel: ReserveReleaseRiskLevel;
  message: string;
  details: {
    available: number;
    reserved: number;
    releaseAmount: number;
    violatesReserved: boolean;
    violatesObligation: boolean;
    violatesAsset: boolean;
    isZeroOrNegative: boolean;
    isNotFinite: boolean;
    hasInvalidBalance: boolean;
    hasInvalidObligation: boolean;
  };
  assetLabel: string;
}

function formatAssetLabel(assetCode: string): string {
  if (assetCode === "USDC") return "USDC";
  if (assetCode === "XLM") return "XLM";
  return assetCode;
}

/**
 * Validates the release of treasury reserves.
 * Ensures the release amount is positive and does not exceed available reserved balances
 * or the specified obligation's amount.
 */
export function validateReserveRelease(
  balance: TreasuryBalance,
  releaseAmount: number,
  obligation?: PayrollObligation,
): ReserveReleaseValidationResult {
  const assetLabel = formatAssetLabel(balance.assetCode);

  const isNotFinite = !Number.isFinite(releaseAmount);
  const isZeroOrNegative = !isNotFinite && releaseAmount <= 0;
  const hasInvalidBalance =
    !Number.isFinite(balance.available) ||
    balance.available < 0 ||
    !Number.isFinite(balance.reserved) ||
    balance.reserved < 0 ||
    (!isNotFinite && Number.isFinite(balance.available) &&
      !Number.isFinite(balance.available + releaseAmount));
  const hasInvalidObligation =
    obligation !== undefined &&
    (!Number.isFinite(obligation.amount) || obligation.amount <= 0);
  const violatesReserved =
    !isNotFinite && Number.isFinite(balance.reserved) && releaseAmount > balance.reserved;
  const violatesObligation =
    obligation !== undefined &&
    !isNotFinite &&
    Number.isFinite(obligation.amount) &&
    releaseAmount > obligation.amount;
  const violatesAsset =
    obligation !== undefined && obligation.assetCode !== balance.assetCode;

  let riskLevel: ReserveReleaseRiskLevel;
  let message: string;

  if (isNotFinite) {
    riskLevel = "blocked";
    message = "Enter a finite release amount greater than zero.";
  } else if (isZeroOrNegative) {
    riskLevel = "blocked";
    message = `Release amount must be greater than zero. Cannot release $${releaseAmount.toLocaleString()} of ${assetLabel}.`;
  } else if (hasInvalidBalance) {
    riskLevel = "blocked";
    message = `Cannot release ${assetLabel} because the treasury balance is invalid. Refresh the balance and try again.`;
  } else if (violatesReserved) {
    riskLevel = "blocked";
    message = `Cannot release $${releaseAmount.toLocaleString()} because it exceeds the total reserved balance of $${balance.reserved.toLocaleString()} for ${assetLabel}.`;
  } else if (violatesAsset) {
    riskLevel = "blocked";
    message = `Cannot release ${assetLabel} from an obligation denominated in ${obligation!.assetCode}. Select an obligation for the same asset.`;
  } else if (hasInvalidObligation) {
    riskLevel = "blocked";
    message = `Cannot release ${assetLabel} because the locked obligation amount is invalid. Refresh the obligation and try again.`;
  } else if (violatesObligation) {
    riskLevel = "blocked";
    message = `Cannot release $${releaseAmount.toLocaleString()} because it exceeds the locked obligation amount of $${obligation!.amount.toLocaleString()} for ${assetLabel}.`;
  } else {
    riskLevel = "safe";
    message = `The reserve release of $${releaseAmount.toLocaleString()} ${assetLabel} is valid and can safely proceed.`;
  }

  return {
    riskLevel,
    message,
    details: {
      available: balance.available,
      reserved: balance.reserved,
      releaseAmount,
      violatesReserved,
      violatesObligation,
      violatesAsset,
      isZeroOrNegative,
      isNotFinite,
      hasInvalidBalance,
      hasInvalidObligation,
    },
    assetLabel,
  };
}
