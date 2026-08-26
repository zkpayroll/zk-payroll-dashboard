"use client";

import { useOperationsStore, type OperationState } from "@/stores/operations";
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

function OperationsCommandCenter() {
  const { cards, filter, setFilter } = useOperationsStore();

  const filteredCards = filter === 'all' ? cards : cards.filter((c) => c.state === filter);

  return (
    <div className="space-y-4">
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
          {filteredCards.map((card) => (
            <Link
              key={card.id}
              href={card.link}
              className={`block p-4 rounded-lg border bg-white hover:shadow-sm transition-shadow ${stateStyles[card.state].border}`}
            >
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${stateStyles[card.state].badge}`}>
                {card.state}
              </span>
              <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{card.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default OperationsCommandCenter;
