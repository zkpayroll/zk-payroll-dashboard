import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/ui/StatusBadge";
import { ReconciliationStatusBadge } from "@/components/features/payroll/ReconciliationBadge";
import { MOCK_PAYROLL_RUNS } from "@/lib/api/mockData";
import { RECONCILIATION_STATUS_LABELS } from "@/lib/reconciliation/status";
import type { PayrollTransaction, ReconciliationOutcome } from "@/types/models";
import {
  APPROVED_STATUS_BADGE_CONTRAST,
  KNOWN_STATUS_BADGE_CONTRAST_DEVIATIONS,
  PAYROLL_RUN_STATUS_BADGE_SPECS,
  PAYROLL_STATUS_BADGE_VARIANTS,
  RECONCILIATION_FALLBACK_STATUS,
  RECONCILIATION_STATUS_BADGE_SPECS,
  STATUS_BADGE_SPECS,
  UNKNOWN_STATUS_BADGE_SPEC,
  WCAG_AA_NORMAL_TEXT_RATIO,
  contrastRatio,
  evaluateAllStatusBadgeContrast,
  evaluateStatusBadgeContrast,
  findStatusBadgeColorCollisions,
  inspectStatusBadgeLabel,
  listStatusBadgeSpecs,
  resolveTailwindHex,
  type StatusBadgeContrast,
  type StatusBadgeSpec,
  type StatusBadgeVariant,
} from "@/src/payroll/statusBadges";

/**
 * The run lifecycle declared by `PayrollTransaction["status"]`. Annotated so the
 * suite fails to compile if a status is ever removed from the union; the
 * contract coverage test then fails if a new one is added without a badge.
 */
const PAYROLL_RUN_STATUSES = [
  "pending",
  "verified",
  "failed",
  "cancelled",
] as const satisfies readonly PayrollTransaction["status"][];

const STATUS_BADGE_VARIANTS = Object.keys(
  APPROVED_STATUS_BADGE_CONTRAST,
) as StatusBadgeVariant[];

function ratioFor(contrast: StatusBadgeContrast): number | null {
  const textHex = resolveTailwindHex(contrast.text);
  const backgroundHex = resolveTailwindHex(contrast.background);
  if (!textHex || !backgroundHex) return null;
  return contrastRatio(textHex, backgroundHex);
}

/** Reads the label the way an operator reads it: the visible text only. */
function labelOf(badge: HTMLElement): string | null {
  return badge.querySelector("span")?.textContent ?? null;
}

