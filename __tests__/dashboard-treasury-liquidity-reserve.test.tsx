import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TreasuryLiquidityReserveCard from "@/components/features/dashboard/TreasuryLiquidityReserveCard";
import {
  TREASURY_RESERVE_LOAD_ERROR,
  readTreasuryStoreSnapshot,
  useTreasuryLiquidityReserve,
} from "@/hooks/useTreasuryLiquidityReserve";
import { useTreasuryStore } from "@/stores/treasury";
import type { TreasuryLiquidityReserveSnapshot } from "@/types/treasury";

const CONFIG = { targetReservePercent: 150 };

function snapshot(
  overrides: Partial<TreasuryLiquidityReserveSnapshot> = {},
): TreasuryLiquidityReserveSnapshot {
  return {
    assetCode: "USDC",
    balance: 45_000,
    nextPayrollObligation: 19_500,
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

function loaderFor(overrides: Partial<TreasuryLiquidityReserveSnapshot> = {}) {
  return vi.fn().mockResolvedValue(snapshot(overrides));
}

async function renderCard(loadSnapshot: ReturnType<typeof vi.fn>) {
  render(<TreasuryLiquidityReserveCard loadSnapshot={loadSnapshot} config={CONFIG} />);
  const card = screen.getByTestId("treasury-liquidity-reserve");
  await waitFor(() => expect(card).not.toHaveAttribute("data-status", "loading"));
  return screen.getByTestId("treasury-liquidity-reserve");
}

beforeEach(() => {
  useTreasuryStore.getState().reset();
});

describe("TreasuryLiquidityReserveCard", () => {
  it("shows a loading state until readings arrive", async () => {
    let resolve!: (value: TreasuryLiquidityReserveSnapshot) => void;
    const loadSnapshot = vi.fn(
      () => new Promise<TreasuryLiquidityReserveSnapshot>((r) => (resolve = r)),
    );

    render(<TreasuryLiquidityReserveCard loadSnapshot={loadSnapshot} config={CONFIG} />);

    const card = screen.getByTestId("treasury-liquidity-reserve");
    expect(card).toHaveAttribute("data-status", "loading");
    expect(card).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/Checking treasury liquidity reserve/i)).toBeInTheDocument();
    expect(screen.queryByText("Healthy")).not.toBeInTheDocument();

    await act(async () => resolve(snapshot()));

    expect(screen.getByTestId("treasury-liquidity-reserve")).toHaveAttribute(
      "data-status",
      "healthy",
    );
  });

  it("renders the healthy status with ratio, coverage, and amounts", async () => {
    const card = await renderCard(loaderFor());

    expect(card).toHaveAttribute("data-status", "healthy");
    expect(card).toHaveAttribute("role", "status");
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(
      screen.getByText(/holds 230% of the next payroll run, at or above the 150% target/i),
    ).toBeInTheDocument();
    expect(screen.getByText("45,000 USDC")).toBeInTheDocument();
    expect(screen.getByText("19,500 USDC")).toBeInTheDocument();
    expect(screen.getByText("2 payroll runs")).toBeInTheDocument();
    expect(screen.queryByTestId("treasury-liquidity-reserve-shortfall")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Fund treasury" })).not.toBeInTheDocument();
  });

  it("renders the low status with the amount needed to reach the target", async () => {
    const card = await renderCard(loaderFor({ balance: 20_000 }));

    expect(card).toHaveAttribute("data-status", "low");
    expect(card).toHaveAttribute("role", "status");
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(
      screen.getByText(/next payroll run is covered.*Add 9,250 USDC to reach the target/i),
    ).toBeInTheDocument();
    expect(screen.getByText("1 payroll run")).toBeInTheDocument();
    expect(screen.queryByTestId("treasury-liquidity-reserve-shortfall")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fund treasury" })).toHaveAttribute(
      "href",
      "/treasury",
    );
  });

  it("renders the critical status as an alert with the shortfall", async () => {
    const card = await renderCard(loaderFor({ balance: 15_000 }));

    expect(card).toHaveAttribute("data-status", "critical");
    expect(card).toHaveAttribute("role", "alert");
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText(/cannot cover the next payroll run/i)).toBeInTheDocument();
    expect(screen.getByTestId("treasury-liquidity-reserve-shortfall")).toHaveTextContent(
      "Shortfall: 4,500 USDC",
    );
    expect(screen.getByText("0 payroll runs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fund treasury" })).toBeInTheDocument();
  });

  it("explains an empty treasury and shows the full obligation as shortfall", async () => {
    const card = await renderCard(loaderFor({ balance: 0 }));

    expect(card).toHaveAttribute("data-status", "critical");
    expect(screen.getByText(/treasury has no available USDC/i)).toBeInTheDocument();
    expect(screen.getByTestId("treasury-liquidity-reserve-shortfall")).toHaveTextContent(
      "Shortfall: 19,500 USDC",
    );
  });

  it("renders an empty state when no payroll is scheduled", async () => {
    const card = await renderCard(loaderFor({ nextPayrollObligation: 0 }));

    expect(card).toHaveAttribute("data-status", "empty");
    expect(screen.getByText("No payroll scheduled")).toBeInTheDocument();
    expect(
      screen.getByText(/no upcoming payroll run to measure the reserve against/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Available balance: 45,000 USDC/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View payroll schedule" })).toHaveAttribute(
      "href",
      "/payroll/schedule",
    );
    expect(screen.queryByText("Healthy")).not.toBeInTheDocument();
  });

  it("shows an actionable error and recovers on retry when loading fails", async () => {
    const loadSnapshot = vi
      .fn()
      .mockRejectedValueOnce(new Error("rpc 503: account GABC... balance 45000"))
      .mockResolvedValueOnce(snapshot());

    const card = await renderCard(loadSnapshot);

    expect(card).toHaveAttribute("data-status", "error");
    expect(card).toHaveAttribute("role", "alert");
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText(TREASURY_RESERVE_LOAD_ERROR)).toBeInTheDocument();
    // Raw transport errors stay in the log, not on screen.
    expect(card).not.toHaveTextContent(/rpc 503/);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() =>
      expect(screen.getByTestId("treasury-liquidity-reserve")).toHaveAttribute(
        "data-status",
        "healthy",
      ),
    );
    expect(loadSnapshot).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["negative", -100],
    ["NaN", Number.NaN],
    ["non-numeric", "abc"],
  ])("treats a %s balance as an error, never as healthy", async (_label, balance) => {
    const card = await renderCard(loaderFor({ balance: balance as never }));

    expect(card).toHaveAttribute("data-status", "error");
    expect(screen.getByText(/Reserve status could not be determined/i)).toBeInTheDocument();
    expect(screen.getByText(/treasury balance is .*Refresh the reading/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("Healthy")).not.toBeInTheDocument();
  });

  it("flags a stale balance without hiding the status", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const card = await renderCard(loaderFor({ lastUpdated: twoHoursAgo }));

    expect(card).toHaveAttribute("data-status", "healthy");
    const note = screen.getByTestId("treasury-liquidity-reserve-freshness");
    expect(note).toHaveAttribute("data-freshness", "stale");
    expect(note).toHaveTextContent(/Balance last updated 2h ago/);
  });

  it("flags a balance with no update time", async () => {
    await renderCard(loaderFor({ lastUpdated: null }));

    const note = screen.getByTestId("treasury-liquidity-reserve-freshness");
    expect(note).toHaveAttribute("data-freshness", "unknown");
    expect(note).toHaveTextContent(/no recorded update time/i);
  });

  it("shows no freshness note for a current balance", async () => {
    await renderCard(loaderFor());

    expect(screen.queryByTestId("treasury-liquidity-reserve-freshness")).not.toBeInTheDocument();
  });

  it("reloads readings when Refresh is pressed", async () => {
    const loadSnapshot = vi
      .fn()
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValueOnce(snapshot({ balance: 15_000 }));

    await renderCard(loadSnapshot);
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() =>
      expect(screen.getByTestId("treasury-liquidity-reserve")).toHaveAttribute(
        "data-status",
        "critical",
      ),
    );
  });
});

