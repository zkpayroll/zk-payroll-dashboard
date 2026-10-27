import DashboardLayout from "@/components/layout/DashboardLayout";
import TransactionHistory from "@/components/features/transactions/TransactionHistory";
import { MOCK_TRANSACTIONS } from "@/lib/api/mockData";
import {
  orderSettlementEvents,
  sanitizeSettlementEventForDisplay,
} from "@/lib/history/settlementEventOrdering";

function HistoryPage() {
  const { ordered } = orderSettlementEvents(MOCK_TRANSACTIONS, {
    ledgerDirection: "desc",
    sameLedgerDirection: "asc",
  });
  const latestSanitized = ordered[0]
    ? sanitizeSettlementEventForDisplay(ordered[0])
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {latestSanitized && (
          <div
            data-testid="settlement-ordering-summary"
            className="rounded-lg border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2"
          >
            <span>
              Deterministic ledger &amp; intra-ledger operation ordering active across{" "}
              <strong className="text-foreground">{ordered.length}</strong>{" "}
              settlement records.
            </span>
            {latestSanitized.maskedTxHash && (
              <span className="font-mono">
                Latest settled tx: {latestSanitized.maskedTxHash}
              </span>
            )}
          </div>
        )}
        <TransactionHistory />
      </div>
    </DashboardLayout>
  );
}

export default HistoryPage;
