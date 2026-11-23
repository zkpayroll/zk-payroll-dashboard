/**
 * #469 – Accessible Announcement Store
 *
 * A lightweight store that buffers messages for ARIA live regions.
 * Components subscribe to this store to pick up new announcements and
 * inject them into a mounted `<LiveRegion>` element, which screen readers
 * then read aloud automatically.
 *
 * Two politeness levels are supported:
 * • "polite"    – queued after current speech (success, informational)
 * • "assertive" – interrupts current speech (errors, urgent warnings)
 *
 * Messages never contain sensitive payroll values. Callers are responsible
 * for passing safe, pre-sanitized strings.
 */

import { create } from "zustand";

export type AnnouncementPoliteness = "polite" | "assertive";

export interface Announcement {
  id: string;
  message: string;
  politeness: AnnouncementPoliteness;
}

interface AnnouncementStore {
  politeMessage: string;
  assertiveMessage: string;

  /** Queue a message to be read by assistive technologies. */
  announce: (message: string, politeness?: AnnouncementPoliteness) => void;

  /** Clear both message slots (called after the live region has picked up). */
  clear: () => void;
}

export const useAnnouncementStore = create<AnnouncementStore>()((set) => ({
  politeMessage: "",
  assertiveMessage: "",

  announce: (message, politeness = "polite") =>
    set(
      politeness === "assertive"
        ? { assertiveMessage: message }
        : { politeMessage: message },
    ),

  clear: () => set({ politeMessage: "", assertiveMessage: "" }),
}));
