export interface AssetAllowlistEntry {
  id: string;
  code: string;
  issuer?: string;
  label: string;
  enabled: boolean;
}

export async function getAssetAllowlist(): Promise<AssetAllowlistEntry[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          id: "usdc-stellar",
          code: "USDC",
          issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          label: "USD Coin",
          enabled: true,
        },
        {
          id: "xlm-native",
          code: "XLM",
          label: "Lumen (Native)",
          enabled: true,
        },
      ]);
    }, 800);
  });
}
