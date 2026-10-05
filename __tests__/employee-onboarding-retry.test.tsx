import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EmployeeDirectory from "@/components/features/employees/EmployeeDirectory";
import { useEmployeeStore } from "@/stores/employees";

describe("Employee onboarding retry flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useEmployeeStore.getState().setEmployees([]);
  });

  it("lets operators retry an onboarding failure from the directory", () => {
    render(<EmployeeDirectory />);

    const retryButtons = screen.getAllByRole("button", { name: /retry onboarding/i });
    expect(retryButtons.length).toBeGreaterThan(0);

    fireEvent.click(retryButtons[0]);

    expect(screen.getByRole("dialog", { name: /employee details/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /retry scheduled/i }).length).toBeGreaterThan(0);
  });
});
