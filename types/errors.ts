export type ErrorCategory = "treasury" | "authorization" | "proof" | "conflict" | "network" | "unknown";

export type ErrorAudience = "contributor" | "maintainer" | "admin" | "auditor";

export interface RemediationAction {
  label: string;
  description: string;
  audience: ErrorAudience;
  href?: string;
}

export interface ErrorRemediation {
  id: string;
  category: ErrorCategory;
  title: string;
  summary: string;
  likelyCause: string;
  actions: RemediationAction[];
  docsHref?: string;
}

export interface ErrorRemediationDrawerState {
  isOpen: boolean;
  remediation: ErrorRemediation | null;
  openRemediation: (remediation: ErrorRemediation) => void;
  closeRemediation: () => void;
}
