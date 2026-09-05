"use client";

import { useMemo } from "react";
import { AlertCircle, Ban, Clock, RotateCcw, ShieldOff, XCircle } from "lucide-react";
import {
  useSigningFailuresStore,
  type RecoverableSigningCategory,
  type SigningFailureRecord,
} from "@/stores/signingFailures";
import { useHelpDrawer, HELP_CONTENT } from "@/stores/helpDrawer";

interface CategoryMeta {
  label: string;
  description: string;
  steps: string[];
  Icon: typeof AlertCircle;
}

const CATEGORY_META: Record<RecoverableSigningCategory, CategoryMeta> = {
  rejected: {
    label: "Transaction rejected",
    description: "The signing request was declined or cancelled in Freighter.",
    steps: [
      "Verify the amount, recipient, and memo on the dashboard",
      "Click Retry to re-send the request",
      "In Freighter, click Approve and keep the popup open",
    ],
    Icon: Ban,
  },
  "expired-session": {
    label: "Session expired",
    description: "Freighter is locked or the dashboard access grant has expired.",
    steps: [
      "Open Freighter and unlock it with your password",
      "Re-connect from the header Connect Wallet button",
      "Confirm the account and network still match expectations",
      "Retry the original action",
    ],
    Icon: Clock,
  },
  "malformed-transaction": {
    label: "Invalid transaction data",
    description: "The transaction envelope could not be decoded by Freighter.",
    steps: [
      "Do not retry blindly — the same envelope will fail again",
      "Hard-refresh the dashboard (Cmd/Ctrl + Shift + R)",
      "Try the action again in a private/incognito window",
      "Escalate with the captured error and run ID if it persists",
    ],
    Icon: XCircle,
  },
  unknown: {
    label: "Unrecognized signing failure",
    description: "The signing failure did not match a known recovery pattern.",
    steps: [
      "Capture the exact error message and the action you attempted",
      "Retry the original action once",
      "Escalate to engineering if the retry fails the same way",
    ],
    Icon: ShieldOff,
  },
};

const CATEGORY_ORDER: RecoverableSigningCategory[] = [
  "rejected",
  "expired-session",
  "malformed-transaction",
  "unknown",
];

function groupByCategory(
  failures: SigningFailureRecord[],
): Array<{ category: RecoverableSigningCategory; failures: SigningFailureRecord[] }> {
  const map = new Map<RecoverableSigningCategory, SigningFailureRecord[]>();
  for (const failure of failures) {
    if (!map.has(failure.category)) map.set(failure.category, []);
    map.get(failure.category)!.push(failure);
  }
  return CATEGORY_ORDER.filter((category) => map.has(category)).map((category) => ({
    category,
    failures: map.get(category)!,
  }));
}

export default function SigningFailureRecoveryCenter() {
  const failures = useSigningFailuresStore((s) => s.failures);
  const resolveFailure = useSigningFailuresStore((s) => s.resolveFailure);
  const dismissFailure = useSigningFailuresStore((s) => s.dismissFailure);
  const clearAll = useSigningFailuresStore((s) => s.clearAll);
  const { openHelp } = useHelpDrawer();

  const unresolved = useMemo(() => failures.filter((f) => !f.resolved), [failures]);
  const groups = useMemo(() => groupByCategory(unresolved), [unresolved]);

  const openRecoveryGuide = () => {
    const content = HELP_CONTENT["wallet-signing"];
    if (content) openHelp("wallet-signing", content);
  };

  if (unresolved.length === 0) {
    return (
      <section
        aria-labelledby="signing-recovery-heading"
        className="rounded-lg bg-white p-6 shadow-sm"
      >
        <h2 id="signing-recovery-heading" className="text-base font-semibold text-gray-900">
          Wallet signing recovery center
        </h2>
        <p className="mt-3 text-sm text-gray-500">
          No unresolved signing failures — wallet interactions are completing normally.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="signing-recovery-heading"
      className="rounded-lg bg-white p-6 shadow-sm"
      data-testid="signing-failure-recovery-center"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="signing-recovery-heading" className="text-base font-semibold text-gray-900">
          Wallet signing recovery center{" "}
          <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            {unresolved.length}
          </span>
        </h2>
        <button
          type="button"
          onClick={clearAll}
          className="text-xs font-medium text-gray-500 hover:text-gray-700"
        >
          Dismiss all
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Signing failures grouped by cause, with the safe next step for each.
      </p>

      <div className="mt-4 space-y-4">
        {groups.map(({ category, failures: categoryFailures }) => {
          const meta = CATEGORY_META[category];
          return (
            <div key={category} className="rounded-lg border border-gray-200">
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <meta.Icon className="h-4 w-4 text-red-600" aria-hidden="true" />
                  {meta.label}
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {categoryFailures.length}
                  </span>
                </span>
              </div>
              <div className="space-y-3 p-4">
                <p className="text-sm text-gray-600">{meta.description}</p>
                <ol className="list-inside list-decimal space-y-1 text-sm text-gray-700">
                  {meta.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <ul className="space-y-2" aria-label={`${meta.label} occurrences`}>
                  {categoryFailures.map((failure) => (
                    <li
                      key={failure.id}
                      className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                          <span className="truncate text-sm text-gray-900">{failure.message}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {new Date(failure.occurredAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => resolveFailure(failure.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                        >
                          <RotateCcw className="h-3 w-3" aria-hidden="true" />
                          Mark retried
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissFailure(failure.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                          Dismiss
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={openRecoveryGuide}
        className="mt-4 text-sm font-medium text-indigo-600 hover:underline"
      >
        View full recovery guide
      </button>
    </section>
  );
}
