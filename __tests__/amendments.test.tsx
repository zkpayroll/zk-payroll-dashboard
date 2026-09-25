import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  MOCK_AMENDMENTS,
  validateAmendmentPlan,
  getAmendmentSafeDiff,
  formatAsset,
} from "@/lib/sdk/amendments";
import {
  AMENDMENT_PRIVACY_NOTICE,
  formatCommitmentShort,
  buildAmendmentPrivacySummary,
} from "@/lib/privacy/amendments";
import AmendmentList from "@/src/components/amendments/AmendmentList";
import AmendmentDiff from "@/src/components/amendments/AmendmentDiff";
import AmendmentDetail from "@/src/components/amendments/AmendmentDetail";
import AmendmentApproval from "@/src/components/amendments/AmendmentApproval";

// Helper to find fixtures
const validAmendment = MOCK_AMENDMENTS.find((a) => a.id === "amd_valid_001")!;
const staleAmendment = MOCK_AMENDMENTS.find((a) => a.id === "amd_stale_001")!;
const blockedAmendment = MOCK_AMENDMENTS.find((a) => a.id === "amd_blocked_001")!;
const failedAmendment = MOCK_AMENDMENTS.find((a) => a.id === "amd_failed_001")!;
const approvedAmendment = MOCK_AMENDMENTS.find((a) => a.id === "amd_approved_001")!;
const policyInvalidAmendment = MOCK_AMENDMENTS.find((a) => a.id === "amd_policy_invalid_001")!;

describe("validateAmendmentPlan — SDK blocking logic", () => {
  it("allows approval for a valid pending amendment", () => {
    const v = validateAmendmentPlan(validAmendment);
    expect(v.canApprove).toBe(true);
    expect(v.isStale).toBe(false);
    expect(v.isPolicyValid).toBe(true);
    expect(v.isBlocked).toBe(false);
    expect(v.nextSteps).toMatch(/Review safe metadata/i);
  });

  it("blocks approval for a stale amendment and surfaces next steps", () => {
    const v = validateAmendmentPlan(staleAmendment);
    expect(v.canApprove).toBe(false);
    expect(v.isStale).toBe(true);
    expect(v.isBlocked).toBe(true);
    expect(v.blockedReason).toMatch(/stale/i);
    expect(v.nextSteps).toMatch(/fresh amendment/i);
  });

  it("blocks approval for a policy-invalid amendment", () => {
    const v = validateAmendmentPlan(policyInvalidAmendment);
    expect(v.canApprove).toBe(false);
    expect(v.isPolicyValid).toBe(false);
    expect(v.isBlocked).toBe(true);
    expect(v.blockedReason).toMatch(/policy|allow-list|window/i);
    expect(v.nextSteps).toMatch(/policy/i);
  });

  it("marks blocked status as not approvable", () => {
    const v = validateAmendmentPlan(blockedAmendment);
    expect(v.canApprove).toBe(false);
    expect(v.isBlocked).toBe(true);
  });

  it("marks failed status as not approvable with regeneration guidance", () => {
    const v = validateAmendmentPlan(failedAmendment);
    expect(v.canApprove).toBe(false);
    expect(v.isBlocked).toBe(true);
    expect(v.nextSteps).toMatch(/Regenerate/i);
  });

  it("marks approved as not needing re-approval but not blocked in the same way", () => {
    const v = validateAmendmentPlan(approvedAmendment);
    expect(v.canApprove).toBe(false);
    expect(v.nextSteps).toMatch(/already approved/i);
  });
});

