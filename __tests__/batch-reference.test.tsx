import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  validateBatchReference,
  validateBatchReferenceWithDuplicateCheck,
  normalizeBatchReference,
  BATCH_REFERENCE_FORMAT_HINT,
  isDuplicateBatchReference,
} from "@/lib/validation/batchReference";
import BatchReferenceInput from "@/components/features/payroll/BatchReferenceInput";

// ── Validation unit tests ───────────────────────────────────────────────────

describe("normalizeBatchReference", () => {
  it("trims surrounding whitespace and strips inner whitespace (success path)", () => {
    expect(normalizeBatchReference(" BATCH-2025-001 ")).toBe("BATCH-2025-001");
    expect(normalizeBatchReference("BATCH 2025 001")).toBe("BATCH2025001");
    expect(normalizeBatchReference(" payroll_q1_2025 ")).toBe("payroll_q1_2025");
  });
});

describe("validateBatchReference", () => {
  it("accepts valid references (success path)", () => {
    const ok = validateBatchReference("BATCH-2025-001");
    expect(ok.isValid).toBe(true);
    expect(ok.normalized).toBe("BATCH-2025-001");
    expect(ok.message).toBeNull();

    expect(validateBatchReference("payroll_q1_2025").isValid).toBe(true);
    expect(validateBatchReference("EXT-REF.2025.03").isValid).toBe(true);
    expect(validateBatchReference("abc").isValid).toBe(true); // minimum 3 chars
  });

  it("rejects empty and too-short values (failure path)", () => {
    expect(validateBatchReference("").isValid).toBe(false);
    expect(validateBatchReference("").message).toMatch(/required/i);
    expect(validateBatchReference("a").isValid).toBe(false);
    expect(validateBatchReference("ab").message).toMatch(/at least 3 characters/i);
    expect(validateBatchReference("  ").normalized).toBe("");
  });

  it("rejects too-long values (failure path)", () => {
    const long = "A".repeat(33);
    const result = validateBatchReference(long);
    expect(result.isValid).toBe(false);
    expect(result.message).toMatch(/32 characters or fewer/i);
  });

  it("rejects malformed characters (failure — malformed identifier)", () => {
    expect(validateBatchReference("!!").isValid).toBe(false); // too short anyway
    expect(validateBatchReference("!!! invalid").isValid).toBe(false);
    expect(validateBatchReference("BATCH@001").isValid).toBe(false);
    expect(validateBatchReference("-BADSTART").isValid).toBe(false); // must start alphanumeric
    // Spaces are stripped by normalizeBatchReference, so "BATCH 001" becomes "BATCH001" and is valid — not malformed
    expect(validateBatchReference("BATCH 001").isValid).toBe(true);
    expect(validateBatchReference("BATCH 001 ").normalized).toBe("BATCH001"); // after normalize, it's valid
    // True malformed: symbols
    expect(validateBatchReference("$$##").isValid).toBe(false);
  });

  it("edge: pasted value with newlines and spaces is normalized before validation", () => {
    const result = validateBatchReference(" BATCH\n2025\r001 ");
    expect(result.normalized).toBe("BATCH2025001");
    expect(result.isValid).toBe(true);
  });

  it("privacy: helper hint never mentions salary", () => {
    expect(BATCH_REFERENCE_FORMAT_HINT).not.toMatch(/salary/i);
    expect(BATCH_REFERENCE_FORMAT_HINT).not.toMatch(/\$/);
  });
});

describe("isDuplicateBatchReference", () => {
  it("detects exact duplicates (failure — duplicate guidance)", () => {
    expect(isDuplicateBatchReference("BATCH-2025-001", ["BATCH-2025-001", "tx_001"])).toBe(true);
  });

  it("detects case-insensitive duplicates (edge)", () => {
    expect(isDuplicateBatchReference("batch-2025-001", ["BATCH-2025-001"])).toBe(true);
    expect(isDuplicateBatchReference("BATCH-2025-001", ["batch-2025-001"])).toBe(true);
  });

  it("trims before comparing (edge — paste artifact)", () => {
    expect(isDuplicateBatchReference(" BATCH-2025-001 ", ["BATCH-2025-001"])).toBe(true);
  });

  it("returns false when not duplicate (success)", () => {
    expect(isDuplicateBatchReference("BATCH-2025-999", ["BATCH-2025-001"])).toBe(false);
    expect(isDuplicateBatchReference("", ["BATCH-2025-001"])).toBe(false);
  });
});

