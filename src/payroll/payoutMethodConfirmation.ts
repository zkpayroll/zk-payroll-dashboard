import { validateDestinationAddress } from "@/lib/validation/payoutDestination";

export interface PayoutMethodConfirmationInput {
  employeeId: string;
  currentWallet?: string;
  proposedWallet: string;
  confirmed: boolean;
}

export interface PayoutMethodConfirmationResult {
  isValid: boolean;
  error: string | null;
}

/** Validates explicit employee payout-method confirmation before submission. */
export function validatePayoutMethodConfirmation(
  input: PayoutMethodConfirmationInput,
): PayoutMethodConfirmationResult {
  if (!input.employeeId.trim()) {
    return { isValid: false, error: "Employee is required before confirming a payout method." };
  }

  const proposedWallet = input.proposedWallet.trim();
  const addressError = validateDestinationAddress(proposedWallet);
  if (addressError) return { isValid: false, error: addressError };

  if (input.currentWallet?.trim() === proposedWallet) {
    return { isValid: false, error: "Choose a payout method different from the current destination." };
  }

  if (!input.confirmed) {
    return { isValid: false, error: "Confirm the employee payout method before continuing." };
  }

  return { isValid: true, error: null };
}