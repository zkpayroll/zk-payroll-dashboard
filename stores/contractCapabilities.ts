import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CapabilityStatus = "supported" | "unsupported" | "unknown" | "deprecated";
export type MismatchSeverity = "info" | "warning" | "critical";

export interface ContractCapability {
  id: string;
  name: string;
  description: string;
  requiredVersion: string;
  currentVersion: string | null;
  status: CapabilityStatus;
  mismatchSeverity: MismatchSeverity | null;
  lastChecked: string;
}

export interface CapabilityMismatchWarning {
  id: string;
  capabilityId: string;
  capabilityName: string;
  severity: MismatchSeverity;
  message: string;
  details: string;
  createdAt: string;
  dismissed: boolean;
  actionLabel?: string;
  actionUrl?: string;
}

interface ContractCapabilitiesStore {
  capabilities: ContractCapability[];
  warnings: CapabilityMismatchWarning[];
  lastScanAt: string | null;
  scanning: boolean;
  contractAddress: string | null;

  setCapabilities: (capabilities: ContractCapability[]) => void;
  updateCapability: (id: string, updates: Partial<ContractCapability>) => void;
  scanContract: (address: string) => void;
  setScanning: (scanning: boolean) => void;
  dismissWarning: (warningId: string) => void;
  dismissAllWarnings: () => void;
  clearWarnings: () => void;
  getActiveWarnings: () => CapabilityMismatchWarning[];
  getUnsupportedCapabilities: () => ContractCapability[];
  getCriticalWarnings: () => CapabilityMismatchWarning[];
  hasBlockingMismatch: () => boolean;
  reset: () => void;
}

const initialState = {
  capabilities: [] as ContractCapability[],
  warnings: [] as CapabilityMismatchWarning[],
  lastScanAt: null as string | null,
  scanning: false,
  contractAddress: null as string | null,
};

export const useContractCapabilitiesStore = create<ContractCapabilitiesStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      setCapabilities: (capabilities) => {
        const warnings: CapabilityMismatchWarning[] = [];
        const now = new Date().toISOString();

        for (const cap of capabilities) {
          if (cap.status === "unsupported") {
            warnings.push({
              id: `warn_${cap.id}_${Date.now()}`,
              capabilityId: cap.id,
              capabilityName: cap.name,
              severity: "critical",
              message: `${cap.name} is not supported by the deployed contract`,
              details: `Required: ${cap.requiredVersion}, Current: ${cap.currentVersion ?? "unknown"}. This capability is required for full functionality.`,
              createdAt: now,
              dismissed: false,
            });
          } else if (cap.status === "deprecated") {
            warnings.push({
              id: `warn_${cap.id}_${Date.now()}`,
              capabilityId: cap.id,
              capabilityName: cap.name,
              severity: "warning",
              message: `${cap.name} is deprecated in the current contract version`,
              details: `Required: ${cap.requiredVersion}, Current: ${cap.currentVersion ?? "unknown"}. Consider upgrading the contract.`,
              createdAt: now,
              dismissed: false,
              actionLabel: "Upgrade contract",
            });
          } else if (cap.mismatchSeverity) {
            warnings.push({
              id: `warn_${cap.id}_${Date.now()}`,
              capabilityId: cap.id,
              capabilityName: cap.name,
              severity: cap.mismatchSeverity,
              message: `Version mismatch for ${cap.name}`,
              details: `Required: ${cap.requiredVersion}, Current: ${cap.currentVersion ?? "unknown"}.`,
              createdAt: now,
              dismissed: false,
            });
          }
        }

        set({ capabilities, warnings, lastScanAt: now });
      },
      updateCapability: (id, updates) =>
        set((state) => ({
          capabilities: state.capabilities.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),
      scanContract: (address) => {
        set({ contractAddress: address, scanning: true });
      },
      setScanning: (scanning) => set({ scanning }),
      dismissWarning: (warningId) =>
        set((state) => ({
          warnings: state.warnings.map((w) =>
            w.id === warningId ? { ...w, dismissed: true } : w
          ),
        })),
      dismissAllWarnings: () =>
        set((state) => ({
          warnings: state.warnings.map((w) => ({ ...w, dismissed: true })),
        })),
      clearWarnings: () =>
        set((state) => ({
          warnings: state.warnings.filter((w) => !w.dismissed),
        })),
      getActiveWarnings: () =>
        get().warnings.filter((w) => !w.dismissed),
      getUnsupportedCapabilities: () =>
        get().capabilities.filter((c) => c.status === "unsupported"),
      getCriticalWarnings: () =>
        get().warnings.filter((w) => !w.dismissed && w.severity === "critical"),
      hasBlockingMismatch: () => {
        const caps = get().capabilities;
        return caps.some((c) => c.status === "unsupported");
      },
      reset: () => set(initialState),
    }),
    { name: "zk-payroll-contract-capabilities" }
  )
);
