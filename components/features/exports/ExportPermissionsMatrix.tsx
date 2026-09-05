"use client";

import { Check, Lock } from "lucide-react";
import { EXPORT_PERMISSIONS, ROLE_LABELS, canExport, getExportRestrictionReason } from "@/lib/auth/roles";
import type { UserRole } from "@/types";

const ALL_ROLES: UserRole[] = ["admin", "operator", "auditor"];

const EXPORT_TYPE_LABELS: Record<string, string> = {
  "payroll-history": "Payroll history CSV",
  "employee-directory": "Redacted employee directory",
  "audit-requests": "Audit access requests",
  "audit-report": "Cryptographic audit report",
  "treasury-snapshot": "Treasury funding snapshot",
};

/**
 * Read-only matrix of which export types each dashboard role/access scope
 * may use (#224). Sourced directly from `EXPORT_PERMISSIONS` so it can never
 * drift from the permissions actually enforced by `canExport` in ExportCenter.
 */
export default function ExportPermissionsMatrix() {
  const exportKeys = Object.keys(EXPORT_PERMISSIONS);

  return (
    <section
      aria-labelledby="export-permissions-matrix-heading"
      className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
      data-testid="export-permissions-matrix"
    >
      <h2 id="export-permissions-matrix-heading" className="text-base font-semibold text-gray-900">
        Export permissions matrix
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Which export types each role is allowed to access, and why access is restricted when it
        is not.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr>
              <th scope="col" className="py-2 pr-4 text-left font-medium text-gray-500">
                Export type
              </th>
              {ALL_ROLES.map((role) => (
                <th key={role} scope="col" className="px-3 py-2 text-left font-medium text-gray-500">
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {exportKeys.map((permissionKey) => (
              <tr key={permissionKey}>
                <th scope="row" className="py-3 pr-4 text-left font-medium text-gray-900">
                  {EXPORT_TYPE_LABELS[permissionKey] ?? permissionKey}
                </th>
                {ALL_ROLES.map((role) => {
                  const allowed = canExport(role, permissionKey);
                  const reason = getExportRestrictionReason(role, permissionKey);
                  return (
                    <td key={role} className="px-3 py-3 align-top">
                      {allowed ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"
                          data-testid={`export-permission-${permissionKey}-${role}`}
                        >
                          <Check className="h-3 w-3" aria-hidden="true" />
                          Allowed
                        </span>
                      ) : (
                        <span
                          className="inline-flex flex-col gap-1"
                          data-testid={`export-permission-${permissionKey}-${role}`}
                        >
                          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            <Lock className="h-3 w-3" aria-hidden="true" />
                            Restricted
                          </span>
                          {reason && <span className="text-xs text-gray-500">{reason}</span>}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
