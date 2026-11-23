import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { verifyPayrollNoteHash } from "@/lib/payroll/noteHash";
import PayrollVerificationForm from "@/components/features/payroll/PayrollVerificationForm";

describe("payroll note hash verification", () => {
  it("accepts a matching SHA-256 digest, including an optional 0x prefix", async () => {
    const result = await verifyPayrollNoteHash(
      "payroll note",
      "0x" + "140885189280c08c85413a3041aff8fb93406fcf552e1185ea348a494ddadd3c",
    );

    expect(result.status).toBe("match");
  });

  it("rejects a valid digest when the note differs", async () => {
    const result = await verifyPayrollNoteHash(
      "changed note",
      "140885189280c08c85413a3041aff8fb93406fcf552e1185ea348a494ddadd3c",
    );

    expect(result.status).toBe("mismatch");
  });

  it("uses the same leading and trailing whitespace normalization as the payroll note hasher", async () => {
    const result = await verifyPayrollNoteHash(
      "  payroll note\n",
      "0x140885189280c08c85413a3041aff8fb93406fcf552e1185ea348a494ddadd3c",
    );

    expect(result.status).toBe("match");
  });

  it("rejects malformed expected hashes without hashing", async () => {
    await expect(verifyPayrollNoteHash("note", "not-a-hash")).resolves.toEqual({
      status: "invalid-hash",
    });
  });

  it("shows success and mismatch results in the verification form", async () => {
    const digest = "140885189280c08c85413a3041aff8fb93406fcf552e1185ea348a494ddadd3c";
    render(<PayrollVerificationForm />);

    fireEvent.change(screen.getByLabelText("Payroll note"), {
      target: { value: "payroll note" },
    });
    fireEvent.change(screen.getByLabelText("Expected SHA-256 hash"), {
      target: { value: digest },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify note hash" }));
    expect(await screen.findByText("Note matches the expected SHA-256 hash.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Payroll note"), {
      target: { value: "different note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify note hash" }));
    expect(await screen.findByText("Note does not match the expected SHA-256 hash.")).toBeInTheDocument();
  });

  it("keeps the verify button disabled for incomplete or malformed input", () => {
    render(<PayrollVerificationForm />);
    const button = screen.getByRole("button", { name: "Verify note hash" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Payroll note"), {
      target: { value: "note" },
    });
    fireEvent.change(screen.getByLabelText("Expected SHA-256 hash"), {
      target: { value: "bad" },
    });
    expect(button).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/64-character SHA-256/);
  });
});
