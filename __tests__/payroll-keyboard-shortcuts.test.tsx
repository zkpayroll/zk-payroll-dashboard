/**
 * #467 Add keyboard shortcuts for common payroll actions
 *
 * Tests cover:
 *   1. Shortcut lookup and validation unit tests
 *   2. Input collision isolation (WCAG 2.1.4)
 *   3. Role authorization checks (privacy-safe failure messages)
 *   4. KeyboardShortcutsModal rendering and accessibility
 *   5. Shortcut interaction flow (sequence execution and input suppression)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  PAYROLL_SHORTCUTS,
  findShortcutBySequence,
  isInputElement,
  validateShortcut,
} from "@/src/lib/shortcuts";
import { useKeyboardShortcutsStore } from "@/stores/keyboardShortcuts";
import KeyboardShortcutsModal from "@/components/features/shortcuts/KeyboardShortcutsModal";
import DashboardLayout from "@/components/layout/DashboardLayout";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/",
}));

// Mock useSession hook
let mockRole: "admin" | "operator" | "auditor" = "admin";
vi.mock("@/hooks/useSession", () => ({
  useSession: () => ({
    sessionInfo: {
      role: mockRole,
      publicKey: "GBTEST...",
      expiresAt: Date.now() + 3600000,
    },
    sessionState: "active",
  }),
}));

describe("Payroll Keyboard Shortcuts - Unit Logic", () => {
  it("finds navigation shortcuts by sequence", () => {
    const shortcut = findShortcutBySequence(["g", "p"]);
    expect(shortcut).toBeDefined();
    expect(shortcut?.id).toBe("nav-payroll-execute");
    expect(shortcut?.route).toBe("/payroll/execute");
  });

  it("finds cheatsheet shortcut by '?'", () => {
    const shortcut = findShortcutBySequence(["?"]);
    expect(shortcut).toBeDefined();
    expect(shortcut?.id).toBe("general-cheatsheet");
  });

  it("returns undefined for unknown sequence", () => {
    const shortcut = findShortcutBySequence(["x", "y"]);
    expect(shortcut).toBeUndefined();
  });

  describe("isInputElement collision detection", () => {
    it("identifies input elements as editable", () => {
      const input = document.createElement("input");
      expect(isInputElement(input)).toBe(true);

      const textarea = document.createElement("textarea");
      expect(isInputElement(textarea)).toBe(true);

      const select = document.createElement("select");
      expect(isInputElement(select)).toBe(true);
    });

    it("identifies contenteditable and ARIA textbox elements", () => {
      const div = document.createElement("div");
      div.contentEditable = "true";
      expect(isInputElement(div)).toBe(true);

      const customBox = document.createElement("div");
      customBox.setAttribute("role", "textbox");
      expect(isInputElement(customBox)).toBe(true);
    });

    it("returns false for non-editable elements", () => {
      const div = document.createElement("div");
      expect(isInputElement(div)).toBe(false);

      const button = document.createElement("button");
      expect(isInputElement(button)).toBe(false);

      expect(isInputElement(null)).toBe(false);
    });
  });

  describe("validateShortcut authorization", () => {
    it("allows admin to access all shortcuts", () => {
      PAYROLL_SHORTCUTS.forEach((shortcut) => {
        if (shortcut.roles.includes("admin")) {
          const res = validateShortcut(shortcut, "admin");
          expect(res.allowed).toBe(true);
        }
      });
    });

    it("denies operator from accessing admin-only shortcuts (e.g. Treasury)", () => {
      const treasuryShortcut = PAYROLL_SHORTCUTS.find((s) => s.id === "nav-treasury")!;
      const res = validateShortcut(treasuryShortcut, "operator");
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("administrator privileges");
      expect(res.reason).not.toMatch(/\$|\d+|salary|balance/i);
    });

    it("denies auditor from executing payroll run action", () => {
      const runShortcut = PAYROLL_SHORTCUTS.find((s) => s.id === "action-new-payroll")!;
      const res = validateShortcut(runShortcut, "auditor");
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("auditor");
    });
  });
});

describe("KeyboardShortcutsModal Component", () => {
  beforeEach(() => {
    mockRole = "admin";
    useKeyboardShortcutsStore.setState({ isModalOpen: false, enabled: true });
  });

  it("does not render when closed", () => {
    render(<KeyboardShortcutsModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders with accessible dialog attributes when open", () => {
    useKeyboardShortcutsStore.setState({ isModalOpen: true });
    render(<KeyboardShortcutsModal />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Go to Execute Payroll")).toBeInTheDocument();
  });

  it("toggles single-key shortcuts preference", async () => {
    const user = userEvent.setup();
    useKeyboardShortcutsStore.setState({ isModalOpen: true, enabled: true });
    render(<KeyboardShortcutsModal />);

    const checkbox = screen.getByRole("checkbox", {
      name: /enable character-key sequences/i,
    });
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(useKeyboardShortcutsStore.getState().enabled).toBe(false);
  });

  it("closes dialog when close button is clicked", async () => {
    const user = userEvent.setup();
    useKeyboardShortcutsStore.setState({ isModalOpen: true });
    render(<KeyboardShortcutsModal />);

    const closeBtn = screen.getByRole("button", {
      name: /close keyboard shortcuts dialog/i,
    });
    await user.click(closeBtn);

    expect(useKeyboardShortcutsStore.getState().isModalOpen).toBe(false);
  });
});

describe("DashboardLayout Keyboard Shortcuts Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = "admin";
    useKeyboardShortcutsStore.setState({
      isModalOpen: false,
      enabled: true,
      pendingSequence: null,
    });
  });

  it("opens cheatsheet modal when '?' is pressed", () => {
    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    fireEvent.keyDown(window, { key: "?" });
    expect(useKeyboardShortcutsStore.getState().isModalOpen).toBe(true);
  });

  it("executes 'g' then 'p' navigation to /payroll/execute for admin", () => {
    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "p" });

    expect(mockPush).toHaveBeenCalledWith("/payroll/execute");
  });

  it("executes 'g' then 'e' navigation to /employees", () => {
    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "e" });

    expect(mockPush).toHaveBeenCalledWith("/employees");
  });

  it("does NOT execute shortcut when user is typing inside an input", () => {
    render(
      <DashboardLayout>
        <input data-testid="search-input" />
      </DashboardLayout>
    );

    const input = screen.getByTestId("search-input");
    input.focus();

    fireEvent.keyDown(input, { key: "g" });
    fireEvent.keyDown(input, { key: "p" });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does NOT navigate when non-admin attempts admin-only shortcut", () => {
    mockRole = "operator";

    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    // 'g' then 't' is Treasury (admin only)
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "t" });

    expect(mockPush).not.toHaveBeenCalledWith("/treasury");
  });

  it("does NOT trigger sequences when user disabled single-key shortcuts", () => {
    useKeyboardShortcutsStore.setState({ enabled: false });

    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "p" });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("closes modal on Escape key press", () => {
    useKeyboardShortcutsStore.setState({ isModalOpen: true });

    render(
      <DashboardLayout>
        <div>Content</div>
      </DashboardLayout>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(useKeyboardShortcutsStore.getState().isModalOpen).toBe(false);
  });
});
