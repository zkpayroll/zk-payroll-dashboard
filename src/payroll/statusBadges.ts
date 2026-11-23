/**
 * Payroll status badge presentation contract.
 *
 * Status badges are the fastest signal an operator gets from a payroll screen:
 * a glance at the colour and the word tells them whether a run is safe to pay,
 * still moving, or needs intervention. That makes them unusually easy to break
 * with an unrelated UI change — a renamed Tailwind token, a "small" palette
 * tidy-up, or a copy tweak can quietly turn "failed" green.
 *
 * This module owns the approved answer so the colours, labels, and contrast of
 * every payroll status badge are declared in exactly one place:
 *
 * - `PAYROLL_RUN_STATUS_BADGE_SPECS` — the run lifecycle (pending, verified,
 *   failed, cancelled) rendered by `components/ui/StatusBadge.tsx`.
 * - `RECONCILIATION_STATUS_BADGE_SPECS` — the settlement outcomes rendered by
 *   `components/features/payroll/ReconciliationBadge.tsx`.
 * - `APPROVED_STATUS_BADGE_CONTRAST` — the only colour pair each badge variant
 *   is allowed to use, kept aligned with `badgeVariants` in
 *   `components/ui/badge.tsx`.
 *
 * PRIVACY: labels are static vocabulary. They must never interpolate an amount,
 * a currency symbol, a counterparty, or a wallet/account fragment, so the
 * `inspectStatusBadgeLabel` guard rejects those outright rather than trusting
 * each call site. Evaluations return the offending status and the reason, never
 * a payroll value, so the failures are safe to print in CI logs and audit
 * trails.
 */

export type StatusBadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "error";

export type StatusBadgeSurface = "payroll_run" | "reconciliation";

/** Tailwind colour utilities that make up a badge's approved colour pair. */
export interface StatusBadgeContrast {
  /** Background utility, or `null` for surface-less variants such as `outline`. */
  background: string | null;
  /** Text utility. */
  text: string;
}

export interface StatusBadgeSpec {
  surface: StatusBadgeSurface;
  status: string;
  label: string;
  variant: StatusBadgeVariant;
  contrast: StatusBadgeContrast;
  hasIcon: boolean;
  /** Operator-facing guidance surfaced as the badge tooltip. */
  description?: string;
}

/**
 * Subset of the Tailwind palette used by payroll badges, as sRGB hex.
 *
 * Only the shades referenced by `APPROVED_STATUS_BADGE_CONTRAST` are listed, so
 * an unresolvable token fails loudly instead of silently scoring as "unknown
 * contrast, assume fine".
 */
const TAILWIND_PALETTE: Readonly<Record<string, string>> = {
  "gray-50": "#f9fafb",
  "gray-100": "#f3f4f6",
  "gray-900": "#111827",
  "gray-950": "#030712",
  "red-100": "#fee2e2",
  "red-500": "#ef4444",
  "red-800": "#991b1b",
  "green-100": "#dcfce7",
  "green-800": "#166534",
  "yellow-100": "#fef9c3",
  "yellow-800": "#854d0e",
  "blue-100": "#dbeafe",
  "blue-800": "#1e40af",
};

/** Page colour assumed behind a surface-less badge. */
const PAGE_SURFACE_HEX = "#ffffff";

/**
 * WCAG 2.1 AA for normal-size text. Badge text is `text-xs`, which is well
 * under the 18.66px "large text" cut-off, so 4.5:1 applies.
 */
export const WCAG_AA_NORMAL_TEXT_RATIO = 4.5;

/**
 * The single approved colour pair per variant. Mirrors `badgeVariants` in
 * `components/ui/badge.tsx`; a change there must be mirrored here and will
 * otherwise fail the visual regression suite.
 */
export const APPROVED_STATUS_BADGE_CONTRAST: Readonly<
  Record<StatusBadgeVariant, StatusBadgeContrast>
> = {
  default: { background: "bg-gray-900", text: "text-gray-50" },
  secondary: { background: "bg-gray-100", text: "text-gray-900" },
  destructive: { background: "bg-red-500", text: "text-gray-50" },
  outline: { background: null, text: "text-gray-950" },
  success: { background: "bg-green-100", text: "text-green-800" },
  warning: { background: "bg-yellow-100", text: "text-yellow-800" },
  info: { background: "bg-blue-100", text: "text-blue-800" },
  error: { background: "bg-red-100", text: "text-red-800" },
};

