"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, ChevronDown, ShieldAlert } from "lucide-react";
import { MOCK_COMPANIES } from "@/lib/api/mockData";
import { useCompanyStore } from "@/stores/company";
import { useWalletStore } from "@/stores/walletStore";
import type { Company, UserRole } from "@/types";

function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "operator" || value === "auditor";
}

/**
 * Lets an admin switch the dashboard's active company context, guarded by
 * `evaluateCompanySwitch` (#223) so a switch into an inactive, misconfigured,
 * or unauthorized company is blocked with a clear reason instead of silently
 * changing context.
 */
export default function CompanySwitcher({
  companies = MOCK_COMPANIES,
}: {
  companies?: Company[];
}) {
  const activeCompany = useCompanyStore((s) => s.company);
  const switchCompany = useCompanyStore((s) => s.switchCompany);
  const publicKey = useWalletStore((s) => s.publicKey);

  const [role, setRole] = useState<UserRole | null>(null);
  const [roleStatus, setRoleStatus] = useState<
    "loading" | "ready" | "unavailable" | "error"
  >("loading");
  const [roleCheckAttempt, setRoleCheckAttempt] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRoleStatus("loading");
    setRole(null);
    setBlockedMessage(null);

    fetch("/api/auth/session", { method: "GET", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setRoleStatus("unavailable");
          return;
        }

        const data: unknown = await res.json();
        const sessionRole =
          typeof data === "object" && data !== null && "role" in data ? data.role : null;

        if (!cancelled) {
          if (isUserRole(sessionRole)) {
            setRole(sessionRole);
            setRoleStatus("ready");
          } else {
            setRoleStatus("unavailable");
          }
        }
      })
      .catch(() => {
        if (!cancelled) setRoleStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [roleCheckAttempt]);

  function handleSelect(target: Company) {
    if (!role) {
      setBlockedMessage("Verify your employer access before switching companies.");
      return;
    }
    const result = switchCompany(target, role, publicKey);
    if (!result.allowed) {
      setBlockedMessage(result.message);
      return;
    }
    setBlockedMessage(null);
    setIsOpen(false);
  }

  const currentId = activeCompany?.id ?? companies[0]?.id;

  return (
    <div className="relative inline-block text-left" data-testid="company-switcher">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <Building2 className="h-4 w-4 text-gray-500" aria-hidden="true" />
        {activeCompany?.name ?? "Select company"}
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          aria-label="Companies"
          className="absolute z-10 mt-1 w-72 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {companies.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={c.id === currentId}
                disabled={roleStatus !== "ready"}
                onClick={() => handleSelect(c)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="flex flex-col">
                  <span className="font-medium text-gray-900">{c.name}</span>
                  {!c.isActive && <span className="text-xs text-red-600">Inactive</span>}
                </span>
                {c.id === currentId && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {roleStatus === "unavailable" && (
        <div
          role="alert"
          className="mt-2 flex w-72 flex-col items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          <span>
            Your session could not be verified. Sign in again to refresh your employer access.
          </span>
          <a className="font-medium underline" href="/login?redirect=%2Fcompany%2Fswitch">
            Sign in again
          </a>
        </div>
      )}

      {roleStatus === "error" && (
        <div
          role="alert"
          className="mt-2 flex w-72 flex-col items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          <span>
            Could not verify your employer access. Retry the check before switching companies.
          </span>
          <button
            type="button"
            className="font-medium underline"
            onClick={() => setRoleCheckAttempt((attempt) => attempt + 1)}
          >
            Retry access check
          </button>
        </div>
      )}

      {roleStatus === "ready" && role !== "admin" && (
        <div
          role="alert"
          className="mt-2 flex w-72 flex-col items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          <span>
            Your current role cannot switch companies. If your employer recently changed your
            access, sign in again to refresh permissions.
          </span>
          <a className="font-medium underline" href="/login?redirect=%2Fcompany%2Fswitch">
            Sign in again
          </a>
        </div>
      )}

      {blockedMessage && (
        <div
          role="alert"
          className="absolute z-10 mt-1 flex w-72 items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{blockedMessage}</span>
        </div>
      )}
    </div>
  );
}
