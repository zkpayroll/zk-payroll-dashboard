import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AuditorAccessExpiryBadge from "@/components/features/compliance/AuditorAccessExpiryBadge";
import AuditorAccessExpirationBanner from "@/components/features/compliance/AuditorAccessExpirationBanner";
import type { ViewKey } from "@/types";

const NOW = Date.UTC(2026, 9, 1);
const DAY = 24 * 60 * 60 * 1000;
const key = (expiresAt: string, overrides: Partial<ViewKey> = {}): ViewKey => ({
  id: "grant-test",
  keyId: "public-grant-ref",
  auditorName: "Test Auditor",
  auditorOrg: "Audit Org",
  scope: "read-only",
  grantedBy: "Admin",
  createdAt: new Date(NOW - DAY).toISOString(),
  expiresAt,
  isActive: true,
  ...overrides,
});

describe("auditor grant expiry component boundaries (#915)", () => {
  it("marks an active grant at the exact warning threshold as expiring soon", () => {
    render(<AuditorAccessExpiryBadge viewKey={key(new Date(NOW + 7 * DAY).toISOString())} now={NOW} />);
    expect(screen.getByTestId("auditor-access-expiry-expiring_soon")).toBeInTheDocument();
  });

  it("marks an active grant at the exact expiry timestamp as expired", () => {
    render(<AuditorAccessExpiryBadge viewKey={key(new Date(NOW).toISOString())} now={NOW} />);
    expect(screen.getByTestId("auditor-access-expiry-expired")).toBeInTheDocument();
  });

  it("does not show a warning for a revoked or inactive grant", () => {
    const { container } = render(
      <AuditorAccessExpirationBanner now={NOW} viewKeysSelector={() => [
        key(new Date(NOW - DAY).toISOString(), { isActive: false, revokedAt: new Date(NOW - DAY).toISOString() }),
      ]} />,
    );
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("warns before expiry and reports expired grants without private payroll data", () => {
    const { rerender } = render(
      <AuditorAccessExpirationBanner now={NOW} viewKeysSelector={() => [key(new Date(NOW + DAY).toISOString())]} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/expires in 1 day/i);
    rerender(<AuditorAccessExpirationBanner now={NOW} viewKeysSelector={() => [key(new Date(NOW - DAY).toISOString())]} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/expired/i);
    expect(screen.getByRole("alert").textContent).not.toMatch(/salary|bank account|payroll amount/i);
  });

  it("treats invalid expiry metadata as unknown rather than granting false certainty", () => {
    render(<AuditorAccessExpiryBadge viewKey={key("invalid")} now={NOW} />);
    expect(screen.getByTestId("auditor-access-expiry-unknown")).toBeInTheDocument();
  });
});