/**
 * Contrast deviations that are known, accepted, and tracked rather than
 * silently tolerated.
 *
 * `destructive` is not part of the payroll status palette — it is used by the
 * retry toast and the transaction detail drawer — so it is out of scope for a
 * payroll fix. It is listed here so the suite reports the shortfall honestly
 * instead of dropping the check, and so the entry has to be removed deliberately
 * once the shared variant is darkened.
 */
export const KNOWN_STATUS_BADGE_CONTRAST_DEVIATIONS: Readonly<
  Record<string, string>
> = {
  destructive:
    "bg-red-500 / text-gray-50 measures 3.60:1, under the 4.5:1 AA floor for the badge's 12px text. Pre-existing shared-variant issue outside the payroll badge set; tracked for a separate fix.",
};

/** Run lifecycle badges. Order matches the lifecycle, not alphabetically. */
export const PAYROLL_RUN_STATUS_BADGE_SPECS: readonly StatusBadgeSpec[] = [
  {
    surface: "payroll_run",
    status: "verified",
    label: "Verified",
    variant: "success",
    contrast: APPROVED_STATUS_BADGE_CONTRAST.success,
    hasIcon: true,
  },
  {
    surface: "payroll_run",
    status: "pending",
    label: "Pending",
    variant: "warning",
    contrast: APPROVED_STATUS_BADGE_CONTRAST.warning,
    hasIcon: true,
  },
  {
    surface: "payroll_run",
    status: "failed",
    label: "Failed",
    variant: "error",
    contrast: APPROVED_STATUS_BADGE_CONTRAST.error,
    hasIcon: true,
  },
  {
    surface: "payroll_run",
    status: "cancelled",
    label: "Cancelled",
    variant: "secondary",
    contrast: APPROVED_STATUS_BADGE_CONTRAST.secondary,
    hasIcon: true,
  },
];

/** Reconciliation outcome badges. */
export const RECONCILIATION_STATUS_BADGE_SPECS: readonly StatusBadgeSpec[] = [
  {
    surface: "reconciliation",
    status: "matched",
    label: "Matched",
    variant: "success",
    contrast: APPROVED_STATUS_BADGE_CONTRAST.success,
    hasIcon: true,
    description: "All expected payments were reconciled.",
  },
  {
    surface: "reconciliation",
    status: "pending",
    label: "Pending",
    variant: "info",
    contrast: APPROVED_STATUS_BADGE_CONTRAST.info,
    hasIcon: true,
    description: "Reconciliation is still in progress. Check again after settlement.",
  },
  {
    surface: "reconciliation",
    status: "mismatched",
    label: "Mismatched",
    variant: "warning",
    contrast: APPROVED_STATUS_BADGE_CONTRAST.warning,
    hasIcon: true,
    description: "Reconciliation found a mismatch. Open the payroll run for details.",
  },
  {
    surface: "reconciliation",
    status: "failed",
    label: "Failed",
    variant: "error",
    contrast: APPROVED_STATUS_BADGE_CONTRAST.error,
    hasIcon: true,
    description:
      "Reconciliation could not complete. Open the payroll run to review and retry.",
  },
  {
    surface: "reconciliation",
    status: "manually_reviewed",
    label: "Manually reviewed",
    variant: "secondary",
    contrast: APPROVED_STATUS_BADGE_CONTRAST.secondary,
    hasIcon: true,
    description: "A reviewer acknowledged this reconciliation outcome.",
  },
];

export const STATUS_BADGE_SPECS: readonly StatusBadgeSpec[] = [
  ...PAYROLL_RUN_STATUS_BADGE_SPECS,
  ...RECONCILIATION_STATUS_BADGE_SPECS,
];

/** Variants the payroll status badges actually rely on. */
export const PAYROLL_STATUS_BADGE_VARIANTS: readonly StatusBadgeVariant[] = Array.from(
  new Set(STATUS_BADGE_SPECS.map((spec) => spec.variant)),
);

/** Statuses with no approved pair, used for unrecognised runtime values. */
export const UNKNOWN_STATUS_BADGE_SPEC: StatusBadgeSpec = {
  surface: "payroll_run",
  status: "unknown",
  label: "Unknown",
  variant: "secondary",
  contrast: APPROVED_STATUS_BADGE_CONTRAST.secondary,
  hasIcon: true,
};

/**
 * Outcome shown when a reconciliation status arrives unrecognised. Pending is
 * the safe choice: it is neutral, never implies a payment settled, and carries
 * no value.
 */
