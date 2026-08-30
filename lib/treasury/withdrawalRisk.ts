import type { TreasuryBalance, PayrollObligation } from "@/stores/treasury";

export type WithdrawalRiskLevel = "safe" | "risky" | "blocked";

export interface WithdrawalRiskResult {
  riskLevel: WithdrawalRiskLevel;
  message: string;
  details: {
    available: number;
    reserved: number;
    projected: number;
    postWithdrawal: number;
    obligationTotal: number;
    violatesReserved: boolean;
    fallsBelowBuffer: boolean;
  };
  assetLabel: string;
}

const SAFETY_BUFFER = 25_000;

function formatAssetLabel(assetCode: string): string {
  if (assetCode === "USDC") return "USDC";
  if (assetCode === "XLM") return "XLM";
  return assetCode;
}

/**
 * Compute the risk level of a proposed treasury withdrawal.
 *
 * - `blocked`: the withdrawal would violate locked payroll obligations.
 * - `risky`:  the withdrawal is above the safety buffer but within surplus.
 * - `safe`:   the withdrawal fits comfortably within the available surplus.
 */
export function computeWithdrawalRisk(
  balance: TreasuryBalance,
  withdrawalAmount: number,
  obligations: PayrollObligation[],
  bufferReserve: number = SAFETY_BUFFER,
): WithdrawalRiskResult {
  const assetLabel = formatAssetLabel(balance.assetCode);

  const relevantObligations = obligations.filter(
    (o) => o.assetCode === balance.assetCode,
  );
  const obligationTotal = relevantObligations.reduce(
    (sum, o) => sum + o.amount,
    0,
  );

  const postWithdrawal = balance.available - withdrawalAmount;
  const violatesReserved = postWithdrawal < 0;
  const fallsBelowBuffer = postWithdrawal < bufferReserve;

  let riskLevel: WithdrawalRiskLevel;
  let message: string;

  if (violatesReserved) {
    riskLevel = "blocked";
    message = `Withdrawal of $${withdrawalAmount.toLocaleString()} would exceed available ${assetLabel} balance of $${balance.available.toLocaleString()}. This withdrawal violates locked payroll requirements and cannot proceed.`;
  } else if (fallsBelowBuffer) {
    riskLevel = "blocked";
    message = `Withdrawal of $${withdrawalAmount.toLocaleString()} would leave only $${postWithdrawal.toLocaleString()} in the ${assetLabel} treasury, below the required safety buffer of $${bufferReserve.toLocaleString()}. Payroll obligations cannot be guaranteed.`;
  } else if (postWithdrawal < obligationTotal + bufferReserve) {
    riskLevel = "risky";
    message = `This withdrawal of $${withdrawalAmount.toLocaleString()} would reduce the ${assetLabel} surplus to $${postWithdrawal.toLocaleString()}. While payroll can still be covered, the buffer is reduced. Explicit confirmation is required.`;
  } else {
    riskLevel = "safe";
    message = `This withdrawal of $${withdrawalAmount.toLocaleString()} is within the available ${assetLabel} surplus. The treasury will retain $${postWithdrawal.toLocaleString()} after the withdrawal, comfortably covering upcoming payroll obligations.`;
  }

  return {
    riskLevel,
    message,
    details: {
      available: balance.available,
      reserved: balance.reserved,
      projected: balance.projected,
      postWithdrawal,
      obligationTotal,
      violatesReserved,
      fallsBelowBuffer,
    },
    assetLabel,
  };
}
