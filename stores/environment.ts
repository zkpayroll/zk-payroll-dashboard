import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StellarNetwork } from "@/types/stellar";

export type EnvironmentProfileType = "testnet" | "mainnet" | "localnet" | "custom";

export interface EnvironmentProfile {
  type: EnvironmentProfileType;
  label: string;
  horizonUrl: string;
  sorobanRpcUrl: string;
  networkPassphrase: string;
  stellarNetwork: StellarNetwork;
  isCustom: boolean;
}

export interface CustomProfileData {
  horizonUrl: string;
  sorobanRpcUrl: string;
  networkPassphrase: string;
  stellarNetwork: StellarNetwork;
}

const BUILTIN_PROFILES: Record<Exclude<EnvironmentProfileType, "custom">, EnvironmentProfile> = {
  testnet: {
    type: "testnet",
    label: "Testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanRpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    stellarNetwork: "TESTNET",
    isCustom: false,
  },
  mainnet: {
    type: "mainnet",
    label: "Mainnet",
    horizonUrl: "https://horizon.stellar.org",
    sorobanRpcUrl: "https://soroban-rpc.stellar.org",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    stellarNetwork: "PUBLIC",
    isCustom: false,
  },
  localnet: {
    type: "localnet",
    label: "Localnet",
    horizonUrl: "http://localhost:8000",
    sorobanRpcUrl: "http://localhost:8000/soroban/rpc",
    networkPassphrase: "Standalone Network ; February 2017",
    stellarNetwork: "TESTNET",
    isCustom: false,
  },
};

const DEFAULT_PROFILE_TYPE: EnvironmentProfileType = "testnet";

function getInitialCustomProfile(): CustomProfileData | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("zk-payroll-custom-environment");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

function getInitialActiveProfile(): EnvironmentProfileType {
  if (typeof window === "undefined") return DEFAULT_PROFILE_TYPE;
  const stored = localStorage.getItem("zk-payroll-active-environment");
  if (stored && (stored === "testnet" || stored === "mainnet" || stored === "localnet" || stored === "custom")) {
    return stored as EnvironmentProfileType;
  }
  return DEFAULT_PROFILE_TYPE;
}

interface EnvironmentState {
  activeProfile: EnvironmentProfileType;
  customProfile: CustomProfileData | null;
  validationError: string | null;
  isConnecting: boolean;
  connectionStatus: "connected" | "disconnected" | "checking" | "unknown";

  setActiveProfile: (profile: EnvironmentProfileType) => void;
  setCustomProfile: (data: CustomProfileData | null) => void;
  setValidationError: (error: string | null) => void;
  setIsConnecting: (connecting: boolean) => void;
  setConnectionStatus: (status: "connected" | "disconnected" | "checking" | "unknown") => void;
  getActiveProfileConfig: () => EnvironmentProfile;
  validateCustomProfile: (data: CustomProfileData) => string | null;
  switchToProfile: (profile: EnvironmentProfileType, customData?: CustomProfileData) => Promise<boolean>;
  reset: () => void;
}

const initialState = {
  activeProfile: getInitialActiveProfile(),
  customProfile: getInitialCustomProfile(),
  validationError: null,
  isConnecting: false,
  connectionStatus: "unknown" as const,
};

export const useEnvironmentStore = create<EnvironmentState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setActiveProfile: (profile) => {
        set({ activeProfile: profile, validationError: null });
        if (typeof window !== "undefined") {
          localStorage.setItem("zk-payroll-active-environment", profile);
        }
      },

      setCustomProfile: (data) => {
        set({ customProfile: data });
        if (typeof window !== "undefined") {
          if (data) {
            localStorage.setItem("zk-payroll-custom-environment", JSON.stringify(data));
          } else {
            localStorage.removeItem("zk-payroll-custom-environment");
          }
        }
      },

      setValidationError: (error) => set({ validationError: error }),

      setIsConnecting: (connecting) => set({ isConnecting: connecting }),

      setConnectionStatus: (status) => set({ connectionStatus: status }),

      getActiveProfileConfig: () => {
        const { activeProfile, customProfile } = get();
        if (activeProfile === "custom" && customProfile) {
          return {
            type: "custom",
            label: "Custom",
            horizonUrl: customProfile.horizonUrl,
            sorobanRpcUrl: customProfile.sorobanRpcUrl,
            networkPassphrase: customProfile.networkPassphrase,
            stellarNetwork: customProfile.stellarNetwork,
            isCustom: true,
          };
        }
        return BUILTIN_PROFILES[activeProfile as Exclude<EnvironmentProfileType, "custom">];
      },

      validateCustomProfile: (data) => {
        try {
          new URL(data.horizonUrl);
        } catch {
          return "Horizon URL must be a valid URL (e.g., https://horizon.example.com)";
        }
        try {
          new URL(data.sorobanRpcUrl);
        } catch {
          return "Soroban RPC URL must be a valid URL (e.g., https://rpc.example.com)";
        }
        if (!data.horizonUrl.startsWith("https://") && !data.horizonUrl.startsWith("http://localhost")) {
          return "Horizon URL must use HTTPS (or http://localhost for local development)";
        }
        if (!data.sorobanRpcUrl.startsWith("https://") && !data.sorobanRpcUrl.startsWith("http://localhost")) {
          return "Soroban RPC URL must use HTTPS (or http://localhost for local development)";
        }
        if (!data.networkPassphrase || data.networkPassphrase.trim().length === 0) {
          return "Network passphrase is required";
        }
        if (!["TESTNET", "PUBLIC", "FUTURENET"].includes(data.stellarNetwork)) {
          return "Stellar network must be TESTNET, PUBLIC, or FUTURENET";
        }
        return null;
      },

      switchToProfile: async (profile, customData) => {
        const { validateCustomProfile, setCustomProfile, setActiveProfile, setValidationError, setIsConnecting, setConnectionStatus } = get();

        if (profile === "custom") {
          if (!customData) {
            setValidationError("Custom profile data is required");
            return false;
          }
          const validationError = validateCustomProfile(customData);
          if (validationError) {
            setValidationError(validationError);
            return false;
          }
          setCustomProfile(customData);
        }

        setIsConnecting(true);
        setConnectionStatus("checking");

        try {
          const config = profile === "custom" && customData
            ? { ...BUILTIN_PROFILES.testnet, ...customData, type: "custom" as const, label: "Custom", isCustom: true }
            : BUILTIN_PROFILES[profile as Exclude<EnvironmentProfileType, "custom">];

          const response = await fetch(`${config.sorobanRpcUrl}/health`, {
            method: "GET",
            signal: AbortSignal.timeout(5000),
          }).catch(() => null);

          if (response?.ok) {
            setConnectionStatus("connected");
          } else {
            setConnectionStatus("disconnected");
          }
        } catch {
          setConnectionStatus("disconnected");
        }

        setActiveProfile(profile);
        setIsConnecting(false);
        setValidationError(null);
        return true;
      },

      reset: () => {
        set(initialState);
        if (typeof window !== "undefined") {
          localStorage.removeItem("zk-payroll-active-environment");
          localStorage.removeItem("zk-payroll-custom-environment");
        }
      },
    }),
    {
      name: "zk-payroll-environment",
      partialize: (state) => ({
        activeProfile: state.activeProfile,
        customProfile: state.customProfile,
      }),
    }
  )
);

export function useExpectedNetwork(): StellarNetwork {
  return useEnvironmentStore((state) => state.getActiveProfileConfig().stellarNetwork);
}

export { BUILTIN_PROFILES };