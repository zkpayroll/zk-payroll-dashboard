"use client";

import { useCompanyStore } from "@/stores/company";
import { CONFIGURATION_FIELD_LABELS } from "@/lib/company/configurationRevision";

/** Read-only local metadata: deliberately excludes old/new configuration values. */
export function CompanyConfigurationRevisions() {
  const company = useCompanyStore((state) => state.company);
  const histories = useCompanyStore((state) => state.configurationRevisions);
  const revisions =
    company && Object.hasOwn(histories, company.id)
      ? histories[company.id]
      : [];
  return (
    <section
      aria-labelledby="company-revisions-heading"
      className="rounded-lg border border-gray-200 bg-white p-6 space-y-4"
    >
      <h2
        id="company-revisions-heading"
        className="text-sm font-semibold text-gray-900"
      >
        Company configuration revisions
      </h2>
      <p className="text-xs text-gray-500">
        Local dashboard history, not an on-chain audit log. Only changed field
        names are shown. The latest 50 revisions per company are retained.
      </p>
      {!company ? (
        <p className="text-sm text-gray-600">
          Select or set up a company to view its configuration revisions.
        </p>
      ) : revisions.length === 0 ? (
        <p className="text-sm text-gray-600" role="status">
          No revisions recorded yet. The next configuration save establishes a
          local baseline.
        </p>
      ) : (
        <ol
          aria-label="Configuration revisions"
          className="divide-y divide-gray-100"
        >
          {revisions.map((revision) => (
            <li key={revision.id} className="py-3 space-y-2">
              <p className="text-sm font-medium text-gray-900">
                Revision {revision.version} -{" "}
                {revision.kind === "baseline"
                  ? "First observed configuration"
                  : "Configuration updated"}
              </p>
              <time
                dateTime={revision.timestamp}
                className="text-xs text-gray-500"
              >
                {new Date(revision.timestamp).toLocaleString()}
              </time>
              <ul
                aria-label={`Changed fields in revision ${revision.version}`}
                className="list-disc pl-5 text-xs text-gray-600"
              >
                {revision.changedFields.map((field) => (
                  <li key={field}>{CONFIGURATION_FIELD_LABELS[field]}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
