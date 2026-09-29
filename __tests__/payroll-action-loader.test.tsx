/**
 * Tests for Feature 3: Accessible Loading States
 *
 * Covers:
 *  - PayrollActionLoader renders correct ARIA roles and labels per phase
 *  - usePayrollLoadingAnnouncer injects screen-reader text into the live region
 *  - Buttons wired with getPayrollButtonAriaLabel carry the right accessible label
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  PayrollActionLoader,
  getPayrollButtonAriaLabel,
} from "@/components/ui/PayrollActionLoader";
import type { PayrollLoadingPhase } from "@/components/ui/PayrollActionLoader";

// ─── PayrollActionLoader ──────────────────────────────────────────────────────

describe("PayrollActionLoader", () => {
  it("renders nothing when phase is idle", () => {
    const { container } = render(
      <PayrollActionLoader phase="idle" actionLabel="Generate Proof" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a status region with aria-busy when generating", () => {
    render(
      <PayrollActionLoader
        phase="generating"
        actionLabel="Generating zero-knowledge proof"
      />,
    );

    // Visible status container
    const status = screen.getByRole("status", {
      name: /generating zero-knowledge proof in progress/i,
    });
    expect(status).toHaveAttribute("aria-busy", "true");

    // Action label text is visible — spinner is never the only cue
    expect(
      screen.getByText(/generating zero-knowledge proof…/i),
    ).toBeInTheDocument();
  });

  it("renders a status region with aria-busy when submitting", () => {
    render(
      <PayrollActionLoader
        phase="submitting"
        actionLabel="Submitting payroll transaction"
      />,
    );

    const status = screen.getByRole("status", {
      name: /submitting payroll transaction in progress/i,
    });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByText(/submitting payroll transaction…/i),
    ).toBeInTheDocument();
  });

  it("renders a success status with accessible label when phase is success", () => {
    render(
      <PayrollActionLoader phase="success" actionLabel="Generate Proof" />,
    );

    const status = screen.getByRole("status", {
      name: /generate proof completed successfully/i,
    });
    expect(status).toBeInTheDocument();
    // Use getAllByText — the sr-only live region also contains "completed successfully"
    expect(
      screen.getAllByText(/completed successfully/i).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders an alert with error message when phase is error", () => {
    render(
      <PayrollActionLoader
        phase="error"
        actionLabel="Generate Proof"
        errorMessage="Proof generation failed. Please retry."
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(
      screen.getByText(/proof generation failed\. please retry\./i),
    ).toBeInTheDocument();
  });

  it("renders fallback error text when errorMessage is not provided", () => {
    render(<PayrollActionLoader phase="error" actionLabel="Submit" />);
    expect(
      screen.getByText(
        /an error occurred\. check the details above and try again\./i,
      ),
    ).toBeInTheDocument();
  });

  it("does not expose raw salary amounts in error message (safety check)", () => {
    render(
      <PayrollActionLoader
        phase="error"
        actionLabel="Submit"
        errorMessage="Submission failed. No funds have been moved."
      />,
    );
    // The rendered text should not contain dollar amounts
    const alert = screen.getByRole("alert");
    expect(alert.textContent).not.toMatch(/\$\d/);
  });

  it("has a visually-hidden sr-only live region for screen readers", () => {
    render(
      <PayrollActionLoader phase="generating" actionLabel="Generate Proof" />,
    );
    // The sr-only div has role="status" and aria-live="assertive"
    const liveRegions = document.querySelectorAll('[aria-live="assertive"]');
    expect(liveRegions.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── getPayrollButtonAriaLabel ────────────────────────────────────────────────

describe("getPayrollButtonAriaLabel", () => {
  const PHASES: Array<[PayrollLoadingPhase, string]> = [
    ["idle", "Generate Proof"],
    ["generating", "Generate Proof — in progress, please wait"],
    ["submitting", "Generate Proof — in progress, please wait"],
    ["success", "Generate Proof — completed"],
    ["error", "Generate Proof — failed, activate to retry"],
  ];

  it.each(PHASES)("returns correct label for phase=%s", (phase, expected) => {
    expect(getPayrollButtonAriaLabel("Generate Proof", phase)).toBe(expected);
  });
});

// ─── usePayrollLoadingAnnouncer ───────────────────────────────────────────────

describe("usePayrollLoadingAnnouncer (via PayrollActionLoader sr-only region)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("populates the live region text for generating phase", () => {
    render(<PayrollActionLoader phase="generating" actionLabel="Test" />);
    const liveRegion = document.querySelector(
      ".sr-only[aria-live='assertive']",
    );
    expect(liveRegion?.textContent).toBe(
      "Generating zero-knowledge proof. Please wait.",
    );
  });

  it("populates the live region text for submitting phase", () => {
    render(<PayrollActionLoader phase="submitting" actionLabel="Test" />);
    const liveRegion = document.querySelector(
      ".sr-only[aria-live='assertive']",
    );
    expect(liveRegion?.textContent).toBe(
      "Submitting payroll transaction. Please wait.",
    );
  });

  it("populates the live region with success message for success phase", () => {
    render(<PayrollActionLoader phase="success" actionLabel="Test" />);
    const liveRegion = document.querySelector(
      ".sr-only[aria-live='assertive']",
    );
    expect(liveRegion?.textContent).toBe("Action completed successfully.");
  });

  it("populates the live region with error message for error phase", () => {
    render(<PayrollActionLoader phase="error" actionLabel="Test" />);
    const liveRegion = document.querySelector(
      ".sr-only[aria-live='assertive']",
    );
    expect(liveRegion?.textContent).toBe(
      "Action failed. Review the error message below and try again.",
    );
  });

  it("clears the live region after 4 s on success", () => {
    render(<PayrollActionLoader phase="success" actionLabel="Test" />);
    const liveRegion = document.querySelector(
      ".sr-only[aria-live='assertive']",
    );
    expect(liveRegion?.textContent).not.toBe("");

    act(() => {
      vi.advanceTimersByTime(4001);
    });

    expect(liveRegion?.textContent).toBe("");
  });

  it("clears the live region after 4 s on error", () => {
    render(<PayrollActionLoader phase="error" actionLabel="Test" />);
    const liveRegion = document.querySelector(
      ".sr-only[aria-live='assertive']",
    );
    expect(liveRegion?.textContent).not.toBe("");

    act(() => {
      vi.advanceTimersByTime(4001);
    });

    expect(liveRegion?.textContent).toBe("");
  });
});
