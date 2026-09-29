import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuditHoldReleaseDialog } from "@/components/features/compliance/AuditHoldReleaseDialog";

const hold = {
  id: "hold_1",
  reasonCode: "AUDIT_REVIEW",
  targetLabel: "Current Compliance Period",
  placedAt: "2026-09-01T10:00:00.000Z",
};

function setup(onConfirm = vi.fn().mockResolvedValue(undefined), onClose = vi.fn()) {
  render(<AuditHoldReleaseDialog isOpen hold={hold} onClose={onClose} onConfirm={onConfirm} />);
  return { onConfirm, onClose };
}

describe("AuditHoldReleaseDialog (#543)", () => {
  it("renders nothing when closed or without a hold", () => {
    const { container } = render(
      <AuditHoldReleaseDialog isOpen={false} hold={hold} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows what is being released and keeps Release disabled until note + acknowledgement", () => {
    setup();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("AUDIT_REVIEW");
    const release = screen.getByRole("button", { name: "Release Hold" });
    expect(release).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Release justification/), {
      target: { value: "Auditor confirmed resolution" },
    });
    expect(release).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(release).toBeEnabled();
  });

  it("submits the trimmed release note for the hold", async () => {
    const { onConfirm } = setup();
    fireEvent.change(screen.getByLabelText(/Release justification/), {
      target: { value: "  Auditor confirmed resolution  " },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Release Hold" }));
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith({ holdId: "hold_1", releaseNote: "Auditor confirmed resolution" }),
    );
  });

  it("keeps a too-short note disabled", () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Release justification/), { target: { value: "ok" } });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Release Hold" })).toBeDisabled();
  });

  it("shows an actionable error when release fails, and stays open", async () => {
    setup(vi.fn().mockRejectedValue(new Error("This hold has already been released.")));
    fireEvent.change(screen.getByLabelText(/Release justification/), {
      target: { value: "Auditor confirmed resolution" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Release Hold" }));
    expect(await screen.findByText("This hold has already been released.")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("closes on Escape and on Cancel", () => {
    const { onClose } = setup();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
