export type TimezoneDisplayMode = "local" | "organization" | "utc";

export const TIMEZONE_DISPLAY_MODES: TimezoneDisplayMode[] = ["local", "organization", "utc"];

export const TIMEZONE_DISPLAY_MODE_LABELS: Record<TimezoneDisplayMode, string> = {
  local: "My local time",
  organization: "Organization time",
  utc: "UTC",
};

const UTC_TIME_ZONE = "UTC";

export function isValidIANATimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || UTC_TIME_ZONE;
}

export function isTimezoneDisplayMode(value: unknown): value is TimezoneDisplayMode {
  return typeof value === "string" && (TIMEZONE_DISPLAY_MODES as string[]).includes(value);
}

export interface TimezoneDisplayPreferenceValue {
  mode: TimezoneDisplayMode;
  organizationTimeZone: string;
}

/**
 * Resolves the IANA zone to render times in. An unset or invalid organization
 * zone falls back to UTC so schedule times never render in a stale zone after
 * bad persisted data.
 */
export function resolveDisplayTimeZone(preference: TimezoneDisplayPreferenceValue): string {
  switch (preference.mode) {
    case "local":
      return getLocalTimeZone();
    case "organization":
      return isValidIANATimeZone(preference.organizationTimeZone)
        ? preference.organizationTimeZone
        : UTC_TIME_ZONE;
    case "utc":
      return UTC_TIME_ZONE;
  }
}

/** Short zone label for the resolved display, e.g. "UTC", "EST", "GMT+2". */
export function getTimeZoneAbbreviation(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(date);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}

export interface ZoneAwareFormatOptions {
  includeTime?: boolean;
  includeWeekday?: boolean;
}

/**
 * Formats a date for display in the admin-selected timezone, always labeling
 * the zone so distributed teams can tell "9:00 AM" from "9:00 AM UTC".
 */
export function formatInDisplayZone(
  value: Date | string,
  timeZone: string,
  options: ZoneAwareFormatOptions = {},
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  const formatted = date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(options.includeWeekday ? { weekday: "short" } : {}),
    ...(options.includeTime !== false
      ? { hour: "numeric", minute: "2-digit", hour12: true }
      : {}),
    timeZone,
    timeZoneName: "short",
  });

  return formatted;
}
