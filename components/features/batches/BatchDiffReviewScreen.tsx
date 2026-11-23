"use client";

import { useState } from "react";
import DraftComparisonView from "@/components/features/drafts/DraftComparisonView";
import {
  BATCH_DIFF_FIXTURES,
  getBatchDiffFixture,
} from "@/lib/payroll/batchDiffFixtures";

/**
 * Payroll review screen: compares the current payroll draft against the
 * previously approved draft. Fixture scenarios stand in for real draft
 * snapshots until the approval pipeline persists them.
 */
export function BatchDiffReviewScreen() {
  const [fixtureKey, setFixtureKey] = useState(BATCH_DIFF_FIXTURES[0].key);
  const hasCurrentDraft = fixtureKey !== "missing-current";
  const fixture = getBatchDiffFixture(
    hasCurrentDraft ? fixtureKey : BATCH_DIFF_FIXTURES[0].key,
  );

  const request = {
    payrollRunId: "payroll-review-fixture",
    current: hasCurrentDraft
      ? {
          revisionId: `${fixture.key}-current`,
          payrollRunId: "payroll-review-fixture",
          revisionNumber: 2,
          rows: fixture.currentRows,
        }
      : null,
    approved: {
      revisionId: `${fixture.key}-approved`,
      payrollRunId: "payroll-review-fixture",
      revisionNumber: 1,
      rows: fixture.approvedRows,
    },
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900">Draft comparison</h2>
        <p className="text-sm text-gray-600 mt-1">
          Compare a payroll draft revision with its approved version before review.
          Salary values stay redacted by default. Scenarios below are QA fixtures, not
          live approval-queue data.
        </p>
        <div className="mt-4">
          <label htmlFor="diff-fixture-select" className="block text-sm font-medium text-gray-700 mb-2">
            Scenario
          </label>
          <select
            id="diff-fixture-select"
            value={fixtureKey}
            onChange={(e) => setFixtureKey(e.target.value)}
            className="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {BATCH_DIFF_FIXTURES.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
            <option value="missing-current">Current version unavailable</option>
          </select>
          {hasCurrentDraft && <p className="mt-2 text-xs text-gray-500">{fixture.description}</p>}
        </div>
      </div>

      <DraftComparisonView request={request} />
    </div>
  );
}

export default BatchDiffReviewScreen;
