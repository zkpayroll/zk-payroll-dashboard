"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "./useSession";
import { useKeyboardShortcutsStore } from "@/stores/keyboardShortcuts";
import { useAnnouncementStore } from "@/stores/announcements";
import {
  isInputElement,
  findShortcutBySequence,
  validateShortcut,
} from "@/src/lib/shortcuts";
import type { UserRole } from "@/types";

const SEQUENCE_TIMEOUT_MS = 1200;

export function usePayrollShortcuts() {
  const router = useRouter();
  const { sessionInfo } = useSession();
  const currentRole: UserRole = sessionInfo?.role ?? "admin";

  const {
    isModalOpen,
    enabled,
    pendingSequence,
    openModal,
    closeModal,
    toggleModal,
    setEnabled,
    setPendingSequence,
    setLastShortcutTriggered,
  } = useKeyboardShortcutsStore();

  const announce = useAnnouncementStore((s) => s.announce);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // 1. Inhibit shortcuts when typing in inputs, textareas, or contenteditables
      if (isInputElement(e.target)) {
        return;
      }

      // 2. Ignore modifier combinations (Ctrl/Meta/Alt) except standard browser events
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      // 3. Handle Escape key (always active, regardless of enabled setting)
      if (e.key === "Escape") {
        if (isModalOpen) {
          closeModal();
          e.preventDefault();
        }
        if (pendingSequence) {
          clearPendingTimer();
          setPendingSequence(null);
        }
        return;
      }

      // 4. Handle '?' to open cheatsheet modal (Shift + / on most layouts)
      if (e.key === "?") {
        e.preventDefault();
        toggleModal();
        announce("Keyboard shortcuts guide toggled", "polite");
        return;
      }

      // 5. If single-key / sequence shortcuts are disabled by user, skip
      if (!enabled) {
        return;
      }

      const key = e.key.toLowerCase();

      // If no sequence is currently active, check if this key starts a known sequence
      if (!pendingSequence) {
        if (["g", "c", "p"].includes(key)) {
          clearPendingTimer();
          setPendingSequence(key);

          // Reset sequence after timeout
          timerRef.current = setTimeout(() => {
            setPendingSequence(null);
          }, SEQUENCE_TIMEOUT_MS);
        }
        return;
      }

      // A sequence is already pending (e.g. 'g', 'c', 'p')
      clearPendingTimer();
      const sequence = [pendingSequence, key];
      setPendingSequence(null);

      const matchedShortcut = findShortcutBySequence(sequence);
      if (!matchedShortcut) {
        return;
      }

      e.preventDefault();

      // Validate role authorization
      const validation = validateShortcut(matchedShortcut, currentRole);
      if (!validation.allowed) {
        const errorMsg = validation.reason || "Action not authorized.";
        announce(errorMsg, "assertive");
        toast.error(errorMsg);
        return;
      }

      // Execute authorized shortcut
      setLastShortcutTriggered(matchedShortcut.description);
      announce(`Navigated: ${matchedShortcut.description}`, "polite");

      if (matchedShortcut.route) {
        router.push(matchedShortcut.route);
      } else if (matchedShortcut.actionId === "toggle-shortcuts-modal") {
        toggleModal();
      }
    },
    [
      isModalOpen,
      enabled,
      pendingSequence,
      currentRole,
      closeModal,
      toggleModal,
      clearPendingTimer,
      setPendingSequence,
      setLastShortcutTriggered,
      announce,
      router,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearPendingTimer();
    };
  }, [handleKeyDown, clearPendingTimer]);

  return {
    isModalOpen,
    enabled,
    pendingSequence,
    openModal,
    closeModal,
    toggleModal,
    setEnabled,
  };
}
