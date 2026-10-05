export type PayrollIssueStatus = "unresolved" | "in-progress";

export interface PayrollIssueHandoffItem {
  id: string;
  title: string;
  blocker: string;
  owner?: string;
  nextAction: string;
  coordinationNotes?: string;
  status: PayrollIssueStatus;
}

export function isPayrollIssueHandoffItem(
  value: unknown,
): value is PayrollIssueHandoffItem {
  if (!value || typeof value !== "object") return false;

  const item = value as Partial<PayrollIssueHandoffItem>;
  return (
    typeof item.id === "string" && item.id.trim().length > 0 &&
    typeof item.title === "string" && item.title.trim().length > 0 &&
    typeof item.blocker === "string" && item.blocker.trim().length > 0 &&
    typeof item.nextAction === "string" && item.nextAction.trim().length > 0 &&
    (item.owner === undefined || typeof item.owner === "string") &&
    (item.coordinationNotes === undefined || typeof item.coordinationNotes === "string") &&
    (item.status === "unresolved" || item.status === "in-progress")
  );
}

export function filterValidPayrollIssueHandoffs(
  items: unknown[],
): PayrollIssueHandoffItem[] {
  return items.filter(isPayrollIssueHandoffItem);
}

export const SAMPLE_PAYROLL_ISSUE_HANDOFFS: PayrollIssueHandoffItem[] = [
  {
    id: "issue-297-blocker",
    title: "Payroll proof requires review",
    blocker: "The proof review step is unresolved and is blocking safe submission.",
    owner: "Payroll operations",
    nextAction: "Review the proof status and record the approval decision.",
    coordinationNotes: "Coordinate with compliance before the next submission window.",
    status: "unresolved",
  },
  {
    id: "issue-297-reconciliation",
    title: "Reconciliation follow-up needed",
    blocker: "A reconciliation discrepancy still needs an owner and resolution path.",
    nextAction: "Assign an operator and compare the affected run state.",
    coordinationNotes: "Keep the incident timeline updated as findings are confirmed.",
    status: "in-progress",
  },
];