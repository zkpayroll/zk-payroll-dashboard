"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { onFundingReservationCreated } from "@/lib/events/reservationEvents";
import { sanitizeReservationIdentifier } from "@/lib/treasury/reservationGuidance";

/**
 * Mounted once near the treasury view. Listens for reservation-created
 * events and shows a privacy-safe confirmation toast — no salary or
 * employee details, only the sanitized reservation identifier.
 */
export function ReservationToastListener() {
  useEffect(() => {
    return onFundingReservationCreated((event) => {
      const identifier = sanitizeReservationIdentifier(
        event.reservationId,
        "reservation",
      );
      const safeRunId = event.payrollRunId
        ? sanitizeReservationIdentifier(event.payrollRunId, "")
        : "";
      toast.success("Funding reservation created", {
        description: safeRunId
          ? `${identifier} · payroll run ${safeRunId}`
          : identifier,
      });
    });
  }, []);

  return null;
}

export default ReservationToastListener;