describe("validateBatchReferenceWithDuplicateCheck", () => {
  it("success: valid and unique", () => {
    const result = validateBatchReferenceWithDuplicateCheck("BATCH-2025-042", ["BATCH-2025-001"]);
    expect(result.isValid).toBe(true);
    expect(result.isDuplicate).toBe(false);
  });

  it("failure: duplicate triggers specific message", () => {
    const result = validateBatchReferenceWithDuplicateCheck("BATCH-2025-001", ["BATCH-2025-001", "tx_001"]);
    expect(result.isValid).toBe(false);
    expect(result.isDuplicate).toBe(true);
    expect(result.message).toMatch(/already in use/i);
    expect(result.message).toMatch(/unique identifier/i);
  });

  it("failure: malformed still fails even before duplicate check", () => {
    const result = validateBatchReferenceWithDuplicateCheck("!!", ["BATCH-2025-001"]);
    expect(result.isValid).toBe(false);
    expect(result.isDuplicate).toBeUndefined();
  });
});

// ── Component tests ────────────────────────────────────────────────────────

describe("BatchReferenceInput component", () => {
  function Wrapper({ initial = "", existing = [] as string[] }) {
    const [value, setValue] = useState(initial);
    return <BatchReferenceInput value={value} onChange={setValue} existingReferences={existing} />;
  }

  it("shows helper copy by default (guidance)", () => {
    render(<Wrapper />);
    expect(screen.getByTestId("batch-reference-hint")).toBeInTheDocument();
    expect(screen.getByText(/3–32 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/letters, numbers/i)).toBeInTheDocument();
  });

  it("shows valid state after entering a correct reference (success path)", async () => {
    render(<Wrapper existing={["BATCH-2025-001"]} />);
    const input = screen.getByTestId("batch-reference-input");
    fireEvent.change(input, { target: { value: "BATCH-2025-042" } });
    fireEvent.blur(input);
    expect(await screen.findByTestId("batch-reference-valid")).toBeInTheDocument();
    expect(screen.getByText(/Will be submitted as/i)).toBeInTheDocument();
    expect(screen.getByText("BATCH-2025-042")).toBeInTheDocument();
  });

  it("shows malformed error for too-short input (failure path)", async () => {
    render(<Wrapper />);
    const input = screen.getByTestId("batch-reference-input");
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.blur(input);
    expect(await screen.findByTestId("batch-reference-error")).toBeInTheDocument();
    expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
  });

  it("shows duplicate error when reference already exists (failure — duplicate guidance)", async () => {
    render(<Wrapper existing={["BATCH-2025-001", "tx_001"]} />);
    const input = screen.getByTestId("batch-reference-input");
    fireEvent.change(input, { target: { value: "BATCH-2025-001" } });
    fireEvent.blur(input);
    expect(await screen.findByTestId("batch-reference-error")).toBeInTheDocument();
    expect(screen.getByText(/already in use/i)).toBeInTheDocument();
    expect(screen.getByText(/unique identifier/i)).toBeInTheDocument();
  });

  it("edge: trims pasted whitespace before validation", async () => {
    render(<Wrapper existing={["BATCH-2025-001"]} />);
    const input = screen.getByTestId("batch-reference-input") as HTMLInputElement;
    // Simulate paste: component normalizes via onPaste handler, but change also normalizes on validate
    fireEvent.change(input, { target: { value: " BATCH-2025-042 " } });
    fireEvent.blur(input);
    // After blur, validation normalizes and should be valid (unique)
    expect(await screen.findByTestId("batch-reference-valid")).toBeInTheDocument();
  });

  it("privacy: helper copy and valid message never show salary", () => {
    render(<Wrapper />);
    expect(document.body.textContent).not.toMatch(/\$\s*\d/);
    const input = screen.getByTestId("batch-reference-input");
    fireEvent.change(input, { target: { value: "BATCH-2025-042" } });
    fireEvent.blur(input);
    // No salary leaked after valid
    expect(document.body.textContent).not.toMatch(/5000|9500/);
  });
});

import { useState } from "react";
