"use client";

import { useState } from "react";
import { ROLE_LABELS } from "@/lib/auth/roles";
import {
  USER_ROLES,
  classifyRoleChange,
  describeEmployerRoleChange,
} from "@/lib/company/employerRoleChange";
import type { UserRole } from "@/types";
import EmployerRoleChangeNotice from "./EmployerRoleChangeNotice";

const KIND_LABELS = {
  unchanged: "No change",
  promotion: "Promotion",
  demotion: "Demotion",
  lateral: "Lateral move",
} as const;

/**
 * Interactive reference for employer role change behavior (issue #896).
 * Lets admins preview the notice a teammate sees after a role change and
 * shows the full transition matrix. Uses role tables only — no member data.
 */
export default function EmployerRoleChangePreview() {
  const [previousRole, setPreviousRole] = useState<UserRole>("admin");
  const [nextRole, setNextRole] = useState<UserRole>("operator");
  const [currentPath, setCurrentPath] = useState("/treasury");

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Preview a role change</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-gray-700">
            Previous role
            <select
              aria-label="Previous role"
              value={previousRole}
              onChange={(e) => setPreviousRole(e.target.value as UserRole)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            New role
            <select
              aria-label="New role"
              value={nextRole}
              onChange={(e) => setNextRole(e.target.value as UserRole)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Current page
            <input
              aria-label="Current page"
              value={currentPath}
              onChange={(e) => setCurrentPath(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-mono"
            />
          </label>
        </div>

        {previousRole === nextRole ? (
          <p className="text-sm text-gray-500" data-testid="employer-role-change-unchanged">
            No notice is shown when the role does not change.
          </p>
        ) : (
          <EmployerRoleChangeNotice
            previousRole={previousRole}
            nextRole={nextRole}
            currentPath={currentPath}
          />
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Transition matrix</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm" data-testid="employer-role-change-matrix">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-2 pr-4">From</th>
                <th className="py-2 pr-4">To</th>
                <th className="py-2 pr-4">Change</th>
                <th className="py-2 pr-4">Areas gained</th>
                <th className="py-2">Areas lost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {USER_ROLES.flatMap((from) =>
                USER_ROLES.filter((to) => to !== from).map((to) => {
                  const result = describeEmployerRoleChange(from, to);
                  if (!result.ok) return null;
                  const { impact } = result;
                  return (
                    <tr key={`${from}-${to}`} data-testid={`role-transition-${from}-${to}`}>
                      <td className="py-2 pr-4">{ROLE_LABELS[from]}</td>
                      <td className="py-2 pr-4">{ROLE_LABELS[to]}</td>
                      <td className="py-2 pr-4">{KIND_LABELS[classifyRoleChange(from, to)]}</td>
                      <td className="py-2 pr-4 text-gray-600">
                        {impact.gainedNavigation.join(", ") || "None"}
                      </td>
                      <td className="py-2 text-gray-600">
                        {impact.lostNavigation.join(", ") || "None"}
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
