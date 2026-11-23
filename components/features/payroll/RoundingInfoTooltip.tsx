"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import { describeAssetRounding } from "@/lib/payroll/multiAsset";

interface RoundingInfoTooltipProps {
  assetCode: string;
  /** Number of payments in the asset group (never individual amounts). */
  paymentCount: number;
}

/**
 * Info button explaining multi-asset rounding (#544).
 *
 * Opens on hover, keyboard focus or click; closes on mouse-leave, blur,
 * Escape or a second click. The content comes from describeAssetRounding and
 * only references the asset code and payment count, so no salary values are
 * exposed.
 */
export function RoundingInfoTooltip({ assetCode, paymentCount }: RoundingInfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const { summary, details } = describeAssetRounding(assetCode, paymentCount);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`Rounding details for ${assetCode}`}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="rounded-full text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-md border border-gray-200 bg-white p-3 text-left text-xs font-normal text-gray-700 shadow-lg"
        >
          <span className="mb-1 block font-semibold text-gray-900">{summary}</span>
          {details.map((line) => (
            <span key={line} className="mt-1 block">
              {line}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

export default RoundingInfoTooltip;
