import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SupportedAssetsEmptyState from "@/components/features/assets/SupportedAssetsEmptyState";
import { hasSupportedPayrollAssets, formatSupportedAssetsList, SUPPORTED_PAYROLL_ASSETS } from "@/lib/assets/supportedAssets";
import TreasuryView from "@/components/features/treasury/TreasuryView";
import EmptyState, { EMPTY_STATE_COPY } from "@/components/ui/EmptyState";

describe("hasSupportedPayrollAssets", () => {
  it("returns false when no assets configured (failure — payroll blocked)", () => {
    expect(hasSupportedPayrollAssets([])).toBe(false);
    expect(hasSupportedPayrollAssets(null)).toBe(false);
    expect(hasSupportedPayrollAssets(undefined)).toBe(false);
  });

  it("returns true when at least one supported asset configured (success)", () => {
    expect(hasSupportedPayrollAssets([{ code: "USDC" }])).toBe(true);
    expect(hasSupportedPayrollAssets([{ code: "XLM" }])).toBe(true);
    expect(hasSupportedPayrollAssets([{ code: "usdc" }])).toBe(true); // case-insensitive
  });

  it("edge: unsupported asset alone does not satisfy requirement", () => {
    expect(hasSupportedPayrollAssets([{ code: "FAKE" }])).toBe(false);
    expect(hasSupportedPayrollAssets([{ code: "USDC" }, { code: "FAKE" }])).toBe(true);
  });

  it("privacy: helper never exposes salary values", () => {
    expect(formatSupportedAssetsList()).not.toContain("$");
    expect(formatSupportedAssetsList()).toBe(SUPPORTED_PAYROLL_ASSETS.map((a) => a.code).join(", "));
  });
});

describe("EmptyState catalog for supported assets", () => {
  it("defines actionable copy for supported-assets-empty", () => {
    const copy = EMPTY_STATE_COPY["supported-assets-empty"];
    expect(copy.title).toMatch(/No supported payroll assets/i);
    expect(copy.description).toMatch(/Payroll creation is blocked/i);
    expect(copy.actionLabel).toBeDefined();
  });

  it("defines treasury-assets-empty variant", () => {
    const copy = EMPTY_STATE_COPY["treasury-assets-empty"];
    expect(copy.title).toMatch(/No treasury assets/i);
    expect(copy.description).toMatch(/No supported payroll assets/i);
  });

  it("defines settings-assets-empty variant", () => {
    const copy = EMPTY_STATE_COPY["settings-assets-empty"];
    expect(copy.title).toMatch(/No payroll assets configured/i);
  });

  it("renders generic EmptyState for supported-assets-empty screen", () => {
    render(<EmptyState screen="supported-assets-empty" action={{ label: "Configure assets", href: "/settings/assets" }} />);
    expect(screen.getByText(/No supported payroll assets configured/i)).toBeInTheDocument();
    expect(screen.getByText(/Payroll creation is blocked/i)).toBeInTheDocument();
  });
});

describe("SupportedAssetsEmptyState component", () => {
  it("shows empty state when no assets configured (failure path — blocked)", () => {
    render(<SupportedAssetsEmptyState configuredAssets={[]} variant="settings" />);
    expect(screen.getByTestId("supported-assets-empty")).toBeInTheDocument();
    expect(screen.getByText(/No payroll assets configured/i)).toBeInTheDocument();
    // Note div uses role="note"
    expect(screen.getByRole("note")).toHaveTextContent(/Payroll batches cannot be created/i);
    const cta = screen.getByRole("link", { name: /Add supported asset|Configure/i });
    expect(cta).toHaveAttribute("href", "/settings/assets");
  });

  it("shows treasury variant with correct CTA", () => {
    render(<SupportedAssetsEmptyState configuredAssets={[]} variant="treasury" />);
    expect(screen.getByText(/No treasury assets configured/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configure treasury assets/i })).toHaveAttribute("href", "/treasury");
  });

  it("renders nothing when supported assets are present (success path)", () => {
    const { container } = render(<SupportedAssetsEmptyState configuredAssets={[{ code: "USDC" }]} />);
    expect(container.innerHTML).toBe("");
    expect(screen.queryByTestId("supported-assets-empty")).not.toBeInTheDocument();
  });

  it("handles null/undefined as empty (edge)", () => {
    const { container } = render(<SupportedAssetsEmptyState configuredAssets={null as any} />);
    expect(screen.getByTestId("supported-assets-empty")).toBeInTheDocument();
    expect(container.innerHTML).not.toBe("");
  });

  it("compact variant shows inline status", () => {
    render(<SupportedAssetsEmptyState configuredAssets={[]} variant="generic" compact />);
    expect(screen.getByTestId("supported-assets-empty-compact")).toBeInTheDocument();
    expect(screen.getByText(/Payroll creation is blocked/i)).toBeInTheDocument();
  });

  it("privacy: never shows salary amounts (redacted)", () => {
    render(<SupportedAssetsEmptyState configuredAssets={[]} />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\$\s*\d/);
    // Privacy note mentions "salary values are exposed" but does not leak actual amounts/commitments
    expect(text).not.toMatch(/0xabc123/);
    expect(text).not.toMatch(/5000|9500/);
  });
});

describe("TreasuryView integration", () => {
  it("shows empty state when configuredAssets is empty (blocked)", () => {
    render(<TreasuryView configuredAssets={[]} />);
    expect(screen.getByTestId("supported-assets-empty")).toBeInTheDocument();
    expect(screen.getByText(/No treasury assets configured/i)).toBeInTheDocument();
  });

  it("does not show empty state when assets are present (success)", () => {
    render(<TreasuryView configuredAssets={[{ code: "USDC" }]} />);
    expect(screen.queryByTestId("supported-assets-empty")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Treasury" })).toBeInTheDocument();
  });
});
