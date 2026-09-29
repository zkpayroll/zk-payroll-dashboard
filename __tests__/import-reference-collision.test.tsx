import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  checkImportReferenceCollision,
  normalizeImportReference,
} from "@/lib/validation/importReferenceCollision";
import { ImportReferenceCollisionWarning } from "@/components/features/employees/ImportReferenceCollisionWarning";

describe("checkImportReferenceCollision unit tests", () => {
  it("normalizes input references correctly (trimmed and collapsed)", () => {
    expect(normalizeImportReference(" IMP-2025-001 ")).toBe("IMP-2025-001");
    expect(normalizeImportReference("IMP 2025 001")).toBe("IMP2025001");
  });

  it("returns no collision when reference is unique (success path)", () => {
    const result = checkImportReferenceCollision("IMP-2025-002", ["IMP-2025-001"]);
    expect(result.isCollision).toBe(false);
    expect(result.warningMessage).toBeNull();
  });

  it("detects case-insensitive duplicate collision (edge case)", () => {
    const result = checkImportReferenceCollision("imp-2025-001", ["IMP-2025-001"]);
    expect(result.isCollision).toBe(true);
    expect(result.warningMessage).toMatch(/has already been processed/i);
    expect(result.warningMessage).toMatch(/imp-2025-001/i);
  });

  it("maintains privacy: warning message never leaks salary or financial terms", () => {
    const result = checkImportReferenceCollision("IMP-2025-001", ["IMP-2025-001"]);
    expect(result.warningMessage).not.toMatch(/salary/i);
    expect(result.warningMessage).not.toMatch(/\$/);
  });
});

describe("ImportReferenceCollisionWarning component tests", () => {
  it("renders nothing when there is no collision", () => {
    const { container } = render(
      <ImportReferenceCollisionWarning
        importReference="IMP-NEW"
        existingReferences={["IMP-OLD"]}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders warning banner when collision is detected", () => {
    render(
      <ImportReferenceCollisionWarning
        importReference="IMP-2025-001"
        existingReferences={["IMP-2025-001"]}
      />
    );

    const banner = screen.getByTestId("import-reference-collision-warning");
    expect(banner).toBeInTheDocument();
    expect(screen.getByText(/Import Reference Collision Warning/i)).toBeInTheDocument();
    expect(screen.getByText("IMP-2025-001")).toBeInTheDocument();
  });

  it("invokes callback when action button is clicked", () => {
    const onAction = vi.fn();
    render(
      <ImportReferenceCollisionWarning
        importReference="IMP-2025-001"
        existingReferences={["IMP-2025-001"]}
        onUseUniqueReference={onAction}
      />
    );

    const btn = screen.getByRole("button", { name: /Assign Unique Reference/i });
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("guarantees privacy: component text does not contain salary values", () => {
    render(
      <ImportReferenceCollisionWarning
        importReference="IMP-2025-001"
        existingReferences={["IMP-2025-001"]}
      />
    );
    expect(document.body.textContent).not.toMatch(/\$\s*\d/);
    expect(document.body.textContent).not.toMatch(/5000|10000/);
  });
});
