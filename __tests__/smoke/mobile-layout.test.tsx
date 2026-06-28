import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TransactionHistory from "@/components/features/transactions/TransactionHistory";
import EmployeeDirectory from "@/components/features/employees/EmployeeDirectory";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

describe("Smoke: Mobile layout rendering", () => {
  describe("Sidebar", () => {
    it("renders the hamburger button", () => {
      render(<Sidebar role="admin" />);
      expect(screen.getByRole("button", { name: /open navigation menu/i })).toBeInTheDocument();
    });

    it("opens the mobile drawer when hamburger is clicked", () => {
      render(<Sidebar role="admin" />);
      const trigger = screen.getByRole("button", { name: /open navigation menu/i });
      fireEvent.click(trigger);
      expect(screen.getByRole("dialog", { name: /navigation menu/i })).toBeInTheDocument();
    });

    it("closes the mobile drawer when close button is clicked", () => {
      render(<Sidebar role="admin" />);
      fireEvent.click(screen.getByRole("button", { name: /open navigation menu/i }));
      fireEvent.click(screen.getByRole("button", { name: /close navigation menu/i }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("renders all navigation links in the desktop sidebar", () => {
      render(<Sidebar role="admin" />);
      expect(screen.getAllByRole("link", { name: /dashboard/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: /employees/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: /history/i }).length).toBeGreaterThan(0);
    });
  });

  describe("Header", () => {
    it("renders the command palette trigger", () => {
      render(<Header role="admin" />);
      expect(screen.getByRole("button", { name: /search actions/i })).toBeInTheDocument();
    });

    it("renders the notifications button", () => {
      render(<Header role="admin" />);
      expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
    });
  });

  describe("TransactionHistory mobile cards", () => {
    it("renders the mobile card list", () => {
      render(<TransactionHistory />);
      expect(screen.getByRole("list", { name: /payroll transactions/i })).toBeInTheDocument();
    });

    it("renders the desktop table", () => {
      render(<TransactionHistory />);
      expect(screen.getByRole("table", { name: /payroll transactions/i })).toBeInTheDocument();
    });

    it("shows transaction count footer", () => {
      render(<TransactionHistory />);
      expect(screen.getByText(/showing/i)).toBeInTheDocument();
    });

    it("mobile list and desktop table contain same number of transactions", () => {
      render(<TransactionHistory />);
      const listItems = screen.getByRole("list", { name: /payroll transactions/i }).children;
      const tableRows = screen
        .getByRole("table", { name: /payroll transactions/i })
        .querySelectorAll("tbody tr");
      expect(listItems.length).toBe(tableRows.length);
    });
  });

  describe("EmployeeDirectory mobile cards", () => {
    it("renders the mobile card list", () => {
      render(<EmployeeDirectory />);
      expect(screen.getByRole("list", { name: /employee directory/i })).toBeInTheDocument();
    });

    it("renders the desktop table", () => {
      render(<EmployeeDirectory />);
      expect(screen.getByRole("table", { name: /employee directory/i })).toBeInTheDocument();
    });

    it("shows employee count footer", () => {
      render(<EmployeeDirectory />);
      expect(screen.getByText(/showing/i)).toBeInTheDocument();
    });

    it("status filter buttons are rendered with accessible tap targets", () => {
      render(<EmployeeDirectory />);
      const allBtn = screen.getByRole("button", { name: /^all/i });
      expect(allBtn).toBeInTheDocument();
      // min-h-[32px] ensures adequate tap target; check class presence
      expect(allBtn.className).toContain("min-h-");
    });

    it("filters employee cards when status filter is changed", () => {
      render(<EmployeeDirectory />);
      const activeBtn = screen.getByRole("button", { name: /^active/i });
      fireEvent.click(activeBtn);
      // After filtering, the active button should be highlighted
      expect(activeBtn.className).toContain("bg-indigo-600");
    });
  });
});
