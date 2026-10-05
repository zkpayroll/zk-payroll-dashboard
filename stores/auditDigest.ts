import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AttestationDigestMetadata } from "@/types/audit";

interface AuditDigestState {
  digests: AttestationDigestMetadata[];
  selectedDigestId: string | null;
  isLoading: boolean;
  error: string | null;

  setDigests: (digests: AttestationDigestMetadata[]) => void;
  addDigest: (digest: AttestationDigestMetadata) => void;
  selectDigest: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuditDigestStore = create<AuditDigestState>()(
  persist(
    (set) => ({
      digests: [],
      selectedDigestId: null,
      isLoading: false,
      error: null,

      setDigests: (digests) => set({ digests }),
      addDigest: (digest) =>
        set((state) => ({
          digests: [...state.digests, digest],
        })),
      selectDigest: (id) => set({ selectedDigestId: id }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
    }),
    {
      name: "zk-payroll-audit-digests",
      partialize: (state) => ({
        digests: state.digests,
      }),
    },
  ),
);
