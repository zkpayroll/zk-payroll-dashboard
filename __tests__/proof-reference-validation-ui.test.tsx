import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { ProofReferenceInput } from "@/components/features/proofs/ProofReferenceInput";
import PayrollVerificationForm from "@/components/features/payroll/PayrollVerificationForm";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function ControlledInput({ onValidityChange }: { onValidityChange?: (valid: boolean) => void }) {
  const [value, setValue] = React.useState("");
  return (
    <ProofReferenceInput value={value} onChange={setValue} onValidityChange={onValidityChange} />
  );
}

describe("ProofReferenceInput guidance", () => {
  it("shows what a valid reference looks like before the user types anything", () => {
    render(<ControlledInput />);
    const input = screen.getByLabelText("Proof reference");
    const described = document.getElementById(input.getAttribute("aria-describedby") ?? "");
    expect(described).not.toBeNull();
    expect(described?.textContent).toContain("zkp_ref_YYYYMMDD_NNN");
    expect(described?.textContent).toContain("Re-copy the full reference");
  });

  it("shows an actionable error after blur and links it to the field", () => {
    render(<ControlledInput />);
    const input = screen.getByLabelText("Proof reference");
    fireEvent.change(input, { target: { value: "zkp_ref_2025" } });
    fireEvent.blur(input);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Invalid proof reference");
    expect(alert.textContent).toContain("Re-copy the full reference");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(alert.id);
  });

  it("keeps private-looking input out of the rendered error", () => {
    render(<ControlledInput />);
    const input = screen.getByLabelText("Proof reference");
    fireEvent.change(input, { target: { value: "salary 84000 EMP-77" } });
    fireEvent.blur(input);

    const text = document.body.textContent ?? "";
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(text).not.toContain("84000");
    expect(text).not.toContain("EMP-77");
  });

  it("clears the error and reports validity once a valid reference is entered", () => {
    const onValidityChange = vi.fn();
    render(<ControlledInput onValidityChange={onValidityChange} />);
    const input = screen.getByLabelText("Proof reference");
    fireEvent.change(input, { target: { value: "zkp_ref_2025" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "zkp_ref_20250228_001" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });

  it("normalizes a pasted reference with stray whitespace before validating", () => {
    const onValidityChange = vi.fn();
    render(<ControlledInput onValidityChange={onValidityChange} />);
    const input = screen.getByLabelText("Proof reference") as HTMLInputElement;
    fireEvent.paste(input, {
      clipboardData: { getData: () => "  ZKP_REF_20250228_001\n" },
    });
    expect(input.value).toBe("zkp_ref_20250228_001");
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });
});

describe("PayrollVerificationForm proof submit", () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockClear();
  });

  it("blocks an invalid submit with a visible, actionable message", () => {
    const { container } = render(<PayrollVerificationForm />);
    const input = screen.getByLabelText("Proof reference");
    fireEvent.change(input, { target: { value: "not-a-reference" } });

    const form = container.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText(/Invalid proof reference/)).toBeInTheDocument();
    expect(screen.queryByText(/Last verified:/)).toBeNull();
  });

  it("verifies a valid reference and clears any earlier submit error", () => {
    const { container } = render(<PayrollVerificationForm />);
    const input = screen.getByLabelText("Proof reference");
    const form = container.querySelector("form") as HTMLFormElement;

    fireEvent.change(input, { target: { value: "bad" } });
    fireEvent.submit(form);
    expect(screen.getByText(/Invalid proof reference/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "zkp_ref_20250228_001" } });
    expect(screen.queryByText(/Invalid proof reference/)).toBeNull();

    fireEvent.submit(form);
    expect(toast.success).toHaveBeenCalledWith("Proof reference verified", {
      description: "zkp_ref_20250228_001",
    });
  });
});