describe("getAmendmentSafeDiff — safe metadata diff", () => {
  it("exposes commitment version, employee reference, period, asset, approval status", () => {
    const diff = getAmendmentSafeDiff(validAmendment);
    const labels = diff.fields.map((f) => f.label);
    expect(labels).toContain("Commitment version");
    expect(labels).toContain("Employee reference");
    expect(labels).toContain("Period");
    expect(labels).toContain("Asset");
    expect(labels).toContain("Approval status");
    expect(labels).toContain("Commitment hash");
  });

  it("detects commitment version change", () => {
    const diff = getAmendmentSafeDiff(validAmendment);
    const versionField = diff.fields.find((f) => f.label === "Commitment version")!;
    expect(versionField.changed).toBe(true);
    expect(versionField.before).toBe("v2");
    expect(versionField.after).toBe("v3");
  });

  it("keeps employee reference, period, asset stable", () => {
    const diff = getAmendmentSafeDiff(validAmendment);
    const emp = diff.fields.find((f) => f.label === "Employee reference")!;
    const period = diff.fields.find((f) => f.label === "Period")!;
    const asset = diff.fields.find((f) => f.label === "Asset")!;
    expect(emp.changed).toBe(false);
    expect(period.changed).toBe(false);
    expect(asset.changed).toBe(false);
    expect(emp.before).toBe(validAmendment.employeeReference);
    expect(period.before).toBe(validAmendment.period);
    expect(asset.before).toBe(formatAsset(validAmendment.asset));
  });

  it("never exposes raw salary values", () => {
    const diff = getAmendmentSafeDiff(validAmendment);
    const text = JSON.stringify(diff);
    // Raw salary amounts must not appear — fixtures have no salary fields at all
    expect(text).not.toMatch(/5000|4500|5200/);
  });
});

describe("privacy helpers", () => {
  it("formatCommitmentShort truncates long hashes privacy-safely", () => {
    const short = formatCommitmentShort(validAmendment.nextCommitment);
    expect(short).toContain("…");
    expect(short.length).toBeLessThan(validAmendment.nextCommitment.length);
  });

  it("buildAmendmentPrivacySummary contains only safe fields and privacy notice", () => {
    const summary = buildAmendmentPrivacySummary(validAmendment);
    expect(summary).toContain("Employee: Employee #1");
    expect(summary).toContain("Period: 2025-03");
    expect(summary).toContain("Asset: USDC");
    expect(summary).toContain(AMENDMENT_PRIVACY_NOTICE);
    // Privacy-safe: mentions salary concept but never raw amounts
    expect(summary).not.toMatch(/5000/);
    expect(summary).not.toMatch(/\$\s*5,?000/);
  });

  it("AMENDMENT_PRIVACY_NOTICE mentions encryption and safe metadata", () => {
    expect(AMENDMENT_PRIVACY_NOTICE).toMatch(/encrypted/i);
    expect(AMENDMENT_PRIVACY_NOTICE).toMatch(/commitment/i);
  });
});

