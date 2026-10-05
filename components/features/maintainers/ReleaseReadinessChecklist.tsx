"use client";

import { useReleaseReadinessStore, type ChecklistStatus } from "@/stores/releaseReadiness";

const statusColors: Record<ChecklistStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  passed: "bg-green-100 text-green-700",
  blocked: "bg-red-100 text-red-700",
};

function ReleaseReadinessChecklist() {
  const { items, setStatus, setNotes, isReady, getBlockers } =
    useReleaseReadinessStore();

  const blockers = getBlockers();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Release Readiness
        </h3>
        {isReady() ? (
          <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
            Ready for release
          </span>
        ) : (
          <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
            In progress
          </span>
        )}
      </div>

      {blockers.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm font-medium text-red-800 mb-2">
            Blockers ({blockers.length})
          </p>
          <ul className="space-y-1">
            {blockers.map((b) => (
              <li key={b.id} className="text-sm text-red-700">
                {b.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200"
          >
            <select
              value={item.status}
              onChange={(e) =>
                setStatus(item.id, e.target.value as ChecklistStatus)
              }
              className={`text-xs font-medium rounded px-2 py-1 border-0 ${statusColors[item.status]}`}
            >
              <option value="pending">Pending</option>
              <option value="passed">Passed</option>
              <option value="blocked">Blocked</option>
            </select>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-500">{item.section}</p>
            </div>
            <input
              type="text"
              placeholder="Notes"
              value={item.notes ?? ""}
              onChange={(e) => setNotes(item.id, e.target.value)}
              className="text-xs text-gray-600 bg-transparent border-b border-gray-200 focus:border-indigo-500 focus:outline-none px-2 py-1 w-32"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default ReleaseReadinessChecklist;
