import React from "react";
import { PayrollPreflightResultsScreen } from "@/components/features/payroll/PayrollPreflightResultsScreen";

export const metadata = {
  title: "Payroll Preflight Results | ZK Payroll Dashboard",
  description: "Dry-run preflight results and readiness validation before payroll execution.",
};

export default function PayrollPreflightPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <PayrollPreflightResultsScreen />
    </div>
  );
}
