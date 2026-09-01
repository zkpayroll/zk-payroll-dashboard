import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ReceiptDownloadFlow from "@/components/features/receipts/ReceiptDownloadFlow";
import {
  useReceiptDownloadStore,
  MOCK_RECEIPTS,
} from "@/stores/receipts";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ReceiptDownloadFlow", () => {
  beforeEach(() => {
    useReceiptDownloadStore.getState().reset();
  });

  it("renders the receipt download heading and default redacted mode", () => {
    render(<ReceiptDownloadFlow userRole="admin" />);

    expect(screen.getByText("Receipt Download")).toBeInTheDocument();
    expect(screen.getByText("Export payroll receipt data with privacy controls.")).toBeInTheDocument();
    expect(screen.getByTestId("step-select-mode")).toBeInTheDocument();
  });

  it("defaults to redacted export mode selected", () => {
    render(<ReceiptDownloadFlow userRole="admin" />);

    const redactedRadio = screen.getByTestId("mode-redacted");
    expect(redactedRadio).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Redacted Export")).toBeInTheDocument();
  });

  it("shows restricted badge for modes the user cannot access", () => {
    render(<ReceiptDownloadFlow userRole="auditor" />);

    const fullRadio = screen.getByTestId("mode-full");
    expect(fullRadio).toBeDisabled();
    expect(fullRadio.textContent).toContain("Restricted");
  });

  it("auditor cannot select full mode and sees restricted badge", () => {
    render(<ReceiptDownloadFlow userRole="auditor" />);

    const fullRadio = screen.getByTestId("mode-full");
    expect(fullRadio).toBeDisabled();
    expect(fullRadio.textContent).toContain("Restricted");
    expect(fullRadio).toHaveAttribute("aria-checked", "false");
  });

  it("blocks auditor from proceeding with full admin export", () => {
    render(<ReceiptDownloadFlow userRole="auditor" />);

    const fullRadio = screen.getByTestId("mode-full");
    expect(fullRadio).toBeDisabled();

    expect(screen.getByTestId("mode-redacted")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("proceed-from-mode")).not.toBeDisabled();
  });

  it("allows admin to select audit-scoped mode and proceeds to disclosure step", () => {
    render(<ReceiptDownloadFlow userRole="admin" />);

    fireEvent.click(screen.getByTestId("mode-audit-scoped"));
    expect(screen.getByTestId("mode-audit-scoped")).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByTestId("proceed-from-mode"));
    expect(screen.getByTestId("step-disclosure")).toBeInTheDocument();
  });

  it("shows disclosure warning for audit-scoped export", () => {
    render(<ReceiptDownloadFlow userRole="admin" />);

    fireEvent.click(screen.getByTestId("mode-audit-scoped"));
    fireEvent.click(screen.getByTestId("proceed-from-mode"));

    expect(screen.getByText("Disclosure Warning")).toBeInTheDocument();
    expect(screen.getByText(/commitment hashes/)).toBeInTheDocument();
    expect(screen.getByText(/data classification/)).toBeInTheDocument();
  });

  it("acknowledges disclosure and proceeds to confirm step", () => {
    render(<ReceiptDownloadFlow userRole="admin" />);

    fireEvent.click(screen.getByTestId("mode-audit-scoped"));
    fireEvent.click(screen.getByTestId("proceed-from-mode"));
    fireEvent.click(screen.getByTestId("acknowledge-disclosure"));

    expect(screen.getByTestId("step-confirm")).toBeInTheDocument();
    expect(screen.getByText("Confirm download")).toBeInTheDocument();
  });

  it("skips disclosure step for redacted export and goes straight to confirm", () => {
    render(<ReceiptDownloadFlow userRole="operator" />);

    expect(screen.getByTestId("mode-redacted")).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByTestId("proceed-from-mode"));

    expect(screen.getByTestId("step-confirm")).toBeInTheDocument();
    expect(screen.queryByTestId("step-disclosure")).not.toBeInTheDocument();
  });

  it("completes the full redacted download flow", async () => {
    vi.useFakeTimers();

    render(<ReceiptDownloadFlow userRole="operator" />);

    fireEvent.click(screen.getByTestId("proceed-from-mode"));
    expect(screen.getByTestId("step-confirm")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("download-receipt"));

    await vi.advanceTimersByTimeAsync(1500);

    expect(screen.getByTestId("step-complete")).toBeInTheDocument();
    expect(screen.getByText("Download complete")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("allows navigation back from confirm to mode selection for redacted", () => {
    render(<ReceiptDownloadFlow userRole="operator" />);

    fireEvent.click(screen.getByTestId("proceed-from-mode"));
    expect(screen.getByTestId("step-confirm")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("back-from-confirm"));
    expect(screen.getByTestId("step-select-mode")).toBeInTheDocument();
  });

  it("allows navigation back from disclosure to mode selection", () => {
    render(<ReceiptDownloadFlow userRole="admin" />);

    fireEvent.click(screen.getByTestId("mode-audit-scoped"));
    fireEvent.click(screen.getByTestId("proceed-from-mode"));
    expect(screen.getByTestId("step-disclosure")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("back-to-mode"));
    expect(screen.getByTestId("step-select-mode")).toBeInTheDocument();
  });

  it("shows role label in confirm step summary", () => {
    render(<ReceiptDownloadFlow userRole="auditor" />);

    fireEvent.click(screen.getByTestId("proceed-from-mode"));

    expect(screen.getByText("Auditor")).toBeInTheDocument();
  });

  it("hides receipt ID by default and reveals on toggle", () => {
    render(<ReceiptDownloadFlow userRole="admin" />);

    expect(screen.getByText("rcpt_2****")).toBeInTheDocument();

    const toggleButton = screen.getByRole("button", { name: /reveal receipt id/i });
    fireEvent.click(toggleButton);

    expect(screen.getByText(MOCK_RECEIPTS[0].receiptId)).toBeInTheDocument();
  });

  it("resets the flow when start new download is clicked", async () => {
    vi.useFakeTimers();

    render(<ReceiptDownloadFlow userRole="operator" />);

    fireEvent.click(screen.getByTestId("proceed-from-mode"));
    fireEvent.click(screen.getByTestId("download-receipt"));

    await vi.advanceTimersByTimeAsync(1500);

    expect(screen.getByTestId("step-complete")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("start-new-download"));
    expect(screen.getByTestId("step-select-mode")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("displays full admin export disclosure warning for admin choosing full mode", () => {
    render(<ReceiptDownloadFlow userRole="admin" />);

    fireEvent.click(screen.getByTestId("mode-full"));
    fireEvent.click(screen.getByTestId("proceed-from-mode"));

    expect(screen.getByText(/unredacted payroll data/)).toBeInTheDocument();
    expect(screen.getByText(/audit trail/)).toBeInTheDocument();
  });
});
