import { describe, it, expect, beforeEach } from "vitest";
import { useTimezonePreferenceStore } from "@/stores/timezonePreference";
import type { TimezoneDisplayMode } from "@/lib/payroll/timezoneDisplay";

const DEFAULTS = { mode: "utc" as const, organizationTimeZone: "UTC", validationError: null };

describe("useTimezonePreferenceStore", () => {
  beforeEach(() => {
    useTimezonePreferenceStore.setState(DEFAULTS);
  });

  it("defaults to UTC display so existing behavior is unchanged", () => {
    const state = useTimezonePreferenceStore.getState();
    expect(state.mode).toBe("utc");
    expect(state.organizationTimeZone).toBe("UTC");
  });

  it("switches to organization mode when the organization zone is valid", () => {
    const store = useTimezonePreferenceStore.getState();
    expect(store.setOrganizationTimeZone("Europe/Berlin")).toBe(true);
    expect(useTimezonePreferenceStore.getState().setDisplayMode("organization")).toBe(true);

    const state = useTimezonePreferenceStore.getState();
    expect(state.mode).toBe("organization");
    expect(state.organizationTimeZone).toBe("Europe/Berlin");
    expect(state.validationError).toBeNull();
  });

  it("rejects an invalid display mode and keeps the previous one (failure path)", () => {
    const result = useTimezonePreferenceStore
      .getState()
      .setDisplayMode("martian" as TimezoneDisplayMode);

    expect(result).toBe(false);
    expect(useTimezonePreferenceStore.getState().mode).toBe("utc");
    expect(useTimezonePreferenceStore.getState().validationError).toMatch(/valid display mode/i);
  });

  it("rejects an invalid organization timezone and keeps the previous zone (failure path)", () => {
    const result = useTimezonePreferenceStore.getState().setOrganizationTimeZone("Not/AZone");

    expect(result).toBe(false);
    expect(useTimezonePreferenceStore.getState().organizationTimeZone).toBe("UTC");
    expect(useTimezonePreferenceStore.getState().validationError).toMatch(/not a valid IANA timezone/i);
  });

  it("restores defaults on reset", () => {
    useTimezonePreferenceStore.getState().setOrganizationTimeZone("Asia/Tokyo");
    useTimezonePreferenceStore.getState().setDisplayMode("organization");

    useTimezonePreferenceStore.getState().reset();

    const state = useTimezonePreferenceStore.getState();
    expect(state.mode).toBe("utc");
    expect(state.organizationTimeZone).toBe("UTC");
    expect(state.validationError).toBeNull();
  });
});
