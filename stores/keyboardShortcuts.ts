import { create } from "zustand";
import { persist } from "zustand/middleware";

interface KeyboardShortcutsState {
  isModalOpen: boolean;
  /**
   * User preference to enable/disable single-key sequences.
   * Required by WCAG 2.1.4 to allow users of speech-to-text or screen
   * readers to disable character key shortcuts.
   */
  enabled: boolean;
  pendingSequence: string | null;
  lastShortcutTriggered: string | null;

  openModal: () => void;
  closeModal: () => void;
  toggleModal: () => void;
  setEnabled: (enabled: boolean) => void;
  setPendingSequence: (seq: string | null) => void;
  setLastShortcutTriggered: (name: string | null) => void;
}

export const useKeyboardShortcutsStore = create<KeyboardShortcutsState>()(
  persist(
    (set) => ({
      isModalOpen: false,
      enabled: true,
      pendingSequence: null,
      lastShortcutTriggered: null,

      openModal: () => set({ isModalOpen: true, pendingSequence: null }),
      closeModal: () => set({ isModalOpen: false }),
      toggleModal: () => set((state) => ({ isModalOpen: !state.isModalOpen })),
      setEnabled: (enabled: boolean) => set({ enabled }),
      setPendingSequence: (seq: string | null) => set({ pendingSequence: seq }),
      setLastShortcutTriggered: (name: string | null) => set({ lastShortcutTriggered: name }),
    }),
    {
      name: "zk-payroll-keyboard-shortcuts",
      partialize: (state) => ({ enabled: state.enabled }),
    }
  )
);
