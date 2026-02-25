import { ArrowUpRight, ArrowDownLeft } from "lucide-react";

function TransactionHistory() {
  const transactions = [
    {
      id: 1,
      type: "Payout",
      recipient: "Alice Smith",
      amount: "-$2,400",
      date: "2026-02-15",
      status: "Completed",
    },
    {
      id: 2,
      type: "Deposit",
      recipient: "Funding Wallet",
      amount: "+$50,000",
      date: "2026-02-14",
      status: "Completed",
    },
    {
      id: 3,
      type: "Payout",
      recipient: "Bob Jones",
      amount: "-$3,100",
      date: "2026-02-14",
      status: "Completed",
    },
  ];

  return (
    <section aria-labelledby="transaction-history-heading">
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3
            id="transaction-history-heading"
            className="text-lg font-medium text-gray-900"
          >
            Recent Transactions
          </h3>
        </div>
        <table className="w-full text-left">
          <caption className="sr-only">
            Recent payroll transactions showing type, recipient, amount, status,
            and date
          </caption>
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
              >
                Type
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
              >
                Recipient
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
              >
                Amount
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-xs font-medium text-gray-600 uppercase"
              >
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200" aria-live="polite">
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td className="px-6 py-4 flex items-center">
                  {tx.amount.startsWith("+") ? (
                    <ArrowDownLeft
                      className="w-4 h-4 text-green-600 mr-2"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowUpRight
                      className="w-4 h-4 text-red-600 mr-2"
                      aria-hidden="true"
                    />
                  )}
                  {tx.type}
                </td>
                <td className="px-6 py-4 text-gray-900">{tx.recipient}</td>
                <td
                  className={`px-6 py-4 font-medium ${
                    tx.amount.startsWith("+")
                      ? "text-green-700"
                      : "text-gray-900"
                  }`}
                >
                  {tx.amount}
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    {tx.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">{tx.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default TransactionHistory;