describe("AmendmentList component", () => {
  it("shows loading state", () => {
    render(<AmendmentList initialState="loading" />);
    expect(screen.getByTestId("amendment-list-loading")).toBeInTheDocument();
  });

  it("shows empty state with privacy notice", () => {
    render(<AmendmentList amendments={[]} />);
    expect(screen.getByTestId("amendment-list-empty")).toBeInTheDocument();
    expect(screen.getByText(/No amendments to review/i)).toBeInTheDocument();
    expect(screen.getByText(AMENDMENT_PRIVACY_NOTICE)).toBeInTheDocument();
  });

  it("renders valid, stale, blocked, failed, and approved amendments", () => {
    render(<AmendmentList amendments={MOCK_AMENDMENTS} />);
    expect(screen.getByTestId("amendment-card-amd_valid_001")).toBeInTheDocument();
    expect(screen.getByTestId("amendment-card-amd_stale_001")).toBeInTheDocument();
    expect(screen.getByTestId("amendment-card-amd_blocked_001")).toBeInTheDocument();
    expect(screen.getByTestId("amendment-card-amd_failed_001")).toBeInTheDocument();
    expect(screen.getByTestId("amendment-card-amd_approved_001")).toBeInTheDocument();
  });

  it("marks stale amendment with badge and blocked reason", () => {
    render(<AmendmentList amendments={[staleAmendment]} />);
    expect(screen.getByTestId(`amendment-stale-${staleAmendment.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`amendment-blocked-reason-${staleAmendment.id}`)).toBeInTheDocument();
  });

  it("marks policy-invalid amendment and blocks approval link", () => {
    render(<AmendmentList amendments={[policyInvalidAmendment]} />);
    expect(screen.getByTestId(`amendment-policy-invalid-${policyInvalidAmendment.id}`)).toBeInTheDocument();
    const approveLink = screen.getByTestId(`amendment-approve-link-${policyInvalidAmendment.id}`);
    expect(approveLink).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps private salary values out of rendered output", () => {
    render(<AmendmentList amendments={MOCK_AMENDMENTS} />);
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("5000");
    expect(text).toContain("Salary values encrypted");
  });

  it("shows safe diff metadata for each card (period, asset, commitment version)", () => {
    render(<AmendmentList amendments={[validAmendment]} />);
    const card = screen.getByTestId(`amendment-card-${validAmendment.id}`);
    expect(within(card).getAllByText(/2025-03/).length).toBeGreaterThan(0);
    expect(within(card).getAllByText(/USDC/).length).toBeGreaterThan(0);
    expect(within(card).getByText(/Employee #1/)).toBeInTheDocument();
  });
});

describe("AmendmentDiff component", () => {
  it("renders safe metadata without raw salary values", () => {
    render(<AmendmentDiff amendment={validAmendment} />);
    expect(screen.getByTestId("amendment-diff")).toBeInTheDocument();
    expect(screen.getByText("Commitment version")).toBeInTheDocument();
    expect(screen.getByText("Employee reference")).toBeInTheDocument();
    expect(screen.getByText("Period")).toBeInTheDocument();
    expect(screen.getByText("Asset")).toBeInTheDocument();
    expect(screen.getByText("Approval status")).toBeInTheDocument();
    // Commitment hashes truncated
    expect(screen.getByText(/0xabc123/)).toBeInTheDocument();
    expect(screen.getByText(/0xdef789/)).toBeInTheDocument();
    // Privacy notice
    expect(screen.getByText(AMENDMENT_PRIVACY_NOTICE)).toBeInTheDocument();
    // No salary
    expect(document.body.textContent).not.toMatch(/\$\s*5,?000/);
  });

  it("shows approval status badge", () => {
    render(<AmendmentDiff amendment={blockedAmendment} />);
    expect(screen.getByTestId("amendment-approval-status")).toHaveTextContent("blocked");
  });

  it("shows next steps privacy copy in footer", () => {
    render(<AmendmentDiff amendment={validAmendment} />);
    expect(screen.getByText(/Salary values remain encrypted/i)).toBeInTheDocument();
  });
});

describe("AmendmentDetail component", () => {
  it("shows loading state", () => {
    render(<AmendmentDetail amendmentId="amd_valid_001" initialState="loading" />);
    expect(screen.getByTestId("amendment-detail-loading")).toBeInTheDocument();
  });

  it("shows empty state for unknown id", () => {
    render(<AmendmentDetail amendmentId="unknown" amendment={null} />);
    expect(screen.getByTestId("amendment-detail-empty")).toBeInTheDocument();
  });

  it("shows error state", () => {
    render(<AmendmentDetail amendmentId="amd_valid_001" initialState="error" />);
    expect(screen.getByTestId("amendment-detail-error")).toBeInTheDocument();
  });

  it("renders valid amendment with safe diff and privacy notice", () => {
    render(<AmendmentDetail amendmentId={validAmendment.id} amendment={validAmendment} />);
    expect(screen.getByTestId("amendment-diff")).toBeInTheDocument();
    expect(screen.getAllByText(AMENDMENT_PRIVACY_NOTICE).length).toBeGreaterThan(0);
    expect(screen.getByTestId("amendment-approval-cta")).toBeInTheDocument();
  });

  it("shows blocked state for stale amendment", () => {
    render(<AmendmentDetail amendmentId={staleAmendment.id} amendment={staleAmendment} initialState="blocked" />);
    expect(screen.getByTestId("amendment-blocked")).toBeInTheDocument();
    expect(screen.getByText(/Stale commitment/i)).toBeInTheDocument();
  });

  it("shows approved state", () => {
    render(<AmendmentDetail amendmentId={approvedAmendment.id} amendment={approvedAmendment} initialState="approved" />);
    expect(screen.getByTestId("amendment-approved")).toBeInTheDocument();
    expect(screen.getByText(/Amendment approved/i)).toBeInTheDocument();
  });

  it("shows failed state", () => {
    render(<AmendmentDetail amendmentId={failedAmendment.id} amendment={failedAmendment} initialState="failed" />);
    // Failed amendments are also blocked; component shows blocked banner with failed messaging
    expect(screen.getByTestId("amendment-blocked")).toBeInTheDocument();
    expect(screen.getAllByText(/failed/i).length).toBeGreaterThan(0);
  });

  it("does not expose raw salary values", () => {
    render(<AmendmentDetail amendmentId={validAmendment.id} amendment={validAmendment} />);
    expect(document.body.textContent).not.toContain("5000");
  });
});

describe("AmendmentApproval component — blocks stale/policy-invalid", () => {
  it("shows loading state", () => {
    render(<AmendmentApproval amendmentId="amd_valid_001" initialState="loading" />);
    expect(screen.getByTestId("amendment-approval-loading")).toBeInTheDocument();
  });

  it("shows approved state with privacy notice", () => {
    render(<AmendmentApproval amendmentId={approvedAmendment.id} amendment={approvedAmendment} initialState="approved" />);
    expect(screen.getByTestId("amendment-approved-state")).toBeInTheDocument();
    expect(screen.getByText(/Amendment approved/i)).toBeInTheDocument();
  });

  it("shows failed state with retry", () => {
    render(<AmendmentApproval amendmentId={failedAmendment.id} amendment={failedAmendment} initialState="failed" />);
    expect(screen.getByTestId("amendment-failed-state")).toBeInTheDocument();
    expect(screen.getByTestId("amendment-retry-button")).toBeInTheDocument();
  });

  it("blocks approval for stale amendment and disables approve button", () => {
    render(<AmendmentApproval amendmentId={staleAmendment.id} amendment={staleAmendment} />);
    expect(screen.getByTestId("amendment-blocked-state")).toBeInTheDocument();
    expect(screen.getByTestId("amendment-blocked")).toBeInTheDocument();
    expect(screen.getByText(/Stale commitment/i)).toBeInTheDocument();
    expect(screen.getByTestId("amendment-approve-disabled")).toBeDisabled();
    expect(screen.getAllByText(/fresh amendment/i).length).toBeGreaterThan(0);
  });

  it("blocks approval for policy-invalid amendment", () => {
    render(<AmendmentApproval amendmentId={policyInvalidAmendment.id} amendment={policyInvalidAmendment} />);
    expect(screen.getByTestId("amendment-blocked-state")).toBeInTheDocument();
    expect(screen.getByText(/Policy violation/i)).toBeInTheDocument();
    expect(screen.getByTestId("amendment-approve-disabled")).toBeDisabled();
  });

  it("allows approval for valid pending amendment", () => {
    render(<AmendmentApproval amendmentId={validAmendment.id} amendment={validAmendment} />);
    expect(screen.getByTestId("amendment-approval")).toBeInTheDocument();
    const btn = screen.getByTestId("amendment-approve-button");
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent(/Confirm approval/i);
    expect(screen.getAllByText(/Salary values remain encrypted/i).length).toBeGreaterThan(0);
  });

  it("requires next steps to be clear for blocked state", () => {
    render(<AmendmentApproval amendmentId={blockedAmendment.id} amendment={blockedAmendment} />);
    expect(screen.getByText(/Required next steps/i)).toBeInTheDocument();
    expect(screen.getByText(/fresh amendment|Correct the amendment/i)).toBeInTheDocument();
  });

  it("keeps salary values private in approval screen", () => {
    render(<AmendmentApproval amendmentId={validAmendment.id} amendment={validAmendment} />);
    expect(document.body.textContent).not.toContain("5000");
    expect(document.body.textContent).toContain("encrypted");
  });

  it("shows approval status and required next steps are clear for valid amendment", () => {
    render(<AmendmentApproval amendmentId={validAmendment.id} amendment={validAmendment} />);
    expect(screen.getAllByText(/Review safe metadata/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId("amendment-diff")).toBeInTheDocument();
  });
});
