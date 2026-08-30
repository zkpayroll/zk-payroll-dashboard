/**
 * Supported payroll asset configuration.
 *
 * Central allowlist of Stellar assets that the dashboard can disburse.
 * Used by treasury and payroll creation flows to decide whether
 * payroll can proceed. Empty configuration blocks payroll creation
 * and surfaces an actionable empty state.
 *
 * Privacy-safe: only asset codes/issuers are listed — no payroll
 * amounts or employee data.
 */

export const SUPPORTED_PAYROLL_ASSETS = [
  { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", label: "USDC (Stellar Classic)" },
  { code: "XLM", issuer: undefined, label: "XLM (native)" },
  { code: "EURC", issuer: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP", label: "EURC" },
] as const;

export type SupportedPayrollAsset = (typeof SUPPORTED_PAYROLL_ASSETS)[number];

export function isSupportedAssetCode(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  return SUPPORTED_PAYROLL_ASSETS.some((a) => a.code === normalized);
}

export function getSupportedAsset(code: string): SupportedPayrollAsset | undefined {
  const normalized = code.trim().toUpperCase();
  return SUPPORTED_PAYROLL_ASSETS.find((a) => a.code === normalized);
}

export function formatSupportedAssetsList(): string {
  return SUPPORTED_PAYROLL_ASSETS.map((a) => a.code).join(", ");
}

/**
 * Whether the treasury / settings currently has at least one supported
 * payroll asset configured. Accepts an explicit list so callers can
 * inject the configured assets (e.g. from API or local storage).
 * An empty array means no supported assets — payroll creation is blocked.
 */
export function hasSupportedPayrollAssets(configuredAssets: Array<{ code: string; issuer?: string }> | null | undefined): boolean {
  if (!configuredAssets || configuredAssets.length === 0) return false;
  return configuredAssets.some((ca) => isSupportedAssetCode(ca.code));
}

export function getUnsupportedAssets(configuredAssets: Array<{ code: string; issuer?: string }> | null | undefined): string[] {
  if (!configuredAssets) return [];
  return configuredAssets
    .filter((ca) => !isSupportedAssetCode(ca.code))
    .map((ca) => ca.code);
}
