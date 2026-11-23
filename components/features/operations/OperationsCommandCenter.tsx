"use client";

import { useMemo } from "react";
import { useOperationsStore, type OperationState, type OperationCard } from "@/stores/operations";
import { useContractPauseGuard } from "@/hooks/useContractPauseGuard";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import Link from "next/link";

const stateStyles: Record<OperationState, { badge: string; border: string }> = {
  healthy: { badge: "bg-green-100 text-green-700", border: "border-green-200" },
  urgent: { badge: "bg-red-100 text-red-700", border: "border-red-300" },
  blocked: { badge: "bg-red-100 text-red-700", border: "border-red-300" },
  ready: { badge: "bg-blue-100 text-blue-700", border: "border-blue-200" },
  "requires-review": { badge: "bg-amber-100 text-amber-700", border: "border-amber-200" },
};

const filterOptions: Array<{ value: OperationState | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'ready', label: 'Ready' },
  { value: 'requires-review', label: 'Requires Review' },
  { value: 'healthy', label: 'Healthy' },
];

/** Mutation card IDs or links that perform contract-altering actions. */
const MUTATION_CARD_IDS = new Set(["payroll-batches", "failed-execution", "approvals"]);
const MUTATION_LINK_PREFIXES = ["/payroll/execute", "/payroll/recovery", "/payroll/approvals", "/recovery"];

function isCardMutationAction(card: OperationCard): boolean {
  if (MUTATION_CARD_IDS.has(card.id)) return true;
  return MUTATION_LINK_PREFIXES.some((prefix) => card.link.startsWith(prefix));
}

function OperationsCommandCenter() {
  const { cards, filter, setFilter } = useOperationsStore();
  const { isMutationDisabled, pauseReason, remediationHref } = useContractPauseGuard();

  // If contracts are paused, mutation cards effectively transition to blocked state
  const effectiveCards = useMemo(() => {
    if (!isMutationDisabled) return cards;
    return cards.map((card) => {
      if (isCardMutationAction(card)) {
        return {
          ...card,
          state: "blocked" as OperationState,
        };
      }
      return card;
    });
  }, [cards, isMutationDisabled]);

  const filteredCards = filter === 'all'
    ? effectiveCards
    : effectiveCards.filter((c) => c.state === filter);

  return (
    <div className="space-y-4">
      {isMutationDisabled && (
        <div
          role="alert"
          data-testid="operations-contract-paused-alert"
          className="p-4 rounded-lg bg-amber-50 border border-amber-300 text-amber-900"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-amber-900">
                  Smart Contracts Paused — Mutation Actions Disabled
                </h4>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-200 text-amber-800">
                  CONTRACT_PAUSED
                </span>
              </div>
              <p className="text-sm text-amber-700 mt-1">
                {pauseReason
                  ? `Payroll contract operations are paused: ${pauseReason}. Mutation operations (payroll execution, approvals, and retries) are disabled.`
                  : "Payroll smart contract operations are currently paused by administrative action. Mutation operations (payroll execution, approvals, and retries) are disabled until resumed."}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <Link
                  href={remediationHref}
                  className="text-xs font-semibold text-amber-800 underline hover:text-amber-900"
                >
                  Review Pause Status in Admin Settings
                </Link>
                <span className="text-xs text-amber-600">
                  Privacy-safe: no salary or employee figures exposed.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === opt.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filteredCards.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">No items match this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map((card) => {
            const isMutation = isCardMutationAction(card);
            const isActionDisabled = isMutationDisabled && isMutation;

            if (isActionDisabled) {
              return (
                <div
                  key={card.id}
                  data-testid={`card-${card.id}`}
                  data-mutation-disabled="true"
                  aria-disabled="true"
                  title="Mutation action disabled: smart contracts are paused."
                  className={`block p-4 rounded-lg border bg-gray-50 opacity-80 cursor-not-allowed ${stateStyles[card.state].border}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${stateStyles[card.state].badge}`}>
                      {card.state}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-medium">
                      <ShieldAlert className="w-3 h-3 text-amber-600" />
                      Paused
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{card.description}</p>
                  <p className="text-xs text-amber-800 mt-2 font-medium">
                    Action paused until contracts resume
                  </p>
                </div>
              );
            }

            return (
              <Link
                key={card.id}
                href={card.link}
                data-testid={`card-${card.id}`}
                className={`block p-4 rounded-lg border bg-white hover:shadow-sm transition-shadow ${stateStyles[card.state].border}`}
              >
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${stateStyles[card.state].badge}`}>
                  {card.state}
                </span>
                <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{card.description}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default OperationsCommandCenter;
