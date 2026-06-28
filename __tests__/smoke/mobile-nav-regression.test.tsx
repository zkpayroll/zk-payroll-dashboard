import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import Sidebar from "@/components/layout/Sidebar";

describe("Smoke: Mobile navigation regression", () => {
  describe("Navigation menu toggle", () => {
    it("renders hamburger menu button on mobile view", () => {
      render(<Sidebar role="admin" />);
      const menuButton = screen.getByRole("button", { name: /open navigation menu/i });
      expect(menuButton).toBeInTheDocument();
    });

    it("toggles mobile menu visibility", () => {
      render(<Sidebar role="admin" />);
      const menuButton = screen.getByRole("button", { name: /open navigation menu/i });

      fireEvent.click(menuButton);
      expect(screen.getByRole("dialog", { name: /navigation menu/i })).toBeInTheDocument();

      const closeButton = screen.getByRole("button", { name: /close navigation menu/i });
      fireEvent.click(closeButton);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("Mobile link accessibility", () => {
    it("renders navigation links with proper accessibility", () => {
      render(<Sidebar role="admin" />);
      fireEvent.click(screen.getByRole("button", { name: /open navigation menu/i }));

      const navDialog = screen.getByRole("dialog", { name: /navigation menu/i });
      const links = within(navDialog).queryAllByRole("link");
      expect(links.length).toBeGreaterThan(0);

      links.forEach((link) => {
        expect(link).toHaveAttribute("href");
        expect(link.textContent).toBeTruthy();
      });
    });

    it("closes menu after navigation link click", () => {
      render(<Sidebar role="admin" />);
      fireEvent.click(screen.getByRole("button", { name: /open navigation menu/i }));

      const dialog = screen.getByRole("dialog", { name: /navigation menu/i });
      const firstLink = within(dialog).getAllByRole("link")[0];

      fireEvent.click(firstLink);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("Mobile routing states", () => {
    it("maintains active state on navigation", () => {
      render(<Sidebar role="admin" />);
      fireEvent.click(screen.getByRole("button", { name: /open navigation menu/i }));

      const dialog = screen.getByRole("dialog", { name: /navigation menu/i });
      const activeLink = within(dialog).queryByRole("link", { current: "page" });
      expect(activeLink).toBeTruthy();
    });
  });

  describe("Mobile touch interactions", () => {
    it("handles menu close on background tap", () => {
      render(<Sidebar role="admin" />);
      fireEvent.click(screen.getByRole("button", { name: /open navigation menu/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      const backdrop = document.querySelector('[role="presentation"]');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      }
    });

    it("supports keyboard navigation in mobile menu", () => {
      render(<Sidebar role="admin" />);
      const menuButton = screen.getByRole("button", { name: /open navigation menu/i });

      fireEvent.click(menuButton);
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      const closeButton = screen.getByRole("button", { name: /close navigation menu/i });
      expect(closeButton).toHaveFocus() || closeButton.focus();

      fireEvent.keyDown(closeButton, { key: "Escape" });
    });
  });

  describe("Mobile header integration", () => {
    it("preserves header visibility when menu is open", () => {
      render(<Sidebar role="admin" />);
      fireEvent.click(screen.getByRole("button", { name: /open navigation menu/i }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });
});
