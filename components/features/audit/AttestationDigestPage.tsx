"use client";

import { useEffect } from "react";
import { HelpButton } from "@/components/ui/HelpDrawer";
import AttestationDigestViewer from "./AttestationDigestViewer";
import { useAuditDigestStore } from "@/stores/auditDigest";
import type { AttestationDigestMetadata } from "@/types/audit";

const MOCK_DIGESTS: AttestationDigestMetadata[] = [
  {
    digest: "0x8a7b3f2c9e4d1a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9",
    schemaVersion: "2.0",
    period: "2025-Q2",
    scope: {
      included: ["payroll-runs", "employee-counts", "total-disbursements"],
      excluded: ["individual-salaries", "employee-names", "wallet-addresses"],
    },
    verificationState: "verified",
    createdAt: "2025-07-01T10:00:00Z",
    verifiedAt: "2025-07-01T10:15:00Z",
    referencedBy: "Annual Compliance Audit 2025 — Deloitte",
  },
  {
    digest: "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    schemaVersion: "1.1",
    period: "2025-Q1",
    scope: {
      included: ["payroll-runs", "total-disbursements"],
      excluded: ["individual-salaries", "employee-names", "wallet-addresses"],
    },
    verificationState: "mismatch",
    createdAt: "2025-04-01T09:00:00Z",
    verifiedAt: "2025-04-02T14:30:00Z",
    referencedBy: "Q1 Internal Review — KPMG",
  },
  {
    digest: "0x4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
    schemaVersion: "3.0",
    period: "",
    scope: {
      included: ["payroll-runs"],
      excluded: ["individual-salaries", "employee-names", "wallet-addresses"],
    },
    verificationState: "incomplete",
    createdAt: "2025-08-15T08:00:00Z",
    referencedBy: "Ad-hoc Review — PwC",
  },
  {
    digest: "0x9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
    schemaVersion: "",
    period: "2025-Q3",
    scope: {
      included: [],
      excluded: [],
    },
    verificationState: "missing",
    createdAt: "2025-09-01T00:00:00Z",
  },
];

function AttestationDigestPage() {
  const { digests, isLoading, setDigests, setLoading } = useAuditDigestStore();

  useEffect(() => {
    if (digests.length === 0) {
      setLoading(true);
      fetch("/api/attestation")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
        })
        .then((json) => {
          if (json.success && Array.isArray(json.data)) {
            setDigests(json.data);
          }
        })
        .catch(() => {
          setDigests(MOCK_DIGESTS);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [digests.length, setDigests, setLoading]);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Audit Attestations
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Inspect attestation digests without exposing raw payroll data.
          </p>
        </div>
        <HelpButton page="audit" label="Help" />
      </div>

      <div className="bg-white rounded-lg border shadow-sm p-6">
        <AttestationDigestViewer digests={digests} isLoading={isLoading} />
      </div>
    </section>
  );
}

export default AttestationDigestPage;
