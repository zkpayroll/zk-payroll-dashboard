"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTreasuryStore } from "@/stores/treasury";
import { createLogger } from "@/lib/logger";
import { evaluateTreasuryLiquidityReserve } from "@/lib/treasury/liquidityReserve";
import type {
  TreasuryLiquidityReserveConfig,
  TreasuryLiquidityReserveResult,
  TreasuryLiquidityReserveSnapshot,
} from "@/types/treasury";

const log = createLogger("treasury-liquidity-reserve");

const DEFAULT_ASSET_CODE = "USDC";
/** How often freshness is re-evaluated while the dashboard stays open. */
const FRESHNESS_TICK_MS = 60 * 1000;

export const TREASURY_RESERVE_LOAD_ERROR =
  "Treasury reserve data could not be loaded. Check your connection and try again.";

export type TreasuryReserveSnapshotLoader = (
  assetCode: string,
) => Promise<TreasuryLiquidityReserveSnapshot> | TreasuryLiquidityReserveSnapshot;

/**
 * Default data source: the persisted treasury store, which is where the rest
 * of the dashboard reads per-asset balances from. `available` excludes funds
 * already reserved for locked runs, and `projected` is the next run's total.
 */
export function readTreasuryStoreSnapshot(
  assetCode: string,
): TreasuryLiquidityReserveSnapshot {
  const { balances, lastUpdated } = useTreasuryStore.getState();
  const balance = balances[assetCode];
  return {
    assetCode,
    balance: balance?.available,
    nextPayrollObligation: balance?.projected,
    lastUpdated,
  };
}

export interface UseTreasuryLiquidityReserveOptions {
  /** Payroll asset to monitor. Defaults to USDC. */
  assetCode?: string;
  /**
   * Override for where readings come from (e.g. an SDK call once one exists,
   * or a stub in tests). Defaults to the treasury store.
   */
  loadSnapshot?: TreasuryReserveSnapshotLoader;
  /** Threshold overrides; falls back to the configured defaults. */
  config?: Partial<TreasuryLiquidityReserveConfig>;
}

export interface TreasuryLiquidityReserveState {
  /** True until the first load settles. */
  isLoading: boolean;
  /** True while a later reload is in flight and earlier data is still shown. */
  isRefreshing: boolean;
  /** Actionable message when the latest load failed. */
  error: string | null;
  /** Latest evaluation, or null while loading or after a failed first load. */
  result: TreasuryLiquidityReserveResult | null;
  /** Reload the readings (also the retry action after an error). */
  refresh: () => void;
}

/**
 * Load treasury readings and evaluate the liquidity reserve for one asset.
 * Re-evaluates when the treasury store changes and re-checks freshness on a
 * timer so an open dashboard does not keep presenting an old balance as current.
 */
export function useTreasuryLiquidityReserve(
  options: UseTreasuryLiquidityReserveOptions = {},
): TreasuryLiquidityReserveState {
  const { assetCode = DEFAULT_ASSET_CODE, loadSnapshot, config } = options;
  const targetReservePercent = config?.targetReservePercent;
  const staleAfterMs = config?.staleAfterMs;

  const storeBalance = useTreasuryStore((s) => s.balances[assetCode]);
  const storeLastUpdated = useTreasuryStore((s) => s.lastUpdated);

  const [snapshot, setSnapshot] = useState<TreasuryLiquidityReserveSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [now, setNow] = useState(() => new Date());

  const loadSnapshotRef = useRef(loadSnapshot);
  useEffect(() => {
    loadSnapshotRef.current = loadSnapshot;
  }, [loadSnapshot]);

  useEffect(() => {
    let cancelled = false;
    setIsFetching(true);

    const load = async () => {
      try {
        const loader = loadSnapshotRef.current ?? readTreasuryStoreSnapshot;
        const next = await loader(assetCode);
        if (cancelled) return;
        setSnapshot(next);
        setError(null);
        setNow(new Date());
      } catch (err) {
        if (cancelled) return;
        log.error("Failed to load treasury reserve readings", {
          assetCode,
          reason: err instanceof Error ? err.message : "unknown",
        });
        // Drop the previous reading: a balance we could not re-confirm must
        // not keep reporting a reserve status.
        setSnapshot(null);
        setError(TREASURY_RESERVE_LOAD_ERROR);
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [assetCode, storeBalance, storeLastUpdated, reloadToken]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), FRESHNESS_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const result = useMemo(
    () =>
      snapshot
        ? evaluateTreasuryLiquidityReserve(
            snapshot,
            { targetReservePercent, staleAfterMs },
            now,
          )
        : null,
    [snapshot, targetReservePercent, staleAfterMs, now],
  );

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    isLoading: isFetching && snapshot === null && error === null,
    isRefreshing: isFetching && (snapshot !== null || error !== null),
    error,
    result,
    refresh,
  };
}