describe("Visual Regression - Payroll Status Badges", () => {
  describe("Run lifecycle badges", () => {
    it.each(PAYROLL_RUN_STATUS_BADGE_SPECS)(
      "renders $status as \"$label\" with its approved colours",
      (spec) => {
        const { container } = render(<StatusBadge status={spec.status} />);

        const badge = screen.getByRole("status", { name: `Status: ${spec.label}` });
        expect(labelOf(badge)).toBe(spec.label);

        if (spec.contrast.background) {
          expect(badge).toHaveClass(spec.contrast.background);
        }
        expect(badge).toHaveClass(spec.contrast.text);

        if (spec.hasIcon) {
          expect(badge.querySelector("svg")).toBeInTheDocument();
        }

        expect(container).toMatchSnapshot();
      },
    );

    it("declares a badge spec for every payroll run status", () => {
      const declared = listStatusBadgeSpecs("payroll_run")
        .map((spec) => spec.status)
        .sort();

      expect(declared).toEqual([...PAYROLL_RUN_STATUSES].sort());
    });
  });

  describe("Reconciliation outcome badges", () => {
    it.each(RECONCILIATION_STATUS_BADGE_SPECS)(
      "renders $status as \"$label\" with its approved colours and guidance",
      (spec) => {
        const { container } = render(
          <ReconciliationStatusBadge status={spec.status as ReconciliationOutcome} />,
        );

        const badge = screen.getByRole("status", {
          name: `Reconciliation: ${spec.label}`,
        });
        expect(labelOf(badge)).toBe(spec.label);

        if (spec.contrast.background) {
          expect(badge).toHaveClass(spec.contrast.background);
        }
        expect(badge).toHaveClass(spec.contrast.text);
        expect(badge.querySelector("svg")).toBeInTheDocument();

        if (spec.description) {
          expect(badge).toHaveAttribute("title", spec.description);
        }

        expect(container).toMatchSnapshot();
      },
    );

    it("declares a badge spec for every reconciliation outcome", () => {
      const outcomes = Object.keys(RECONCILIATION_STATUS_LABELS).sort();
      const declared = RECONCILIATION_STATUS_BADGE_SPECS.map((spec) =>
        spec.status,
      ).sort();

      expect(declared).toEqual(outcomes);
    });

    it("keeps contract labels in step with the reconciliation status vocabulary", () => {
      for (const spec of RECONCILIATION_STATUS_BADGE_SPECS) {
        expect(spec.label).toBe(
          RECONCILIATION_STATUS_LABELS[spec.status as ReconciliationOutcome],
        );
      }
    });
  });

  describe("Colour family", () => {
    it("renders every status side by side so colour drift is visible at a glance", () => {
      const { container } = render(
        <div>
          <div>
            {PAYROLL_RUN_STATUS_BADGE_SPECS.map((spec) => (
              <StatusBadge key={spec.status} status={spec.status} />
            ))}
          </div>
          <div>
            {RECONCILIATION_STATUS_BADGE_SPECS.map((spec) => (
              <ReconciliationStatusBadge
                key={spec.status}
                status={spec.status as ReconciliationOutcome}
              />
            ))}
          </div>
        </div>,
      );

      expect(container).toMatchSnapshot();
    });
  });

  describe("Contrast guard", () => {
    it("scores every declared badge at or above WCAG AA using its approved palette", () => {
      for (const evaluation of evaluateAllStatusBadgeContrast()) {
        expect(evaluation.usesApprovedPalette, evaluation.reason).toBe(true);
        expect(evaluation.meetsMinimumRatio, evaluation.reason).toBe(true);
        expect(evaluation.ratio ?? 0).toBeGreaterThanOrEqual(
          WCAG_AA_NORMAL_TEXT_RATIO,
        );
      }
    });

    it.each(STATUS_BADGE_VARIANTS)(
      "keeps the %s badge variant in step with the approved contrast contract",
      (variant) => {
        const approved = APPROVED_STATUS_BADGE_CONTRAST[variant];

        render(<Badge variant={variant} data-testid={`variant-${variant}`} />);
        const badge = screen.getByTestId(`variant-${variant}`);

        if (approved.background) {
          expect(badge).toHaveClass(approved.background);
        }
        expect(badge).toHaveClass(approved.text);
      },
    );

    it.each(PAYROLL_STATUS_BADGE_VARIANTS)(
      "keeps the payroll %s variant at or above WCAG AA",
      (variant) => {
        const ratio = ratioFor(APPROVED_STATUS_BADGE_CONTRAST[variant]);

        expect(ratio, `${variant} contrast could not be resolved`).not.toBeNull();
        expect(
          ratio ?? 0,
          `${variant} ${APPROVED_STATUS_BADGE_CONTRAST[variant].text} is below WCAG AA`,
        ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_RATIO);
        expect(KNOWN_STATUS_BADGE_CONTRAST_DEVIATIONS[variant]).toBeUndefined();
      },
    );

    it("documents every known contrast deviation instead of tolerating it silently", () => {
      for (const [variant, explanation] of Object.entries(
        KNOWN_STATUS_BADGE_CONTRAST_DEVIATIONS,
      )) {
        const key = variant as StatusBadgeVariant;
        const ratio = ratioFor(APPROVED_STATUS_BADGE_CONTRAST[key]);

        expect(
          PAYROLL_STATUS_BADGE_VARIANTS,
          `${variant} is not a payroll badge colour and should not be listed here`,
        ).not.toContain(key);
        expect(ratio ?? 0, `${variant} should still be measurable`).toBeLessThan(
          WCAG_AA_NORMAL_TEXT_RATIO,
        );
        expect(explanation).toMatch(/\d\.\d{2}:1/);
      }
    });

    it("keeps distinct statuses on a surface visually distinct", () => {
      expect(findStatusBadgeColorCollisions()).toEqual([]);
    });

    it("rejects a palette swap with an actionable, value-free reason", () => {
      const regression: StatusBadgeSpec = {
        ...UNKNOWN_STATUS_BADGE_SPEC,
        status: "failed",
        label: "Failed",
        variant: "error",
        contrast: { background: "bg-green-100", text: "text-green-800" },
      };

      const evaluation = evaluateStatusBadgeContrast(regression);

      expect(evaluation.usesApprovedPalette).toBe(false);
      expect(evaluation.reason).toContain("expected the error palette");
      expect(evaluation.reason).toContain("bg-red-100 / text-red-800");
      // The only numbers a diagnostic may carry are Tailwind shade identifiers.
      const withoutShades = evaluation.reason.replace(
        /\b(?:bg|text)-[a-z]+-\d+\b/g,
        "",
      );
      expect(withoutShades).not.toMatch(/\d/);
      expect(evaluation.reason).not.toMatch(/[$€£¥]/);
    });

    it("flags a self-declared palette that drops below AA", () => {
      const lowContrast: StatusBadgeSpec = {
        ...UNKNOWN_STATUS_BADGE_SPEC,
        contrast: { background: "bg-gray-100", text: "text-gray-100" },
      };

      const evaluation = evaluateStatusBadgeContrast(lowContrast);

      expect(evaluation.meetsMinimumRatio).toBe(false);
      expect(evaluation.reason).toContain("below WCAG AA");
      expect(evaluation.reason).toContain("darken the text or lighten the background");
    });

    it("reports an unapproved palette and a low ratio together", () => {
      const doublyWrong: StatusBadgeSpec = {
        ...UNKNOWN_STATUS_BADGE_SPEC,
        variant: "error",
        contrast: { background: "bg-red-100", text: "text-red-100" },
      };

      const evaluation = evaluateStatusBadgeContrast(doublyWrong);

      expect(evaluation.reason).toContain("expected the error palette");
      expect(evaluation.reason).toContain("below WCAG AA");
    });

    it("flags a colour that is not in the approved palette at all", () => {
      const offPalette: StatusBadgeSpec = {
        ...UNKNOWN_STATUS_BADGE_SPEC,
        contrast: { background: "bg-teal-200", text: "text-teal-900" },
      };

      const evaluation = evaluateStatusBadgeContrast(offPalette);

      expect(evaluation.ratio).toBeNull();
      expect(evaluation.meetsMinimumRatio).toBe(false);
      expect(evaluation.reason).toContain("not in the approved Tailwind palette");
    });

    it("detects two statuses that would become indistinguishable by colour", () => {
      const verified = PAYROLL_RUN_STATUS_BADGE_SPECS.find(
        (spec) => spec.status === "verified",
      );
      const cancelled = PAYROLL_RUN_STATUS_BADGE_SPECS.find(
        (spec) => spec.status === "cancelled",
      );
      if (!verified || !cancelled) {
        throw new Error("run lifecycle contract is incomplete");
      }

      const collided: StatusBadgeSpec[] = [
        verified,
        { ...cancelled, contrast: { ...verified.contrast } },
      ];

      const collisions = findStatusBadgeColorCollisions("payroll_run", collided);

      expect(collisions).toHaveLength(1);
      expect(collisions[0].statuses).toEqual(["verified", "cancelled"]);
      expect(collisions[0].reason).toContain("not distinguishable by colour");
    });

    it("does not flag distinct colours on the same surface", () => {
      const runStatuses = listStatusBadgeSpecs("payroll_run");

      expect(findStatusBadgeColorCollisions("payroll_run", runStatuses)).toEqual([]);
    });
  });

  describe("Label privacy", () => {
    it("uses static, value-free labels for every declared badge", () => {
      for (const spec of STATUS_BADGE_SPECS) {
        const inspection = inspectStatusBadgeLabel(spec.label);
        expect(inspection.safe, `${spec.surface}/${spec.status}: ${inspection.reasons.join("; ")}`).toBe(
          true,
        );
      }
    });

    it.each([...PAYROLL_RUN_STATUS_BADGE_SPECS, ...RECONCILIATION_STATUS_BADGE_SPECS])(
      "never renders digits, currency, or contact details for $status",
      (spec) => {
        render(
          <>
            <StatusBadge status={spec.status} />
            <ReconciliationStatusBadge
              status={spec.status as ReconciliationOutcome}
            />
          </>,
        );

        for (const badge of screen.getAllByRole("status")) {
          const text = badge.textContent ?? "";
          expect(text).not.toMatch(/\d/);
          expect(text).not.toMatch(/[$€£¥]/);
          expect(text).not.toContain("@");
        }
      },
    );

    it("rejects a label that would leak an amount", () => {
      const inspection = inspectStatusBadgeLabel("Paid 12,500 XLM");

      expect(inspection.safe).toBe(false);
      expect(inspection.reasons.join(" ")).toContain("digit");
    });

    it("keeps a failure badge free of the run's payroll values", () => {
      const run = { ...MOCK_PAYROLL_RUNS[0], status: "failed" as const };
      const runText = `${run.totalAmount}${run.employeeCount}${run.proof}`;

      render(
        <div>
          <StatusBadge status={run.status} />
          <ReconciliationStatusBadge status="failed" />
        </div>,
      );

      for (const badge of screen.getAllByRole("status")) {
        const text = badge.textContent ?? "";
        expect(runText).not.toContain(text);
        expect(text).not.toContain(String(run.totalAmount));
        expect(text).not.toContain(String(run.proof));
      }
    });
  });

  describe("Edge cases", () => {
    it("keeps a mismatched upper-case status on the approved palette", () => {
      const spec = PAYROLL_RUN_STATUS_BADGE_SPECS.find(
        (candidate) => candidate.status === "verified",
      );
      if (!spec) throw new Error("verified status is missing from the contract");

      render(<StatusBadge status="VERIFIED" />);

      const badge = screen.getByRole("status", { name: `Status: ${spec.label}` });
      expect(labelOf(badge)).toBe(spec.label);
      expect(badge).toHaveClass("bg-green-100");
      expect(badge).toHaveClass("text-green-800");
    });

    it("renders an unrecognised status on the neutral, accessible unknown badge", () => {
      const { container } = render(<StatusBadge status="awaiting_review" />);

      const badge = screen.getByRole("status", { name: "Status: Awaiting Review" });
      expect(badge).toHaveClass(UNKNOWN_STATUS_BADGE_SPEC.contrast.background ?? "");
      expect(badge).toHaveClass(UNKNOWN_STATUS_BADGE_SPEC.contrast.text);
      expect(container).toMatchSnapshot();
    });

    it("renders an empty status as Unknown rather than a blank badge", () => {
      render(<StatusBadge status="" />);

      const badge = screen.getByRole("status", { name: "Status: Unknown" });
      expect(labelOf(badge)).toBe(UNKNOWN_STATUS_BADGE_SPEC.label);
      expect(badge).toHaveClass(UNKNOWN_STATUS_BADGE_SPEC.contrast.text);
    });

    it("falls back to the declared reconciliation fallback for an unknown outcome", () => {
      const fallback = getLabelFor(RECONCILIATION_FALLBACK_STATUS);

      render(<ReconciliationStatusBadge status={"archived" as ReconciliationOutcome} />);

      const badge = screen.getByRole("status", { name: `Reconciliation: ${fallback}` });
      expect(badge).toHaveClass("bg-blue-100");
      expect(badge).toHaveClass("text-blue-800");
    });

    it("keeps colours when the icon is hidden", () => {
      render(<StatusBadge status="failed" showIcon={false} />);

      const badge = screen.getByRole("status", { name: "Status: Failed" });
      expect(badge.querySelector("svg")).not.toBeInTheDocument();
      expect(badge).toHaveClass("bg-red-100");
      expect(badge).toHaveClass("text-red-800");
    });
  });
});

function getLabelFor(status: string): string {
  const spec = RECONCILIATION_STATUS_BADGE_SPECS.find(
    (candidate) => candidate.status === status,
  );
  return spec?.label ?? UNKNOWN_STATUS_BADGE_SPEC.label;
}
