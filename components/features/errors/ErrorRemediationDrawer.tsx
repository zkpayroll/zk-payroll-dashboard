"use client";

import { AlertTriangle, BookOpen, ExternalLink, Shield, Users, X } from "lucide-react";
import { useErrorRemediationDrawer } from "@/stores/errors";
import { Button } from "@/components/ui/button";
import type { ErrorCategory, ErrorAudience } from "@/types/errors";

const CATEGORY_COLORS: Record<ErrorCategory, { bg: string; text: string; border: string }> = {
  treasury: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  authorization: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  proof: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  conflict: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  network: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  unknown: { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" },
};

const AUDIENCE_ICONS: Record<ErrorAudience, { icon: typeof Users; label: string }> = {
  contributor: { icon: Users, label: "Contributor" },
  maintainer: { icon: Shield, label: "Maintainer" },
  admin: { icon: Shield, label: "Admin" },
  auditor: { icon: BookOpen, label: "Auditor" },
};

export function ErrorRemediationDrawer() {
  const { isOpen, remediation, closeRemediation } = useErrorRemediationDrawer();

  if (!isOpen || !remediation) return null;

  const categoryStyle = CATEGORY_COLORS[remediation.category] ?? CATEGORY_COLORS.unknown;
  const actionsByAudience = remediation.actions.reduce<Record<ErrorAudience, typeof remediation.actions>>((acc, action) => {
    acc[action.audience] = [...(acc[action.audience] ?? []), action];
    return acc;
  }, {} as Record<ErrorAudience, typeof remediation.actions>);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={closeRemediation}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="error-remediation-drawer-title"
        className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-lg z-50 overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-gray-700" aria-hidden="true" />
            <h2 id="error-remediation-drawer-title" className="text-lg font-semibold text-gray-900">
              Error Help
            </h2>
          </div>
          <button
            onClick={closeRemediation}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close error remediation drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-mono border ${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border}`}
              >
                {remediation.category}
              </span>
              <span className="text-xs text-gray-400 font-mono">{remediation.id}</span>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">{remediation.title}</h3>
            <p className="text-sm text-gray-600">{remediation.summary}</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">Likely cause</h4>
            <p className="text-sm text-gray-600">{remediation.likelyCause}</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Next actions</h4>
            <div className="space-y-4">
              {(Object.keys(actionsByAudience) as ErrorAudience[]).map((audience) => {
                const Icon = AUDIENCE_ICONS[audience].icon;
                const actions = actionsByAudience[audience];
                if (!actions || actions.length === 0) return null;

                return (
                  <div key={audience} className="rounded-md border border-gray-200 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4 text-gray-500" aria-hidden="true" />
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        {AUDIENCE_ICONS[audience].label}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {actions.map((action, idx) => (
                        <li key={idx} className="text-sm text-gray-600">
                          <span className="font-medium text-gray-900">{action.label}:</span>{" "}
                          {action.href ? (
                            <a
                              href={action.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-800 underline inline-flex items-center gap-1"
                            >
                              {action.description}
                              <ExternalLink className="w-3 h-3" aria-hidden="true" />
                            </a>
                          ) : (
                            <span>{action.description}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          {remediation.docsHref && (
            <div className="pt-4 border-t border-gray-100">
              <a
                href={remediation.docsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800"
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                View documentation
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            </div>
          )}

          {remediation.category === "unknown" && (
            <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">
              No sensitive transaction data is shown. If this error persists, capture the run ID and escalate to a maintainer.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
