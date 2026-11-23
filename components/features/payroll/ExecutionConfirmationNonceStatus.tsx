type ExecutionConfirmationNonceStatusProps = {
  nonce?: string | null;
  status: "pending" | "confirmed" | "unavailable";
};

const STATUS_LABELS = {
  pending: "Awaiting ledger confirmation",
  confirmed: "Ledger confirmation received",
  unavailable: "Confirmation status unavailable",
} as const;

export function ExecutionConfirmationNonceStatus({
  nonce,
  status,
}: ExecutionConfirmationNonceStatusProps) {
  return (
    <section
      aria-label="Execution confirmation nonce status"
      className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm"
    >
      <p className="font-medium text-amber-900">{STATUS_LABELS[status]}</p>
      <p className="mt-1 text-xs text-amber-800">
        {nonce
          ? `Ledger nonce: ${nonce}`
          : "Nonce unavailable. The transaction response did not include a ledger sequence number. Check transaction history before retrying."}
      </p>
    </section>
  );
}
