import { formatSupportedAssetsList, isSupportedAssetCode } from "@/lib/assets/supportedAssets";

export type TreasuryReservationStatus = "idle" | "active" | "error";

export interface TreasuryReservationInput {
  balance: number;
  amount: number;
  currentReservedAmount?: number;
  assetCode?: string;
}

export interface TreasuryReservationState {
  status: TreasuryReservationStatus;
  reservedAmount: number;
  availableAmount: number;
  message: string;
}

export const TREASURY_RESERVATION_COPY = {
  idle: "No funds are reserved for the next payroll run.",
  active: "Funds are reserved for the next payroll run.",
  invalidAmount: "Enter a valid amount greater than zero. No funds were reserved.",
  insufficientBalance:
    "Reservation failed: the amount exceeds the available treasury balance. Reduce the amount or add funds, then retry.",
  unknownAssetCode: (assetCode: string) => {
    const supportedList = formatSupportedAssetsList();
    const rawCode = assetCode.trim();
    const displayCode = rawCode && /^[A-Z0-9_-]{1,32}$/i.test(rawCode) ? ` "${rawCode}"` : "";
    return `Unknown or unsupported asset code${displayCode}. Treasury reservation requires a supported payroll asset (${supportedList}). Configure or select a supported asset before reserving funds.`;
  },
} as const;

export function getUnreservedAmount(balance: number, reservedAmount: number): number {
  return Math.max(0, balance - reservedAmount);
}

export function validateReservationAssetCode(assetCode?: string): string | null {
  if (assetCode !== undefined && !isSupportedAssetCode(assetCode)) {
    return TREASURY_RESERVATION_COPY.unknownAssetCode(assetCode);
  }
  return null;
}

export function validateReservationAmount(
  amount: number,
  balance: number,
): string | null {
  if (!Number.isFinite(amount) || !Number.isFinite(balance)) {
    return TREASURY_RESERVATION_COPY.invalidAmount;
  }
  if (amount <= 0) {
    return TREASURY_RESERVATION_COPY.invalidAmount;
  }
  if (amount > balance) {
    return TREASURY_RESERVATION_COPY.insufficientBalance;
  }
  return null;
}

export function createIdleReservation(balance: number): TreasuryReservationState {
  return {
    status: "idle",
    reservedAmount: 0,
    availableAmount: getUnreservedAmount(balance, 0),
    message: TREASURY_RESERVATION_COPY.idle,
  };
}

export function updateTreasuryReservation({
  balance,
  amount,
  currentReservedAmount = 0,
  assetCode,
}: TreasuryReservationInput): TreasuryReservationState {
  const assetError = validateReservationAssetCode(assetCode);
  if (assetError) {
    return {
      status: "error",
      reservedAmount: currentReservedAmount,
      availableAmount: getUnreservedAmount(balance, currentReservedAmount),
      message: assetError,
    };
  }

  const error = validateReservationAmount(amount, balance);
  if (error) {
    return {
      status: "error",
      reservedAmount: currentReservedAmount,
      availableAmount: getUnreservedAmount(balance, currentReservedAmount),
      message: error,
    };
  }

  return {
    status: "active",
    reservedAmount: amount,
    availableAmount: getUnreservedAmount(balance, amount),
    message: TREASURY_RESERVATION_COPY.active,
  };
}

export function releaseTreasuryReservation(balance: number): TreasuryReservationState {
  return createIdleReservation(balance);
}

export function formatReservationAmount(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}
