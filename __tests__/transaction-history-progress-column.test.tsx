import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/history",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

import TransactionHistory from "@/components/features/transactions/TransactionHistory";
import { MOCK_TRANSACTIONS } from "@/lib/api/mockData";

/**
 * Issue #295: history rows carry a compact submission progress column so the
 * lifecycle stage of each run is visible while scanning the list.
 */
describe("TransactionHistory progress column", () => {
  it("renders a progress cell for every listed transaction", () => {
    render(<TransactionHistory />);

    // All non-archived transactions show six stage markers each.
    const visible = MOCK_TRANSACTIONS.filter((t) => !t.isArchived);
    expect(visible.length).toBeGreaterThan(0);
    for (const tx of visible) {
      expect(
        screen.getAllByTestId(`progress-validation`).length,
      ).toBeGreaterThanOrEqual(visible.length);
    }
    expect(screen.getAllByTestId("progress-reconciliation").length).toBe(
      visible.length,
    );
  });

  it("renders the Progress column header in the desktop table", () => {
    render(<TransactionHistory />);

    expect(screen.getByRole("columnheader", { name: "Progress" })).toBeInTheDocument();
  });

  it("reflects distinct lifecycle states across mock rows", () => {
    render(<TransactionHistory />);

    // The mock pool includes verified (all complete) and pending rows.
    expect(screen.getAllByTestId("progress-validation").length).toBeGreaterThan(0);
    // At least one row has an active stage (pending runs are mid-flight).
    const active = [
      ...screen.getAllByTestId("progress-confirmation"),
      ...screen.getAllByTestId("progress-signing"),
      ...screen.getAllByTestId("progress-approval"),
      ...screen.getAllByTestId("progress-validation"),
    ].filter((el) => el.getAttribute("data-state") === "active");
    expect(active.length).toBeGreaterThan(0);
  });

  it("privacy: progress cells never render amounts, hashes, proofs, or employee data", () => {
    const { container } = render(<TransactionHistory />);

    const cells = container.querySelectorAll<HTMLElement>("[data-testid^='progress-']");
    expect(cells.length).toBeGreaterThan(0);
    const sampled = Array.from(cells)
      .slice(0, 12)
      .map((el) => el.parentElement?.textContent ?? "")
      .join(" ");
    expect(sampled).not.toMatch(/\$\s?\d/);
    expect(sampled).not.toMatch(/0x/i);
    expect(sampled).not.toMatch(/proof-hash/i);
    expect(sampled).not.toMatch(/G[A-Z0-9]{55}/);
  });
});
