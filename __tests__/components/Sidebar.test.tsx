import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Sidebar from "../../components/layout/Sidebar";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock hooks
vi.mock("@/hooks/useSidebarBadges", () => ({
  useSidebarBadges: () => ({}),
}));

describe("Sidebar", () => {
  it("renders desktop and mobile navigation items based on role", () => {
    render(<Sidebar role="admin" />);
    
    // Desktop role sidebar should show Company Setup for admin
    expect(screen.getAllByText("Company Setup").length).toBeGreaterThan(0);
  });

  it("disables or hides restricted navigation items based on role", () => {
    render(<Sidebar role="operator" />);
    
    // Operator does not have access to Company Setup, it should be hidden
    expect(screen.queryByText("Company Setup")).toBeNull();
    
    // Treasury should be visible but disabled
    const treasuryElements = screen.getAllByText("Treasury");
    expect(treasuryElements.length).toBeGreaterThan(0);
    // The closest span or link should have aria-disabled if disabled
    const disabledTreasury = treasuryElements.find(el => el.closest('span[aria-disabled="true"]'));
    expect(disabledTreasury).toBeDefined();
  });
});
