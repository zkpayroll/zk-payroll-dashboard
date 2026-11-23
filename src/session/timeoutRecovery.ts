/**
 * Session timeout recovery context (#269).
 *
 * When an admin session expires mid-workflow, the dashboard captures a
 * *non-sensitive* recovery context (workflow name, step, route) so the user
 * can resume or restart without losing their place. Only an explicit
 * allowlist of fields is preserved — salary values, amounts, secrets, keys,
 * and free-form notes are never stored.
 */

export type PayrollWorkflow = "draft" | "review" | "submission";

export const PAYROLL_WORKFLOW_LABELS: Record<PayrollWorkflow, string> = {
  draft: "Payroll draft editing",
  review: "Payroll review",
  submission: "Payroll submission",
};

export interface RecoveryContext {
  workflow: PayrollWorkflow;
  /** Route path only — no query strings, which may carry identifiers. */
  route: string;
  /** Human-readable step within the workflow, e.g. "Step 3 of 5: Review". */
  stepLabel?: string;
  /** Epoch ms when the context was captured. */
  capturedAt: number;
}

export interface SessionExpiryInfo {
  isExpired: boolean;
  /** Guidance shown to the user; empty while the session is still valid. */
  guidance: string;
  /** Actions the user can take after expiry. */
  availableActions: Array<"resume" | "restart" | "reauth">;
}

/** Keys that may never appear in a recovery context snapshot. */
const SENSITIVE_KEY_PATTERN =
  /salary|amount|secret|key|token|password|commitment|memo|note|ssn|iban|account/i;

const ALLOWED_SNAPSHOT_KEYS = ["workflow", "route", "stepLabel"] as const;

function sanitizeRoute(route: string): string {
  // Strip query strings and fragments — they can carry employee ids or amounts.
  return route.split("?")[0].split("#")[0] || "/";
}

function isPayrollWorkflow(value: unknown): value is PayrollWorkflow {
  return value === "draft" || value === "review" || value === "submission";
}

export interface CaptureRecoveryContextResult {
  ok: boolean;
  context?: RecoveryContext;
  /** Actionable reasons capture failed or was refused. */
  errors: string[];
  /** Snapshot keys that were dropped because they are not allowlisted. */
  droppedKeys: string[];
}

/**
 * Captures a recovery context from a workflow snapshot. Fails closed:
 * anything not explicitly allowlisted is dropped, and snapshots that are
 * missing the workflow/route pair are rejected with actionable errors.
 */
export function captureRecoveryContext(
  snapshot: Record<string, unknown>,
  now: number = Date.now(),
): CaptureRecoveryContextResult {
  const errors: string[] = [];
  const droppedKeys: string[] = [];

  if (!snapshot || typeof snapshot !== "object") {
    return {
      ok: false,
      errors: [
        "Recovery snapshot must be an object with workflow and route fields.",
      ],
      droppedKeys,
    };
  }

  for (const key of Object.keys(snapshot)) {
    if (!(ALLOWED_SNAPSHOT_KEYS as readonly string[]).includes(key)) {
      droppedKeys.push(key);
    } else if (SENSITIVE_KEY_PATTERN.test(key)) {
      droppedKeys.push(key);
    }
  }

  if (!isPayrollWorkflow(snapshot.workflow)) {
    errors.push(
      "Workflow must be one of: draft, review, submission. Restart the payroll flow to capture a valid recovery point.",
    );
  }
  if (typeof snapshot.route !== "string" || !snapshot.route.trim()) {
    errors.push(
      "Route is required for recovery. Navigate to a payroll screen and try again.",
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors, droppedKeys };
  }

  const context: RecoveryContext = {
    workflow: snapshot.workflow as PayrollWorkflow,
    route: sanitizeRoute(snapshot.route as string),
    capturedAt: now,
  };
  if (typeof snapshot.stepLabel === "string" && snapshot.stepLabel.trim()) {
    context.stepLabel = snapshot.stepLabel.trim().slice(0, 120);
  }

  return { ok: true, context, errors: [], droppedKeys };
}

/**
 * Derives expiry guidance and available actions from the session state and
 * any captured recovery context.
 */
export function evaluateSessionExpiry(
  isExpired: boolean,
  context?: RecoveryContext | null,
): SessionExpiryInfo {
  if (!isExpired) {
    return { isExpired: false, guidance: "", availableActions: [] };
  }

  if (!context) {
    return {
      isExpired: true,
      guidance:
        "Your session expired. Sign in again to return to the dashboard — no payroll data was submitted.",
      availableActions: ["reauth", "restart"],
    };
  }

  return {
    isExpired: true,
    guidance: `Your session expired during ${PAYROLL_WORKFLOW_LABELS[context.workflow]}${context.stepLabel ? ` (${context.stepLabel})` : ""}. Your place has been saved — sign in again to resume or restart the flow.`,
    availableActions: ["reauth", "resume", "restart"],
  };
}

export interface ResumePlan {
  canResume: boolean;
  /** Ordered steps the user follows after signing back in. */
  steps: string[];
  statusMessage: string;
}

/**
 * Builds the post-reauth resume plan for a captured context. Route is
 * re-validated defensively even though capture already sanitizes it.
 */
export function buildResumePlan(
  context: RecoveryContext | null | undefined,
): ResumePlan {
  if (!context) {
    return {
      canResume: false,
      steps: ["Sign in again.", "Re-open the payroll flow from the dashboard."],
      statusMessage:
        "No recovery context was saved — restart the payroll flow after signing in.",
    };
  }

  const route = sanitizeRoute(context.route);
  return {
    canResume: true,
    steps: [
      "Sign in again to restore your session.",
      `Return to ${route}.`,
      `Continue ${PAYROLL_WORKFLOW_LABELS[context.workflow].toLowerCase()}${context.stepLabel ? ` at "${context.stepLabel}"` : ""}.`,
      "Re-verify the checklist before confirming — values may have changed while you were signed out.",
    ],
    statusMessage: `Recovery context saved for ${PAYROLL_WORKFLOW_LABELS[context.workflow]}. You can resume where you left off.`,
  };
}
