import type { UserRole } from "@/types";
import type { KeyboardShortcut, ShortcutValidationResult } from "./types";

/**
 * Standard registry of payroll keyboard shortcuts.
 * Designed according to WCAG 2.1.4 guidelines:
 * - Uses two-key sequences (e.g. `g` then `p`) or explicit modifiers to prevent
 *   conflicts with standard browser commands, assistive tech, or screen readers.
 * - Single-character shortcuts are automatically inhibited when user focuses an editable field.
 */
export const PAYROLL_SHORTCUTS: KeyboardShortcut[] = [
  // ── Navigation ───────────────────────────────────────────────────────────
  {
    id: "nav-dashboard",
    category: "navigation",
    keyDisplay: "g then d",
    keys: ["g", "d"],
    description: "Go to Dashboard",
    route: "/",
    roles: ["admin", "operator", "auditor"],
  },
  {
    id: "nav-payroll-execute",
    category: "navigation",
    keyDisplay: "g then p",
    keys: ["g", "p"],
    description: "Go to Execute Payroll",
    route: "/payroll/execute",
    roles: ["admin", "operator"],
  },
  {
    id: "nav-employees",
    category: "navigation",
    keyDisplay: "g then e",
    keys: ["g", "e"],
    description: "Go to Employee Directory",
    route: "/employees",
    roles: ["admin", "operator"],
  },
  {
    id: "nav-history",
    category: "navigation",
    keyDisplay: "g then h",
    keys: ["g", "h"],
    description: "Go to Transaction History",
    route: "/history",
    roles: ["admin", "operator", "auditor"],
  },
  {
    id: "nav-approvals",
    category: "navigation",
    keyDisplay: "g then a",
    keys: ["g", "a"],
    description: "Go to Approval Queue",
    route: "/payroll/approvals",
    roles: ["admin", "operator"],
  },
  {
    id: "nav-treasury",
    category: "navigation",
    keyDisplay: "g then t",
    keys: ["g", "t"],
    description: "Go to Treasury Management",
    route: "/treasury",
    roles: ["admin"],
    adminOnly: true,
  },
  {
    id: "nav-compliance",
    category: "navigation",
    keyDisplay: "g then c",
    keys: ["g", "c"],
    description: "Go to Compliance Center",
    route: "/compliance",
    roles: ["admin", "auditor"],
  },
  {
    id: "nav-settings",
    category: "navigation",
    keyDisplay: "g then s",
    keys: ["g", "s"],
    description: "Go to Settings",
    route: "/settings",
    roles: ["admin", "operator", "auditor"],
  },

  // ── Actions ──────────────────────────────────────────────────────────────
  {
    id: "action-new-payroll",
    category: "actions",
    keyDisplay: "c then p",
    keys: ["c", "p"],
    description: "Create New Payroll Run",
    route: "/payroll/execute",
    roles: ["admin", "operator"],
  },
  {
    id: "action-add-employee",
    category: "actions",
    keyDisplay: "c then e",
    keys: ["c", "e"],
    description: "Add New Employee",
    route: "/employees",
    actionId: "open-add-employee",
    roles: ["admin"],
    adminOnly: true,
  },
  {
    id: "action-view-key",
    category: "actions",
    keyDisplay: "c then v",
    keys: ["c", "v"],
    description: "Generate Auditor View Key",
    route: "/compliance",
    roles: ["admin"],
    adminOnly: true,
  },
  {
    id: "action-verify-proof",
    category: "actions",
    keyDisplay: "p then v",
    keys: ["p", "v"],
    description: "Verify ZK Proof",
    route: "/payroll/verify",
    roles: ["admin", "operator", "auditor"],
  },

  // ── General / System ─────────────────────────────────────────────────────
  {
    id: "general-cheatsheet",
    category: "general",
    keyDisplay: "?",
    keys: ["?"],
    description: "Open Keyboard Shortcuts Help",
    actionId: "toggle-shortcuts-modal",
    roles: ["admin", "operator", "auditor"],
  },
  {
    id: "general-command-palette",
    category: "general",
    keyDisplay: "Ctrl / Cmd + K",
    keys: ["k"],
    description: "Open Command Palette",
    actionId: "toggle-command-palette",
    roles: ["admin", "operator", "auditor"],
  },
];

/**
 * Detects whether the event target is an interactive text input where
 * single-key shortcuts must be suppressed to avoid conflicting with user typing.
 */
export function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toUpperCase();
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  const role = target.getAttribute("role");
  if (role === "textbox" || role === "searchbox" || role === "combobox") {
    return true;
  }

  return false;
}

/**
 * Validates whether the given role is authorized to execute the shortcut.
 * Returns privacy-safe, actionable reasons without exposing sensitive payroll data.
 */
export function validateShortcut(
  shortcut: KeyboardShortcut,
  role: UserRole,
): ShortcutValidationResult {
  if (!shortcut.roles.includes(role)) {
    if (shortcut.adminOnly) {
      return {
        allowed: false,
        reason: "Access denied: This shortcut requires administrator privileges.",
      };
    }
    return {
      allowed: false,
      reason: `Access denied: This action is not available for the ${role} role.`,
    };
  }

  return { allowed: true };
}

/**
 * Look up a shortcut matching the given key sequence.
 */
export function findShortcutBySequence(
  sequence: string[],
): KeyboardShortcut | undefined {
  if (sequence.length === 1 && sequence[0] === "?") {
    return PAYROLL_SHORTCUTS.find((s) => s.id === "general-cheatsheet");
  }

  return PAYROLL_SHORTCUTS.find((s) => {
    if (s.keys.length !== sequence.length) return false;
    return s.keys.every((k, idx) => k.toLowerCase() === sequence[idx]?.toLowerCase());
  });
}
