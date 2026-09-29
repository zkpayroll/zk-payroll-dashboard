"use client";

import { useEffect, useState } from "react";
import OwnerTransferReview from "@/components/features/settings/OwnerTransferReview";
import { fetchRoleDirectory } from "@/lib/auth/roleDirectory";
import { MOCK_COMPANIES, MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import type { OwnerTransferParty } from "@/src/payroll/ownerTransfer";

/**
 * Supplies the owner transfer review with the current owner (the company
 * admin wallet), directory members as candidates and the count of payroll
 * runs still in flight. Mirrors the mock data sources used by RoleViewer.
 */
function OwnerTransferReviewContainer() {
  const [candidates, setCandidates] = useState<OwnerTransferParty[] | null>(null);
  const [error, setError] = useState(false);
  const company = MOCK_COMPANIES[0];

  useEffect(() => {
    let active = true;
    fetchRoleDirectory()
      .then(({ groups }) => {
        if (!active) return;
        setCandidates(
          groups.flatMap((group) =>
            group.members.map((member) => ({
              id: member.id,
              name: member.name,
              walletAddress: member.walletAddress,
              role: group.key,
            })),
          ),
        );
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  if (!company) return null;
  if (error) {
    return (
      <p role="alert" className="text-sm text-red-700">
        Could not load accounts for ownership transfer. Please try again.
      </p>
    );
  }
  if (!candidates) {
    return <p className="text-sm text-gray-500">Loading accounts…</p>;
  }

  return (
    <OwnerTransferReview
      currentOwner={{ id: "role_admin_001", name: "Primary Admin", walletAddress: company.admin, role: "admin" }}
      candidates={candidates}
      inFlightRunCount={MOCK_PAYROLL_RUNS.filter((run) => run.status === "pending").length}
    />
  );
}

export default OwnerTransferReviewContainer;
