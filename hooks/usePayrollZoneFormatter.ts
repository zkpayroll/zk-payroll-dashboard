"use client";

import { useCallback, useMemo } from "react";
import { useTimezonePreferenceStore } from "@/stores/timezonePreference";
import {
  formatInDisplayZone,
  getTimeZoneAbbreviation,
  resolveDisplayTimeZone,
  type ZoneAwareFormatOptions,
} from "@/lib/payroll/timezoneDisplay";

/**
 * Binds the admin timezone display preference to schedule time formatting.
 * Reads only preference state — never payroll amounts or worker identities.
 */
export function usePayrollZoneFormatter() {
  const mode = useTimezonePreferenceStore((s) => s.mode);
  const organizationTimeZone = useTimezonePreferenceStore((s) => s.organizationTimeZone);

  const preference = useMemo(() => ({ mode, organizationTimeZone }), [mode, organizationTimeZone]);
  const timeZone = useMemo(() => resolveDisplayTimeZone(preference), [preference]);

  const formatZoneAware = useCallback(
    (value: Date | string, options?: ZoneAwareFormatOptions) =>
      formatInDisplayZone(value, timeZone, options),
    [timeZone],
  );

  const abbreviation = useCallback(
    (reference: Date = new Date()) => getTimeZoneAbbreviation(reference, timeZone),
    [timeZone],
  );

  return { timeZone, abbreviation, formatZoneAware };
}
