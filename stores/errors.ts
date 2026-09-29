import { create } from "zustand";
import type { ErrorRemediation, ErrorRemediationDrawerState } from "@/types/errors";

export const useErrorRemediationDrawer = create<ErrorRemediationDrawerState>((set) => ({
  isOpen: false,
  remediation: null,
  openRemediation: (remediation) => set({ isOpen: true, remediation }),
  closeRemediation: () => set({ isOpen: false, remediation: null }),
}));
