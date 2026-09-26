import type { UserRole } from "@/types";

export type ShortcutCategory = "navigation" | "actions" | "general";

export interface KeyboardShortcut {
  id: string;
  category: ShortcutCategory;
  /** Human-readable key representation, e.g. "g then p" or "?" */
  keyDisplay: string;
  /** Primary sequence keys, e.g. ["g", "p"] */
  keys: string[];
  /** Description of the action performed */
  description: string;
  /** Target navigation route, if this is a navigation shortcut */
  route?: string;
  /** Action identifier for non-route actions */
  actionId?: string;
  /** Roles allowed to execute this shortcut */
  roles: UserRole[];
  /** Whether the shortcut is admin-only */
  adminOnly?: boolean;
}

export interface ShortcutValidationResult {
  allowed: boolean;
  reason?: string;
}
