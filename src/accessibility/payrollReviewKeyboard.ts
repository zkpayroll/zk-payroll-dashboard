/**
 * Keyboard navigation helpers for payroll review surfaces (#271).
 *
 * Pure focus-index math plus a small roving-focus hook so review toolbars
 * and filter groups can be operated with arrow keys, Home, and End while
 * keeping a single tab stop (WCAG 2.1.1 keyboard operability).
 *
 * These helpers only move focus — they never activate critical actions,
 * so approve/reject confirmation flows stay intact.
 */

import React from "react";
export type ReviewFocusOrientation = "horizontal" | "vertical";

const HORIZONTAL_KEYS = new Set(["ArrowLeft", "ArrowRight"]);
const VERTICAL_KEYS = new Set(["ArrowUp", "ArrowDown"]);

/**
 * Computes the next roving-focus index for a keyboard event key.
 * Returns null when the key should be left to the browser (e.g. Tab).
 * Wraps around so the toolbar is a focus ring.
 */
export function getNextFocusIndex(
  key: string,
  currentIndex: number,
  itemCount: number,
  orientation: ReviewFocusOrientation = "horizontal",
): number | null {
  if (itemCount <= 0) return null;

  const isHorizontal = orientation === "horizontal";
  const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown";
  const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp";
  const handled = isHorizontal ? HORIZONTAL_KEYS : VERTICAL_KEYS;

  if (handled.has(key)) {
    if (itemCount === 1) return 0;
    if (key === nextKey) return (currentIndex + 1) % itemCount;
    return (currentIndex - 1 + itemCount) % itemCount;
  }
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
  return null;
}

/**
 * Hook implementing roving tabindex for a group of review controls.
 * Exactly one item is tabbable at a time; arrows move focus within the group.
 */
export function useRovingFocus(
  itemCount: number,
  orientation: ReviewFocusOrientation = "horizontal",
) {
  const [activeIndex, setActiveIndex] = React.useState(0);

  const getItemProps = React.useCallback(
    (index: number) => ({
      tabIndex: index === activeIndex ? 0 : -1,
      onFocus: () => setActiveIndex(index),
    }),
    [activeIndex],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      const next = getNextFocusIndex(
        event.key,
        activeIndex,
        itemCount,
        orientation,
      );
      if (next === null) return;
      event.preventDefault();
      setActiveIndex(next);
      const group = event.currentTarget as HTMLElement;
      const items = group.querySelectorAll<HTMLElement>("[data-roving-item]");
      items[next]?.focus();
    },
    [activeIndex, itemCount, orientation],
  );

  return { activeIndex, setActiveIndex, getItemProps, handleKeyDown };
}
