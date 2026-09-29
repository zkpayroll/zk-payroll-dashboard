import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import ComplianceManager from "@/components/features/compliance/ComplianceManager";
import { useAuditRequestStore } from "@/stores/auditRequests";
import { useViewKeyStore } from "@/stores/viewKeys";

describe("ComplianceManager audit request intake", () => {
  beforeEach(() => {
    useAuditRequestStore.setState({ requests: [] });
    useViewKeyStore.setState({ viewKeys: [] });
  });

  it("disables generation until the required intake fields are filled", () => {
    render(<ComplianceManager />);

    fireEvent.click(screen.getByRole("button", { name: /generate key/i }));

    expect(screen.getByRole("button", { name: /^generate$/i })).toBeDisabled();
    expect(screen.getByLabelText(/request reason/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/requested expiration/i)).toBeInTheDocument();
  });

  it("stores the request reason, expiry window, and reviewer notes when an access request is submitted", () => {
    render(<ComplianceManager />);

    fireEvent.click(screen.getByRole("button", { name: /generate key/i }));
    fireEvent.change(screen.getByLabelText(/auditor name/i), {
      target: { value: "Sam Rivera" },
    });
    fireEvent.change(screen.getByLabelText(/organization/i), {
      target: { value: "Northwind Audit" },
    });
    fireEvent.change(screen.getByLabelText(/request reason/i), {
      target: { value: "Quarterly payroll controls review" },
    });
    fireEvent.change(screen.getByLabelText(/requested expiration/i), {
      target: { value: "2027-03-01" },
    });
    fireEvent.change(screen.getByLabelText(/reviewer notes/i), {
      target: { value: "Needs read-only access during the controls review." },
    });

    fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));

    const request = useAuditRequestStore.getState().requests.at(-1);
    expect(request).toBeDefined();
    expect(request?.requesterName).toBe("Sam Rivera");
    expect(request?.rationale).toBe("Quarterly payroll controls review");
    expect(request?.requestedExpiresAt).toContain("2027-03-01");
    expect(request?.reviewerNotes).toBe("Needs read-only access during the controls review.");
  });
});
