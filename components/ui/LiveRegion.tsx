"use client";

/**
 * #469 – LiveRegion
 *
 * Mounts two visually-hidden ARIA live regions: one polite, one assertive.
 * Subscribes to `useAnnouncementStore` and pushes new messages into the
 * appropriate region so screen readers announce them automatically.
 *
 * Mount this component once near the root of the application (e.g. in the
 * root layout or a shared provider). It renders no visible UI.
 *
 * The double-render trick (clear → set) is required because some screen
 * readers (NVDA, JAWS) only announce when the text content *changes*. If the
 * same message is queued twice in a row, we briefly clear the region first.
 *
 * Usage
 * ─────
 *   // app/layout.tsx or providers component
 *   import { LiveRegion } from "@/components/ui/LiveRegion";
 *   ...
 *   <LiveRegion />
 */

import { useEffect, useRef } from "react";
import { useAnnouncementStore } from "@/stores/announcements";

export function LiveRegion() {
  const politeMessage = useAnnouncementStore((s) => s.politeMessage);
  const assertiveMessage = useAnnouncementStore((s) => s.assertiveMessage);
  const clear = useAnnouncementStore((s) => s.clear);

  const politeRef = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);

  // Push polite announcements into the region, resetting first so repeat
  // messages are still announced.
  useEffect(() => {
    if (!politeMessage || !politeRef.current) return;
    politeRef.current.textContent = "";
    const timer = setTimeout(() => {
      if (politeRef.current) politeRef.current.textContent = politeMessage;
    }, 50);
    return () => clearTimeout(timer);
  }, [politeMessage]);

  // Push assertive announcements.
  useEffect(() => {
    if (!assertiveMessage || !assertiveRef.current) return;
    assertiveRef.current.textContent = "";
    const timer = setTimeout(() => {
      if (assertiveRef.current)
        assertiveRef.current.textContent = assertiveMessage;
    }, 50);
    return () => clearTimeout(timer);
  }, [assertiveMessage]);

  // Clear the store after the live regions have picked up the text.
  useEffect(() => {
    if (!politeMessage && !assertiveMessage) return;
    const timer = setTimeout(() => clear(), 3000);
    return () => clearTimeout(timer);
  }, [politeMessage, assertiveMessage, clear]);

  return (
    <>
      {/* Polite region — read after current speech finishes */}
      <div
        ref={politeRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-relevant="text"
        className="sr-only"
        data-testid="live-region-polite"
      />
      {/* Assertive region — interrupts current speech */}
      <div
        ref={assertiveRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        aria-relevant="text"
        className="sr-only"
        data-testid="live-region-assertive"
      />
    </>
  );
}
