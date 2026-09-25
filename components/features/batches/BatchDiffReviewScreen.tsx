"use client";

import { useState } from "react";
import BatchDiffView from "@/components/features/batches/BatchDiffView";
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
  const fixture = getBatchDiffFixture(fixtureKey);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900">Payroll review</h2>
        <p className="text-sm text-gray-600 mt-1">
          Compare the current payroll draft with the previously approved draft before
          signing. Private salary values stay redacted by default.
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
          </select>
          <p className="mt-2 text-xs text-gray-500">{fixture.description}</p>
        </div>
      </div>

      <BatchDiffView
        currentRows={fixture.currentRows}
        approvedRows={fixture.approvedRows}
        title="Draft vs previously approved batch"
      />
    </div>
  );
}

export default BatchDiffReviewScreen;
