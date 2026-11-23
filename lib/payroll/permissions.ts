/**
 * Payroll operator permission gate.
 *
 * Starting a payroll run is an operator action: the connected wallet must be
 * recognized as an authorized payroll operator before the wizard lets the
 * operator assemble and sign a batch. The check is intentionally synchronous
 * and privacy-safe — it only ever carries the operator's public key and an
 * actionable reason, never salary values, batch amounts, or employee data.
 */

/** Why an operator was denied the payroll start action. */
export type PayrollOperatorDenialReason =
  | "not_connected"
  | "not_authorized";

/** Result of the operator permission check. */
export interface PayrollOperatorPermissionResult {
  ok: boolean;
  reason: PayrollOperatorDenialReason | null;
  message: string | null;
  operator: string | null;
}

export interface PayrollOperatorPermissionOptions {
  /**
   * Operator public keys that must not create payroll runs (revoked or
   * suspended operator access). Revocation is checked even for connected
   * wallets so a revoked admin cannot keep signing from a cached session.
   */
  revokedOperators?: readonly string[];
}

/**
 * Validate that the connected wallet may create a payroll run.
 *
 * The gate is deny-by-default: with no (or an empty) operator key the run
 * cannot start, and the operator is told to connect a wallet. Keys listed in
 * `revokedOperators` are denied with an explicit authorization message so the
 * UI can surface it without leaking anything beyond the denial reason.
 */
export function validatePayrollOperatorPermission(
  operator: string | null | undefined,
  options: PayrollOperatorPermissionOptions = {},
): PayrollOperatorPermissionResult {
  const publicKey = typeof operator === "string" ? operator.trim() : "";

  if (publicKey.length === 0) {
    return {
      ok: false,
      reason: "not_connected",
      message: "Connect your wallet to create a payroll run.",
      operator: null,
    };
  }

  if (options.revokedOperators?.includes(publicKey)) {
    return {
      ok: false,
      reason: "not_authorized",
      message: "Wallet is not authorized to create payroll runs.",
      operator: publicKey,
    };
  }

  return {
    ok: true,
    reason: null,
    message: null,
    operator: publicKey,
  };
}