export const RECONCILIATION_FALLBACK_STATUS = "pending";

/** Strips a `bg-`/`text-`/`border-` prefix to get the palette token. */
function toPaletteToken(utility: string): string {
  return utility.replace(/^(?:bg|text|border)-/, "");
}

/** Resolves a Tailwind utility to sRGB hex, or `null` when it is not listed. */
export function resolveTailwindHex(utility: string | null): string | null {
  if (!utility) return PAGE_SURFACE_HEX;
  return TAILWIND_PALETTE[toPaletteToken(utility)] ?? null;
}

function channelToLinear(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function parseHex(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** WCAG 2.1 relative luminance for an sRGB hex colour. */
export function relativeLuminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(channelToLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio between two sRGB hex colours, or `null` if unresolvable. */
export function contrastRatio(foregroundHex: string, backgroundHex: string): number | null {
  const foreground = relativeLuminance(foregroundHex);
  const background = relativeLuminance(backgroundHex);
  if (foreground === null || background === null) return null;
  const lighter = Math.max(foreground, background);
  const darker = Math.min(foreground, background);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface StatusBadgeContrastEvaluation {
  surface: StatusBadgeSurface;
  status: string;
  label: string;
  variant: StatusBadgeVariant;
  background: string | null;
  text: string;
  /** Whether the spec uses the approved pair for its variant. */
  usesApprovedPalette: boolean;
  /** Measured ratio, or `null` when a colour could not be resolved. */
  ratio: number | null;
  threshold: number;
  meetsMinimumRatio: boolean;
  /** Actionable, value-free summary suitable for CI output. */
  reason: string;
}

function describePair(contrast: StatusBadgeContrast): string {
  return `${contrast.background ?? "no background"} / ${contrast.text}`;
}

/**
 * Scores one badge's colour pair against the approved palette and the WCAG AA
 * floor. Both halves matter: an unapproved pair can still be readable, and an
 * approved pair stops being readable if the palette drifts.
 */
export function evaluateStatusBadgeContrast(
  spec: StatusBadgeSpec,
): StatusBadgeContrastEvaluation {
  const approved = APPROVED_STATUS_BADGE_CONTRAST[spec.variant];
  const usesApprovedPalette =
    approved.background === spec.contrast.background &&
    approved.text === spec.contrast.text;

  const textHex = resolveTailwindHex(spec.contrast.text);
  const backgroundHex = resolveTailwindHex(spec.contrast.background);
  const ratio =
    textHex && backgroundHex ? contrastRatio(textHex, backgroundHex) : null;

  const identity = `${spec.surface}/${spec.status}`;
  const ratioText =
    ratio === null ? "unresolved" : `${ratio.toFixed(2)}:1 against ${WCAG_AA_NORMAL_TEXT_RATIO}:1`;
  const meetsMinimumRatio = ratio !== null && ratio >= WCAG_AA_NORMAL_TEXT_RATIO;

  let reason: string;
  if (!textHex || !backgroundHex) {
    reason = `${identity}: colour ${describePair(spec.contrast)} is not in the approved Tailwind palette, so contrast cannot be verified. Add the shade to the palette or use the approved ${spec.variant} pair.`;
  } else if (usesApprovedPalette && meetsMinimumRatio) {
    reason = `${identity}: approved ${spec.variant} palette ${describePair(spec.contrast)} meets WCAG AA at ${ratioText}.`;
  } else {
    // Report every problem, not just the first, so one failure lists the full
    // remediation instead of forcing a fix-and-rerun cycle per defect.
    const problems: string[] = [];
    if (!usesApprovedPalette) {
      problems.push(
        `expected the ${spec.variant} palette ${describePair(approved)} but found ${describePair(spec.contrast)}`,
      );
    }
    if (!meetsMinimumRatio) {
      problems.push(
        `contrast is ${ratioText}, below WCAG AA; darken the text or lighten the background`,
      );
    }
    reason = `${identity}: ${problems.join("; ")}.`;
  }

  return {
    surface: spec.surface,
    status: spec.status,
    label: spec.label,
    variant: spec.variant,
    background: spec.contrast.background,
    text: spec.contrast.text,
    usesApprovedPalette,
    ratio,
    threshold: WCAG_AA_NORMAL_TEXT_RATIO,
    meetsMinimumRatio,
    reason,
  };
}

/** Evaluates every badge in the contract, optionally scoped to one surface. */
export function evaluateAllStatusBadgeContrast(
  surface?: StatusBadgeSurface,
): StatusBadgeContrastEvaluation[] {
  return listStatusBadgeSpecs(surface).map(evaluateStatusBadgeContrast);
}

export interface StatusBadgeColorCollision {
  surface: StatusBadgeSurface;
  /** The shared colour pair, rendered as utilities. */
  contrast: StatusBadgeContrast;
  /** Statuses that would be indistinguishable by colour. */
  statuses: string[];
  reason: string;
}

/**
 * Detects two statuses on the same surface that share a colour pair, which
 * would make them indistinguishable at a glance even if the words are correct.
 */
export function findStatusBadgeColorCollisions(
  surface?: StatusBadgeSurface,
  specs: readonly StatusBadgeSpec[] = STATUS_BADGE_SPECS,
): StatusBadgeColorCollision[] {
  const bySurface = new Map<StatusBadgeSurface, Map<string, StatusBadgeSpec[]>>();
  const candidates = surface
    ? specs.filter((entry) => entry.surface === surface)
    : specs;

  for (const spec of candidates) {
    const pairKey = `${spec.contrast.background ?? "none"}/${spec.contrast.text}`;
    const surfaceMap = bySurface.get(spec.surface) ?? new Map<string, StatusBadgeSpec[]>();
    const bucket = surfaceMap.get(pairKey) ?? [];
    bucket.push(spec);
    surfaceMap.set(pairKey, bucket);
    bySurface.set(spec.surface, surfaceMap);
  }

  const collisions: StatusBadgeColorCollision[] = [];
  bySurface.forEach((surfaceMap, surfaceKey) => {
    surfaceMap.forEach((bucket) => {
      if (bucket.length < 2) return;
      const contrast = bucket[0].contrast;
      const statuses = bucket.map((spec) => spec.status);
      collisions.push({
        surface: surfaceKey,
        contrast,
        statuses,
        reason: `${surfaceKey}: ${statuses.join(", ")} all render as ${describePair(contrast)}, so they are not distinguishable by colour.`,
      });
    });
  });

  return collisions;
}

export interface StatusBadgeLabelInspection {
  safe: boolean;
  reasons: string[];
}

/**
 * Rejects labels that could carry a payroll value or personal data into a badge.
 * Labels come from a fixed vocabulary, so anything numeric, monetary, or
 * contact-shaped is a bug rather than a formatting choice.
 */
export function inspectStatusBadgeLabel(label: string): StatusBadgeLabelInspection {
  const reasons: string[] = [];
  const trimmed = label.trim();

  if (!trimmed) {
    reasons.push("label is empty");
  }
  if (/\d/.test(trimmed)) {
    reasons.push("label contains a digit, which can leak a count or an amount");
  }
  if (/[$€£¥]|\b(?:usd|eur|gbp|xlm|xdr)\b/i.test(trimmed)) {
    reasons.push("label contains a currency symbol or code");
  }
  if (trimmed.includes("@")) {
    reasons.push("label contains an account or email address");
  }
  if (/[<>]/.test(trimmed)) {
    reasons.push("label contains markup delimiters");
  }
  if (trimmed.split(/\s+/).filter(Boolean).length > 3) {
    reasons.push("label is longer than three words and no longer fits a badge");
  }

  return { safe: reasons.length === 0, reasons };
}

/** Returns the specs for one surface, or all of them when omitted. */
export function listStatusBadgeSpecs(
  surface?: StatusBadgeSurface,
): readonly StatusBadgeSpec[] {
  return surface ? STATUS_BADGE_SPECS.filter((spec) => spec.surface === surface) : STATUS_BADGE_SPECS;
}

function findSpec(surface: StatusBadgeSurface, status: string): StatusBadgeSpec | null {
  const normalized = status.trim().toLowerCase();
  return (
    listStatusBadgeSpecs(surface).find((spec) => spec.status === normalized) ?? null
  );
}

/** Looks up a run lifecycle spec, or `null` when the status is not declared. */
export function getPayrollRunStatusBadgeSpec(status: string): StatusBadgeSpec | null {
  return findSpec("payroll_run", status);
}

/** Looks up a reconciliation spec, or `null` when the outcome is not declared. */
export function getReconciliationStatusBadgeSpec(status: string): StatusBadgeSpec | null {
  return findSpec("reconciliation", status);
}
