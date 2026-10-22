/**
 * Payroll Upload Recovery Checkpoints
 *
 * Persists a lightweight, privacy-safe snapshot of payroll upload progress to
 * localStorage at each meaningful wizard transition (draft started, proof
 * generated, confirmed, submitting). On page reload the operator sees a
 * recovery banner that links back to the interrupted step.
 *
 * Privacy contract
 * ─────────────────
 * The persisted payload intentionally omits all sensitive fields:
 *   • employee IDs and wallet addresses
 *   • salary amounts and ZK proofs
 *   • transaction hashes (added only after successful submission)
 * Only structural progress metadata — runId, stage, employeeCount, proofReady,
 * timestamp — is written to localStorage.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UploadCheckpoint, UploadCheckpointStage } from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Human-readable recovery hints keyed by stage. Never reference amounts. */
const RECOVERY_HINTS: Record<UploadCheckpointStage, string> = {
  draft_started:
    "Employee selection was completed. Return to Review to verify the batch before generating a proof.",
  proof_generated:
    "A ZK proof was generated. Continue to the Confirmation step to review the proof before submitting.",
  confirmed:
    "The batch was confirmed. Proceed to the Submit step to dispatch the transaction.",
  submitting:
    "Submission was in progress when the session was interrupted. Check the payroll run status before retrying.",
  completed:
    "This payroll run completed successfully. No recovery is needed.",
};

/** Maximum age (ms) after which a checkpoint is considered stale and cleared automatically. */
export const CHECKPOINT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Store interface ──────────────────────────────────────────────────────────

interface UploadCheckpointStore {
  /** The most recently written checkpoint, or null when none exists. */
  checkpoint: UploadCheckpoint | null;

  /**
   * Write a new checkpoint for the given run at the given stage.
   *
   * Only the stage, employee count (not IDs), and proof-ready flag are
   * recorded — no amounts, addresses, or proof data.
   */
  saveCheckpoint: (
    runId: string,
    stage: UploadCheckpointStage,
    employeeCount: number,
    proofReady: boolean,
  ) => void;

  /**
   * Advance an existing checkpoint to the `completed` stage after a
   * successful submission. The checkpoint is then cleared on the next
   * call to `clearCheckpoint` (or on the next session start if the
   * operator never clicks Dismiss).
   */
  markCompleted: (runId: string) => void;

  /**
   * Remove the stored checkpoint. Call this when the operator dismisses
   * the recovery banner or after a confirmed successful submission.
   */
  clearCheckpoint: () => void;

  /**
   * Returns true when a non-completed checkpoint exists for any run and
   * the checkpoint is not yet stale (< 24 h old).
   */
  hasRecoverableCheckpoint: () => boolean;

  /**
   * Returns true when the stored checkpoint belongs to the given runId
   * and is not yet completed.
   */
  isRunRecoverable: (runId: string) => boolean;

  /**
   * Remove checkpoints older than CHECKPOINT_MAX_AGE_MS. Call on session
   * start to prevent stale banners from appearing after a long absence.
   */
  evictStaleCheckpoint: () => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const usePayrollUploadCheckpointStore = create<UploadCheckpointStore>()(
  persist(
    (set, get) => ({
      checkpoint: null,

      saveCheckpoint: (runId, stage, employeeCount, proofReady) => {
        // Never overwrite a completed checkpoint with a regression.
        const existing = get().checkpoint;
        if (existing?.runId === runId && existing.stage === "completed") return;

        set({
          checkpoint: {
            runId,
            stage,
            employeeCount,
            proofReady,
            savedAt: new Date().toISOString(),
            recoveryHint: RECOVERY_HINTS[stage],
          } satisfies UploadCheckpoint,
        });
      },

      markCompleted: (runId) => {
        const existing = get().checkpoint;
        if (!existing || existing.runId !== runId) return;
        set({
          checkpoint: {
            ...existing,
            stage: "completed",
            savedAt: new Date().toISOString(),
            recoveryHint: RECOVERY_HINTS.completed,
          },
        });
      },

      clearCheckpoint: () => set({ checkpoint: null }),

      hasRecoverableCheckpoint: () => {
        const { checkpoint } = get();
        if (!checkpoint || checkpoint.stage === "completed") return false;
        const ageMs = Date.now() - new Date(checkpoint.savedAt).getTime();
        return ageMs < CHECKPOINT_MAX_AGE_MS;
      },

      isRunRecoverable: (runId) => {
        const { checkpoint } = get();
        if (!checkpoint || checkpoint.runId !== runId) return false;
        if (checkpoint.stage === "completed") return false;
        const ageMs = Date.now() - new Date(checkpoint.savedAt).getTime();
        return ageMs < CHECKPOINT_MAX_AGE_MS;
      },

      evictStaleCheckpoint: () => {
        const { checkpoint } = get();
        if (!checkpoint) return;
        const ageMs = Date.now() - new Date(checkpoint.savedAt).getTime();
        if (ageMs >= CHECKPOINT_MAX_AGE_MS) {
          set({ checkpoint: null });
        }
      },
    }),
    {
      name: "zk-payroll-upload-checkpoint",
      // Only persist the checkpoint snapshot — nothing else.
      partialize: (state) => ({ checkpoint: state.checkpoint }),
    },
  ),
);
