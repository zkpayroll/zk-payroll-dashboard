import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { normalizeAssetSymbol } from "@/lib/assets/normalizeAssetSymbol";
import { AssetSymbolInput, AssetSymbolWarning } from "@/components/features/assets/AssetSymbolInput";

describe("normalizeAssetSymbol", () => {
  it("normalizes lowercase with spaces (success path)", () => {
    const result = normalizeAssetSymbol(" usdc ");
    expect(result.normalized).toBe("USDC");
    expect(result.wasNormalized).toBe(true);
    expect(result.warningMessage).toContain("USDC");
    expect(result.isValid).toBe(true);
  });

  it("fails validation for invalid characters (failure path)", () => {
    const result = normalizeAssetSymbol("!!!");
    expect(result.isValid).toBe(false);
    expect(result.validationError).toContain("alphanumeric");
  });

  it("handles inner spaces removal (edge case)", () => {
    const result = normalizeAssetSymbol("TEST 123");
    expect(result.normalized).toBe("TEST123");
    expect(result.wasNormalized).toBe(true);
    expect(result.warningMessage).not.toBeNull();
  });

  it("does not warn when already normalized", () => {
    const result = normalizeAssetSymbol("USDC");
    expect(result.wasNormalized).toBe(false);
    expect(result.warningMessage).toBeNull();
  });

  it("privacy: never returns salary amounts", () => {
    const result = normalizeAssetSymbol("usdc");
    expect(result.normalized).not.toContain("$");
  });
});

describe("AssetSymbolWarning", () => {
  it("shows warning when normalized", () => {
    render(<AssetSymbolWarning raw=" usdc " />);
    expect(screen.getByTestId("asset-symbol-warning")).toBeInTheDocument();
    expect(screen.getByText(/trimmed|normalized|Spaces/)).toBeInTheDocument();
  });

  it("does not show warning when not normalized", () => {
    const { container } = render(<AssetSymbolWarning raw="USDC" />);
    expect(screen.queryByTestId("asset-symbol-warning")).not.toBeInTheDocument();
    expect(container.innerHTML).toBe("");
  });
});

describe("AssetSymbolInput component", () => {
  function TestWrapper({ initial = "" }: { initial?: string }) {
    const [value, setValue] = useState(initial);
    return <AssetSymbolInput value={value} onChange={(raw) => setValue(raw)} />;
  }

  it("shows warning after user types lowercase with spaces", async () => {
    render(<TestWrapper initial="usdc" />);
    const input = screen.getByTestId("asset-symbol-input");
    fireEvent.change(input, { target: { value: " usdc " } });
    fireEvent.blur(input);
    expect(await screen.findByTestId("asset-symbol-warning")).toBeInTheDocument();
    expect(screen.getByText(/normalized/)).toBeInTheDocument();
  });

  it("shows validation error for invalid symbol", async () => {
    render(<TestWrapper initial="" />);
    const input = screen.getByTestId("asset-symbol-input");
    fireEvent.change(input, { target: { value: "!!!" } });
    fireEvent.blur(input);
    expect(await screen.findByText(/alphanumeric/)).toBeInTheDocument();
  });
});

import { useState } from "react";
