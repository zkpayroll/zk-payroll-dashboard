# Keyboard Shortcuts Guide

## Overview

The ZK Payroll Dashboard provides a streamlined keyboard navigation and action system designed for fast, accessible, and error-free day-to-day payroll operations.

---

## Keyboard Shortcuts Cheat Sheet

### General & Help
| Shortcut | Action | Description |
|---|---|---|
| `?` | Open Shortcuts Guide | Opens the interactive keyboard shortcut reference modal |
| `Ctrl + K` or `Cmd + K` | Open Command Palette | Global quick search and command execution |
| `Esc` | Close / Dismiss | Closes any open modal, dialog, drawer, or pending shortcut sequence |

### Navigation Sequences
Press the first key (`g`), followed by the second key within 1.2 seconds:

| Sequence | Target Destination | Required Role |
|---|---|---|
| `g` then `d` | **Dashboard Home** (`/`) | All roles |
| `g` then `p` | **Execute Payroll** (`/payroll/execute`) | Admin, Operator |
| `g` then `e` | **Employee Directory** (`/employees`) | Admin, Operator |
| `g` then `h` | **Transaction History** (`/history`) | All roles |
| `g` then `a` | **Approval Queue** (`/payroll/approvals`) | Admin, Operator |
| `g` then `t` | **Treasury Management** (`/treasury`) | Admin only |
| `g` then `c` | **Compliance Center** (`/compliance`) | Admin, Auditor |
| `g` then `s` | **Settings** (`/settings`) | All roles |

### Common Actions
| Sequence | Action | Required Role | Notes |
|---|---|---|---|
| `c` then `p` | **Create New Payroll** | Admin, Operator | Navigates to payroll initiation flow |
| `c` then `e` | **Add Employee** | Admin only | Navigates to employee creation |
| `c` then `v` | **Generate View Key** | Admin only | Navigates to compliance view-key generation |
| `p` then `v` | **Verify Proof** | All roles | Opens the ZK proof verification screen |

---

## Accessibility & Conflict Prevention (WCAG 2.1.4 Compliance)

The shortcut architecture adheres to **WCAG 2.1 Success Criterion 2.1.4 (Character Key Shortcuts)**:

1. **Input Isolation:**
   - Single-character shortcuts and sequences are automatically suppressed whenever the user focuses on any editable element (`<input>`, `<textarea>`, `<select>`, `contenteditable="true"`, or ARIA `role="textbox"`).
   - Typing regular words into search boxes or form fields will never trigger a shortcut.

2. **Modifier Key Isolation:**
   - Browser and assistive technology defaults (`Ctrl + C`, `Ctrl + V`, `Ctrl + R`, `Alt + Tab`, etc.) are never captured or overridden.

3. **User Preference Toggle:**
   - Users of screen readers or speech-to-text input can disable single-key sequences at any time via the checkbox in the **Keyboard Shortcuts modal (`?`)**.
   - This preference is persisted locally in the browser (`zk-payroll-keyboard-shortcuts`).

4. **Screen Reader Announcements:**
   - Every shortcut trigger is announced to assistive technologies via the application's polite live region (`aria-live="polite"`).
   - Unauthorized attempts produce assertive screen-reader warnings without leaking sensitive payroll figures.

---

## Authorization & Privacy

- **Role Gating:** Shortcuts tied to restricted operations (e.g. Treasury access, Employee onboarding) verify the active user session role.
- **Privacy-Safe Feedback:** When an unauthorized user triggers an admin-only shortcut, an actionable error notification is displayed (e.g., *"Access denied: This shortcut requires administrator privileges."*). No sensitive values such as treasury balances or salary commitments are ever displayed in failure states.

---

## Reproducible QA Steps

### QA-1: Successful Navigation via Two-Key Sequence
1. Ensure focus is on the main document body (click outside of any form field).
2. Press `g`, then press `p`.
3. **Expected Result:** The application immediately navigates to `/payroll/execute`, announces the route change via the live region, and displays the payroll execution screen.

### QA-2: Input Collision Isolation (Edge Case)
1. Navigate to any page with a text input (e.g., Command Palette search or an employee form).
2. Focus inside the input field.
3. Type `"good payroll"` (which contains `g` and `p`).
4. **Expected Result:** The characters `"good payroll"` are typed into the text field normally. No shortcut sequence is triggered and no navigation occurs.

### QA-3: Role Authorization Protection
1. Log in with an **operator** or **auditor** role.
2. Press `g`, then press `t` (Treasury navigation, which is admin-only).
3. **Expected Result:** Navigation is blocked. An actionable error toast informs the user that administrator privileges are required. No financial or treasury data is exposed.

### QA-4: Toggle Shortcuts Preference (WCAG 2.1.4)
1. Press `?` to open the Keyboard Shortcuts modal.
2. Uncheck `"Enable character-key sequences (e.g. 'g' then 'p')"`.
3. Press `Esc` to close the modal.
4. Press `g`, then `p`.
5. **Expected Result:** No shortcut sequence is initiated and no navigation occurs.
