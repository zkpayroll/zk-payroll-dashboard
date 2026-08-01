import { create } from "zustand";
import { ComplianceEvidenceBundle } from "@/types/models";
import { MOCK_COMPLIANCE_EVIDENCE_BUNDLES } from "@/lib/api/mockData";

interface EvidenceBundleStore {
  bundles: ComplianceEvidenceBundle[];
  selectedBundleId: string | null;
  setBundles: (bundles: ComplianceEvidenceBundle[]) => void;
  selectBundle: (id: string | null) => void;
  addBundle: (bundle: ComplianceEvidenceBundle) => void;
  verifyBundle: (bundleId: string) => boolean;
  getBundleByRunId: (runId: string) => ComplianceEvidenceBundle | undefined;
}

export const useEvidenceBundleStore = create<EvidenceBundleStore>((set, get) => ({
  bundles: MOCK_COMPLIANCE_EVIDENCE_BUNDLES,
  selectedBundleId: MOCK_COMPLIANCE_EVIDENCE_BUNDLES[0]?.bundleId || null,

  setBundles: (bundles) => set({ bundles }),

  selectBundle: (id) => set({ selectedBundleId: id }),

  addBundle: (bundle) =>
    set((state) => ({
      bundles: [bundle, ...state.bundles],
      selectedBundleId: bundle.bundleId,
    })),

  verifyBundle: (bundleId) => {
    const bundle = get().bundles.find((b) => b.bundleId === bundleId);
    if (!bundle) return false;
    const isConsistent =
      bundle.receipts.every((r) => r.status === "verified") &&
      bundle.proofReference.proofStatus === "verified" &&
      bundle.transactionMetadata.txHash.length > 0;

    if (isConsistent) {
      set((state) => ({
        bundles: state.bundles.map((b) =>
          b.bundleId === bundleId
            ? {
                ...b,
                verificationStatus: {
                  isVerified: true,
                  verifiedAt: new Date().toISOString(),
                  verifiedBy: "Client Verifier",
                  checksPassed: 5,
                  totalChecks: 5,
                },
              }
            : b
        ),
      }));
    }
    return isConsistent;
  },

  getBundleByRunId: (runId) => {
    return get().bundles.find((b) => b.payrollRunId === runId);
  },
}));
