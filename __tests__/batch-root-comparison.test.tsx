import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BatchRootComparison from "@/components/features/reconciliation/BatchRootComparison";

const mockExpectedRoot = "0xabc123def4567890abcdef1234567890abcdef1234567890abcdef123456";
const mockObservedRoot = "0xabc123def4567890abcdef1234567890abcdef1234567890abcdef123456";
const mockDifferentObservedRoot = "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba098765";
const mockEventReference = "abc123def456ghi789jkl012";
const mockEventSource = "Soroban Executor Contract";

describe("BatchRootComparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("MATCH state", () => {
    it("renders match status badge with green styling", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockObservedRoot}
          eventSource={mockEventSource}
          eventReference={mockEventReference}
        />
      );

      expect(screen.getByText("Match")).toBeInTheDocument();
      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("bg-green-100");
      expect(badge).toHaveClass("text-green-800");
    });

    it("displays both expected and observed roots", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockObservedRoot}
        />
      );

      expect(screen.getByText("Expected Root")).toBeInTheDocument();
      expect(screen.getByText("Observed Root")).toBeInTheDocument();
      const rootElements = screen.getAllByText(mockExpectedRoot);
      expect(rootElements.length).toBe(2);
    });

    it("shows event source and reference", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockObservedRoot}
          eventSource={mockEventSource}
          eventReference={mockEventReference}
        />
      );

      expect(screen.getByText("Event Source")).toBeInTheDocument();
      expect(screen.getByText(mockEventSource)).toBeInTheDocument();
      expect(screen.getByText("Event Reference")).toBeInTheDocument();
      expect(screen.getByText(mockEventReference)).toBeInTheDocument();
    });

    it("shows explorer link when event reference exists", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockObservedRoot}
          eventReference={mockEventReference}
        />
      );

      const link = screen.getByRole("link", { name: /view transaction on stellar expert explorer/i });
      expect(link).toHaveAttribute("href", `https://stellar.expert/explorer/testnet/tx/${mockEventReference}`);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("does not show mismatch reason", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockObservedRoot}
        />
      );

      expect(screen.queryByText("Mismatch Detected")).not.toBeInTheDocument();
    });
  });

  describe("MISMATCH state", () => {
    it("renders mismatch status badge with red styling", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockDifferentObservedRoot}
        />
      );

      expect(screen.getByText("Mismatch")).toBeInTheDocument();
      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("bg-red-500");
      expect(badge).toHaveClass("text-gray-50");
    });

    it("shows mismatch reason with safe structural explanation", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockDifferentObservedRoot}
        />
      );

      expect(screen.getByText("Mismatch Detected")).toBeInTheDocument();
      expect(screen.getByText("Root hash differs — batch commitment does not match on-chain record")).toBeInTheDocument();
    });

    it("never displays individual salary amounts or employee data", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockDifferentObservedRoot}
        />
      );

      const text = screen.getByRole("region").textContent || "";
      expect(text).not.toMatch(/\$\d+/);
      expect(text).not.toMatch(/\d+\.\d{2}/);
      expect(text).not.toMatch(/Alice|Kwame|Amara|Kofi|Yaa/i);
      expect(text).not.toMatch(/emp_\d+/i);
    });

    it("shows privacy notice", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockDifferentObservedRoot}
        />
      );

      expect(screen.getByText(/Privacy notice:/i)).toBeInTheDocument();
      expect(screen.getByText(/Individual employee salaries/)).toBeInTheDocument();
    });
  });

  describe("PENDING state", () => {
    it("renders pending status badge with amber styling when only expected root exists", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={null}
        />
      );

      expect(screen.getByText("Pending")).toBeInTheDocument();
      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("bg-yellow-100");
      expect(badge).toHaveClass("text-yellow-800");
    });

    it("renders pending status badge when only observed root exists", () => {
      render(
        <BatchRootComparison
          expectedRoot={null}
          observedRoot={mockObservedRoot}
        />
      );

      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("shows pending explanation for missing observed root", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={null}
        />
      );

      expect(screen.getByText("Reconciliation Pending")).toBeInTheDocument();
      expect(screen.getByText(/Waiting for on-chain event/)).toBeInTheDocument();
    });

    it("shows pending explanation for missing expected root", () => {
      render(
        <BatchRootComparison
          expectedRoot={null}
          observedRoot={mockObservedRoot}
        />
      );

      expect(screen.getByText("Reconciliation Pending")).toBeInTheDocument();
      expect(screen.getByText(/Expected root not yet recorded/)).toBeInTheDocument();
    });

    it("does not show mismatch reason", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={null}
        />
      );

      expect(screen.queryByText("Mismatch Detected")).not.toBeInTheDocument();
    });

    it("clearly distinguishes from mismatch state", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={null}
        />
      );

      expect(screen.getByText("Pending")).toBeInTheDocument();
      expect(screen.queryByText("Mismatch")).not.toBeInTheDocument();
    });
  });

  describe("MISSING state", () => {
    it("renders missing status badge with gray styling when neither root exists", () => {
      render(
        <BatchRootComparison
          expectedRoot={null}
          observedRoot={null}
        />
      );

      expect(screen.getByText("Missing")).toBeInTheDocument();
      const badge = screen.getByRole("status");
      expect(badge).toHaveClass("bg-gray-900");
      expect(badge).toHaveClass("text-gray-50");
    });

    it("shows missing data explanation", () => {
      render(
        <BatchRootComparison
          expectedRoot={null}
          observedRoot={null}
        />
      );

      expect(screen.getByText("No Reconciliation Data")).toBeInTheDocument();
      expect(screen.getByText(/Neither expected nor observed root is available/)).toBeInTheDocument();
    });

    it("does not show mismatch or pending explanations", () => {
      render(
        <BatchRootComparison
          expectedRoot={null}
          observedRoot={null}
        />
      );

      expect(screen.queryByText("Mismatch Detected")).not.toBeInTheDocument();
      expect(screen.queryByText("Reconciliation Pending")).not.toBeInTheDocument();
    });
  });

  describe("Copy to clipboard", () => {
    it("copies expected root when copy button clicked", async () => {
      const mockWriteText = vi.fn();
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText },
      });

      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockObservedRoot}
        />
      );

      const copyButtons = screen.getAllByRole("button", { name: /copy expected root/i });
      expect(copyButtons.length).toBeGreaterThan(0);

      await userEvent.click(copyButtons[0]);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(mockExpectedRoot);
      });
    });

    it("copies observed root when copy button clicked", async () => {
      const mockWriteText = vi.fn();
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText },
      });

      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockObservedRoot}
        />
      );

      const copyButtons = screen.getAllByRole("button", { name: /copy observed root/i });
      expect(copyButtons.length).toBeGreaterThan(0);

      await userEvent.click(copyButtons[0]);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(mockObservedRoot);
      });
    });

    it("copies event reference when copy button clicked", async () => {
      const mockWriteText = vi.fn();
      Object.assign(navigator, {
        clipboard: { writeText: mockWriteText },
      });

      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockObservedRoot}
          eventReference={mockEventReference}
        />
      );

      const copyButtons = screen.getAllByRole("button", { name: /copy event reference/i });
      expect(copyButtons.length).toBeGreaterThan(0);

      await userEvent.click(copyButtons[0]);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(mockEventReference);
      });
    });
  });

  describe("Explorer link", () => {
    it("omits explorer link when event reference is missing", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockObservedRoot}
          eventReference={null}
        />
      );

      expect(screen.queryByRole("link", { name: /view transaction on stellar expert explorer/i })).not.toBeInTheDocument();
    });

    it("constructs correct Stellar Expert testnet URL", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockObservedRoot}
          eventReference={mockEventReference}
        />
      );

      const link = screen.getByRole("link", { name: /view transaction on stellar expert explorer/i });
      expect(link).toHaveAttribute("href", `https://stellar.expert/explorer/testnet/tx/${mockEventReference}`);
    });
  });

  describe("Privacy constraints", () => {
    it("never renders any dollar amounts or salary values", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockDifferentObservedRoot}
          eventSource={mockEventSource}
          eventReference={mockEventReference}
        />
      );

      const fullText = document.body.textContent || "";
      expect(fullText).not.toMatch(/\$\d+/);
      expect(fullText).not.toMatch(/\d+\.\d{2}/);
      expect(fullText).not.toMatch(/5000|4500|4800|5200|4200/);
    });

    it("never renders employee names or identifiers", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockDifferentObservedRoot}
        />
      );

      const fullText = document.body.textContent || "";
      expect(fullText).not.toMatch(/Alice|Kwame|Amara|Kofi|Yaa/i);
      expect(fullText).not.toMatch(/emp_\d+/i);
    });

    it("never renders salary commitment hashes (short form)", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockDifferentObservedRoot}
        />
      );

      const fullText = document.body.textContent || "";
      // Short commitment hashes from mock data (12 chars) should not appear
      expect(fullText).not.toMatch(/0xabc123def456(?![0-9a-f])/);
      expect(fullText).not.toMatch(/0xdef789ghi012(?![0-9a-f])/);
      expect(fullText).not.toMatch(/0xghi345jkl678(?![0-9a-f])/);
      expect(fullText).not.toMatch(/0xmno901pqr234(?![0-9a-f])/);
      expect(fullText).not.toMatch(/0xstu456vwx789(?![0-9a-f])/);
    });

    it("only renders batch-level hashes, statuses, and metadata", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockObservedRoot}
          eventSource={mockEventSource}
          eventReference={mockEventReference}
        />
      );

      const fullText = document.body.textContent || "";
      expect(fullText).toContain(mockExpectedRoot);
      expect(fullText).toContain(mockObservedRoot);
      expect(fullText).toContain(mockEventSource);
      expect(fullText).toContain(mockEventReference);
      expect(fullText).toContain("Match");
      expect(fullText).toContain("Soroban Executor Contract");
    });
  });

  describe("Accessibility", () => {
    it("has proper heading structure", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockObservedRoot}
        />
      );

      expect(screen.getByRole("heading", { name: /batch root comparison/i })).toBeInTheDocument();
    });

    it("labels status badge with aria-label", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockObservedRoot}
        />
      );

      const badge = screen.getByRole("status");
      expect(badge).toHaveAttribute("aria-label", "Status: Match");
    });

    it("copy buttons have descriptive accessible names", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockObservedRoot}
        />
      );

      expect(screen.getByRole("button", { name: /copy expected root/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /copy observed root/i })).toBeInTheDocument();
    });

    it("explorer link announces new tab", () => {
      render(
        <BatchRootComparison
          expectedRoot={mockExpectedRoot}
          observedRoot={mockObservedRoot}
          eventReference={mockEventReference}
        />
      );

      const link = screen.getByRole("link", { name: /opens in a new tab/i });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });
});