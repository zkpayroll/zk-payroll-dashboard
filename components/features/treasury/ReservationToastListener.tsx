"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { onFundingReservationCreated } from "@/lib/events/reservationEvents";

/**
 * Mounted once near the treasury view. Listens for reservation-created
 * events and shows a privacy-safe confirmation toast — no salary or
 * employee details, only the reservation identifier.
 */
export function ReservationToastListener() {
  useEffect(() => {
    return onFundingReservationCreated((event) => {
      const identifier = event.reservationId || "reservation";
      toast.success("Funding reservation created", {
        description: event.payrollRunId
          ? `${identifier} · payroll run ${event.payrollRunId}`
          : identifier,
      });
    });
  }, []);

  return null;
}

export default ReservationToastListener;
