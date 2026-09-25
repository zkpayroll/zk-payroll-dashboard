"use client";

/**
 * #469 – usePayrollResultAnnouncer
 *
 * Fires both a visual sonner toast *and* an accessible ARIA announcement
 * for every payroll result event.  Callers never need to remember to call
 * both systems; this hook keeps them in sync.
 *
 * All message strings are intentionally generic — no salary amounts, wallet
 * addresses, or employee-identifiable data are ever passed through here.
 *
 * Usage
 * ─────
 *   const { announceSuccess, announceError, announceInfo } =
 *     usePayrollResultAnnouncer();
 *
 *   // On proof generated:
 *   announceSuccess("Proof generated", "ZK proof is ready for submission.");
 *
 *   // On submission failure:
 *   announceError("Submission failed", "Network timeout. Please retry.");
 */

import { useCallback } from "react";
import { toast } from "sonner";
import { useAnnouncementStore } from "@/stores/announcements";

export interface UsePayrollResultAnnouncerResult {
  /**
   * Announce a success event.
   * Fires a `toast.success` + polite ARIA announcement.
   */
  announceSuccess: (title: string, description?: string) => void;

  /**
   * Announce an error event.
   * Fires a `toast.error` + assertive ARIA announcement so screen readers
   * interrupt and read the failure immediately.
   */
  announceError: (title: string, description?: string) => void;

  /**
   * Announce a neutral informational event.
   * Fires a `toast` (default) + polite ARIA announcement.
   */
  announceInfo: (title: string, description?: string) => void;

  /**
   * Announce a warning event.
   * Fires a `toast.warning` + polite ARIA announcement.
   */
  announceWarning: (title: string, description?: string) => void;
}

export function usePayrollResultAnnouncer(): UsePayrollResultAnnouncerResult {
  const announce = useAnnouncementStore((s) => s.announce);

  const announceSuccess = useCallback(
    (title: string, description?: string) => {
      toast.success(title, description ? { description } : undefined);
      const ariaMessage = description ? `${title}. ${description}` : title;
      announce(ariaMessage, "polite");
    },
    [announce],
  );

  const announceError = useCallback(
    (title: string, description?: string) => {
      toast.error(title, description ? { description } : undefined);
      const ariaMessage = description ? `${title}. ${description}` : title;
      // Errors use assertive so the announcement interrupts any current speech.
      announce(ariaMessage, "assertive");
    },
    [announce],
  );

  const announceInfo = useCallback(
    (title: string, description?: string) => {
      toast(title, description ? { description } : undefined);
      const ariaMessage = description ? `${title}. ${description}` : title;
      announce(ariaMessage, "polite");
    },
    [announce],
  );

  const announceWarning = useCallback(
    (title: string, description?: string) => {
      toast.warning(title, description ? { description } : undefined);
      const ariaMessage = description ? `${title}. ${description}` : title;
      announce(ariaMessage, "polite");
    },
    [announce],
  );

  return { announceSuccess, announceError, announceInfo, announceWarning };
}
