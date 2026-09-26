"use client";

import { AlertTriangle, Globe2 } from "lucide-react";
import { useTimezonePreferenceStore } from "@/stores/timezonePreference";
import {
  resolveDisplayTimeZone,
  formatInDisplayZone,
  isValidIANATimeZone,
  TIMEZONE_DISPLAY_MODE_LABELS,
  TIMEZONE_DISPLAY_MODES,
  type TimezoneDisplayMode,
} from "@/lib/payroll/timezoneDisplay";

const COMMON_ORGANIZATION_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

/** Fixed sample so the preview is deterministic and never shows real payroll data. */
const SAMPLE_SCHEDULE_TIME = new Date(Date.UTC(2026, 0, 15, 14, 30));

export default function TimezoneDisplayPreference() {
  const mode = useTimezonePreferenceStore((s) => s.mode);
  const organizationTimeZone = useTimezonePreferenceStore((s) => s.organizationTimeZone);
  const validationError = useTimezonePreferenceStore((s) => s.validationError);
  const setDisplayMode = useTimezonePreferenceStore((s) => s.setDisplayMode);
  const setOrganizationTimeZone = useTimezonePreferenceStore((s) => s.setOrganizationTimeZone);

  const resolvedTimeZone = resolveDisplayTimeZone({ mode, organizationTimeZone });

  return (
    <section
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4"
      aria-labelledby="timezone-preference-heading"
      data-testid="timezone-display-preference"
    >
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
          <Globe2 className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <h2 id="timezone-preference-heading" className="text-sm font-semibold text-gray-900">
            Payroll timezone display
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Choose how payroll schedule times are shown across the dashboard. This changes display
            only — settlement windows keep running on their configured times.
          </p>
        </div>
      </div>

      <fieldset>
        <legend className="block text-xs font-medium text-gray-700 mb-2">Display times in</legend>
        <div className="flex flex-col sm:flex-row gap-2">
          {TIMEZONE_DISPLAY_MODES.map((option) => (
            <label
              key={option}
              className={`flex-1 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                mode === option
                  ? "border-indigo-500 bg-indigo-50 text-indigo-800 font-medium"
                  : "border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="timezone-display-mode"
                value={option}
                checked={mode === option}
                onChange={() => setDisplayMode(option as TimezoneDisplayMode)}
                className="accent-indigo-600"
              />
              {TIMEZONE_DISPLAY_MODE_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="organization-timezone" className="block text-xs font-medium text-gray-700 mb-1">
          Organization timezone
        </label>
        <select
          id="organization-timezone"
          value={COMMON_ORGANIZATION_ZONES.includes(organizationTimeZone) ? organizationTimeZone : ""}
          onChange={(e) => setOrganizationTimeZone(e.target.value)}
          className="w-full sm:w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="" disabled>
            Select a timezone…
          </option>
          {COMMON_ORGANIZATION_ZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-gray-500 mt-1">
          Used when times are displayed in organization time. Stored on this device.
        </p>
      </div>

      {validationError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {validationError}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <span className="font-medium text-gray-800">Preview:</span>{" "}
        <span data-testid="timezone-preview">
          {formatInDisplayZone(SAMPLE_SCHEDULE_TIME, resolvedTimeZone)}
        </span>
        {mode === "organization" && !isValidIANATimeZone(organizationTimeZone) && (
          <span className="text-amber-700"> — falling back to UTC until an organization timezone is set.</span>
        )}
      </div>
    </section>
  );
}