describe("useTreasuryLiquidityReserve", () => {
  it("reads the treasury store by default", async () => {
    const { result } = renderHook(() => useTreasuryLiquidityReserve({ config: CONFIG }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.result).toMatchObject({
      kind: "evaluated",
      status: "healthy",
      assetCode: "USDC",
      balance: "45000",
      nextPayrollObligation: "19500",
    });
  });

  it("re-evaluates when the treasury store changes", async () => {
    const { result } = renderHook(() => useTreasuryLiquidityReserve({ config: CONFIG }));
    await waitFor(() => expect(result.current.result?.kind).toBe("evaluated"));

    act(() => useTreasuryStore.getState().setAvailableBalance("USDC", 1_000));

    await waitFor(() =>
      expect(result.current.result).toMatchObject({
        status: "critical",
        shortfall: "18500",
        freshness: "fresh",
      }),
    );
  });

  it("reports an asset with no treasury balance as invalid", async () => {
    const { result } = renderHook(() =>
      useTreasuryLiquidityReserve({ assetCode: "XLM", config: CONFIG }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.result?.kind).toBe("invalid");
  });

  it("drops the previous status when a reload fails", async () => {
    const loadSnapshot = vi
      .fn()
      .mockResolvedValueOnce(snapshot())
      .mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() =>
      useTreasuryLiquidityReserve({ loadSnapshot, config: CONFIG }),
    );
    await waitFor(() => expect(result.current.result?.kind).toBe("evaluated"));

    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.error).toBe(TREASURY_RESERVE_LOAD_ERROR));
    expect(result.current.result).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("maps store balances to a snapshot", () => {
    expect(readTreasuryStoreSnapshot("USDC")).toEqual({
      assetCode: "USDC",
      balance: 45_000,
      nextPayrollObligation: 19_500,
      lastUpdated: null,
    });
  });
});

describe("DashboardHome wiring", () => {
  it("mounts the reserve card inside an ErrorBoundary", () => {
    // DashboardHome is wallet-gated and not renderable in jsdom, so assert the
    // wiring directly, as the other dashboard checks do.
    const source = readFileSync(
      join(process.cwd(), "components/features/dashboard/DashboardHome.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'import TreasuryLiquidityReserveCard from "@/components/features/dashboard/TreasuryLiquidityReserveCard"',
    );
    expect(source).toMatch(
      /<ErrorBoundary>\s*<TreasuryLiquidityReserveCard \/>\s*<\/ErrorBoundary>/,
    );
  });
});
