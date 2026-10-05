export interface PayrollPolicy {
  id: string;
  effectiveDate: Date;
  compensation: number;
  currency: string;
}

export interface PayrollDashboard {
  policies: PayrollPolicy[];
  // ... existing dashboard types
}