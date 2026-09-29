import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  isTimezoneDisplayMode,
  isValidIANATimeZone,
  type TimezoneDisplayMode,
} from "@/lib/payroll/timezoneDisplay";

export interface TimezonePreferenceState {
  mode: TimezoneDisplayMode;
  organizationTimeZone: string;
  validationError: string | null;

  setDisplayMode: (mode: TimezoneDisplayMode) => boolean;
  setOrganizationTimeZone: (timeZone: string) => boolean;
  reset: () => void;
}

const initialState = {
  // UTC matches the historically hardcoded schedule display, so enabling this
  // preference changes nothing until an admin opts in.
  mode: "utc" as TimezoneDisplayMode,
  organizationTimeZone: "UTC",
  validationError: null as string | null,
};

export const useTimezonePreferenceStore = create<TimezonePreferenceState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setDisplayMode: (mode) => {
        if (!isTimezoneDisplayMode(mode)) {
          set({ validationError: "Choose a valid display mode: local, organization, or UTC." });
          return false;
        }
        if (mode === "organization" && !isValidIANATimeZone(get().organizationTimeZone)) {
          set({ validationError: "Set an organization timezone before switching to organization time." });
          return false;
        }
        set({ mode, validationError: null });
        return true;
      },

      setOrganizationTimeZone: (timeZone) => {
        if (!isValidIANATimeZone(timeZone)) {
          set({ validationError: `"${timeZone}" is not a valid IANA timezone (e.g., "Europe/London").` });
          return false;
        }
        set({ organizationTimeZone: timeZone, validationError: null });
        return true;
      },

      reset: () => set(initialState),
    }),
    {
      name: "zk-payroll-timezone-display",
      partialize: (state) => ({
        mode: state.mode,
        organizationTimeZone: state.organizationTimeZone,
      }),
    }
  )
);
