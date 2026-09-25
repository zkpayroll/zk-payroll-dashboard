import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApprovalExpiryBadge } from "@/components/signing/ApprovalExpiryBadge";
import { evaluateApprovalExpiry } from "@/lib/date/approvalExpiry";

const NOW = new Date("2025-06-15T12:00:00Z").getTime();

describe("evaluateApprovalExpiry", () => {
  it("returns active when expiry is far in future (success path)", () => {
    const expiresAt = new Date(NOW + 7 * 24 * 60 * 60 * 1000).toISOString();
    const eval1 = evaluateApprovalExpiry({ approvedAt: new Date(NOW - 1000).toISOString(), expiresAt, hasApproval: true }, NOW);
    expect(eval1.state).toBe("active");
    expect(eval1.label).toBe("Approval active");
    expect(eval1.blocksExecution).toBe(false);
  });

  it("returns expired when past expiry (failure path)", () => {
    const expiresAt = new Date(NOW - 1000).toISOString();
    const eval1 = evaluateApprovalExpiry({ approvedAt: new Date(NOW - 86400000).toISOString(), expiresAt, hasApproval: true }, NOW);
    expect(eval1.state).toBe("expired");
    expect(eval1.blocksExecution).toBe(true);
  });

  it("returns missing when no approval (edge case)", () => {
    const eval1 = evaluateApprovalExpiry({ hasApproval: false }, NOW);
    expect(eval1.state).toBe("missing");
    expect(eval1.blocksExecution).toBe(true);
  });

  it("returns expiring_soon within window", () => {
    const expiresAt = new Date(NOW + 24 * 60 * 60 * 1000).toISOString(); // 24h
    const eval1 = evaluateApprovalExpiry({ approvedAt: new Date(NOW).toISOString(), expiresAt, hasApproval: true }, NOW);
    expect(eval1.state).toBe("expiring_soon");
  });
});

describe("ApprovalExpiryBadge component", () => {
  it("renders active badge", () => {
    const expiresAt = new Date(NOW + 7 * 24 * 60 * 60 * 1000).toISOString();
    render(<ApprovalExpiryBadge approval={{ approvedAt: new Date(NOW).toISOString(), expiresAt, hasApproval: true }} now={NOW} />);
    expect(screen.getByTestId("approval-expiry-active")).toBeInTheDocument();
    expect(screen.getByText(/Approval active/)).toBeInTheDocument();
  });

  it("renders expiring soon with countdown", () => {
    const expiresAt = new Date(NOW + 24 * 60 * 60 * 1000).toISOString();
    render(<ApprovalExpiryBadge approval={{ approvedAt: new Date(NOW).toISOString(), expiresAt, hasApproval: true }} now={NOW} />);
    expect(screen.getByTestId("approval-expiry-expiring_soon")).toBeInTheDocument();
    expect(screen.getByText(/expiring soon/i)).toBeInTheDocument();
  });

  it("renders expired with renewal link", () => {
    const expiresAt = new Date(NOW - 1000).toISOString();
    render(<ApprovalExpiryBadge approval={{ approvedAt: new Date(NOW - 86400000).toISOString(), expiresAt, hasApproval: true }} now={NOW} />);
    expect(screen.getByTestId("approval-expiry-expired")).toBeInTheDocument();
    expect(screen.getByTestId("approval-renewal-link")).toBeInTheDocument();
  });

  it("renders missing when no approval", () => {
    render(<ApprovalExpiryBadge approval={{ hasApproval: false }} now={NOW} />);
    expect(screen.getByTestId("approval-expiry-missing")).toBeInTheDocument();
    expect(screen.getByText(/Approval missing/)).toBeInTheDocument();
  });

  it("never shows private payroll values", () => {
    const { container } = render(<ApprovalExpiryBadge approval={{ hasApproval: false }} now={NOW} />);
    expect(container.textContent).not.toMatch(/\$\d/);
  });
});
