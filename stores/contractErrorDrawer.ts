import { create } from "zustand";
import { getContractErrorHelp, type ContractErrorHelp } from "@/lib/errors/contractErrors";

interface ContractErrorDrawerState {
  isOpen: boolean;
  help: ContractErrorHelp | null;
  openForError: (error: unknown) => void;
  close: () => void;
}

export const useContractErrorDrawer = create<ContractErrorDrawerState>((set) => ({
  isOpen: false,
  help: null,
  openForError: (error) => set({ isOpen: true, help: getContractErrorHelp(error) }),
  close: () => set({ isOpen: false, help: null }),
}));
