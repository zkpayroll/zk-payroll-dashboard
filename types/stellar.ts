export type StellarNetwork = "TESTNET" | "PUBLIC" | "FUTURENET";

export interface FreighterWalletInfo {
  publicKey: string;
  network: StellarNetwork;
}

export interface SorobanContractCall {
  contractId: string;
  method: string;
  args: ScVal[];
}

export interface ScVal {
  type: string;
  value: unknown;
}

export interface TransactionResponse {
  hash: string;
  status: "success" | "error" | "pending";
  ledger?: number;
  resultXdr?: string;
}
