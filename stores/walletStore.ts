import { create } from "zustand";
import { persist } from "zustand/middleware";

export type StellarNetwork = "TESTNET" | "PUBLIC" | "FUTURENET";

export interface WalletState {
  publicKey: string | null;
  isConnected: boolean;
  network: StellarNetwork;
  networkPassphrase: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setPublicKey: (key: string | null) => void;
  setConnected: (connected: boolean) => void;
  setNetwork: (network: StellarNetwork, passphrase: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const NETWORK_PASSPHRASES: Record<StellarNetwork, string> = {
  TESTNET: "Test SDF Network ; September 2015",
  PUBLIC: "Public Global Stellar Network ; September 2015",
  FUTURENET: "Test SDF Future Network ; October 2022",
};

const initialState = {
  publicKey: null,
  isConnected: false,
  network: "TESTNET" as StellarNetwork,
  networkPassphrase: NETWORK_PASSPHRASES["TESTNET"],
  isLoading: false,
  error: null,
};

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      ...initialState,

      setPublicKey: (key) => set({ publicKey: key }),
      setConnected: (connected) => set({ isConnected: connected }),
      setNetwork: (network, passphrase) =>
        set({ network, networkPassphrase: passphrase }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      reset: () => set(initialState),
    }),
    {
      name: "stellar-wallet-storage",
      partialize: (state) => ({
        publicKey: state.publicKey,
        isConnected: state.isConnected,
        network: state.network,
        networkPassphrase: state.networkPassphrase,
      }),
    },
  ),
);

export { NETWORK_PASSPHRASES };
