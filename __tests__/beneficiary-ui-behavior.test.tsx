import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import BeneficiaryChangesView from "@/components/features/beneficiaries/BeneficiaryChangesView";
import {
  createBeneficiaryChangeRequest,
  type BeneficiaryChangeRequest,
} from "@/src/payroll/beneficiaryChangeVerificationWorkflow";

const VALID_CURRENT = "GBUQWP3BOUZX34ULNQG23RQ6F4BVWCIYU2IAMRU5MPJUJJZI7DNVMD56";
const VALID_PROPOSED = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF7E";

describe("BeneficiaryChangesView UI Behavior (#906)", () => {
  it("renders the beneficiary management header and aggregate status card", () => {
    render(<BeneficiaryChangesView defaultCurrentAddress={VALID_CURRENT} />);

    expect(screen.getByText("Beneficiary Management")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-beneficiary-verification")).toBeInTheDocument();
    expect(screen.getByTestId("beneficiary-new-address-input")).toBeInTheDocument();
  });

  describe("Initiating a beneficiary change request (Success, Failure, Boundary)", () => {
    it("successfully creates a request when input is valid and confirmed (success path)", () => {
      render(<BeneficiaryChangesView defaultCurrentAddress={VALID_CURRENT} />);

      const addressInput = screen.getByTestId("beneficiary-new-address-input");
      const confirmCb = screen.getByTestId("beneficiary-confirm-checkbox");
      const understoodCb = screen.getByTestId("beneficiary-understood-checkbox");
      const submitBtn = screen.getByTestId("beneficiary-submit-button");

      fireEvent.change(addressInput, { target: { value: VALID_PROPOSED } });
      fireEvent.click(confirmCb);
      fireEvent.click(understoodCb);
      fireEvent.click(submitBtn);

      expect(screen.getByTestId("form-success-notice")).toHaveTextContent(
        "Beneficiary change request submitted. Complete verification steps to proceed.",
      );
    });

    it("displays error when address is invalid or empty (failure path)", () => {
      render(<BeneficiaryChangesView defaultCurrentAddress={VALID_CURRENT} />);

      const submitBtn = screen.getByTestId("beneficiary-submit-button");
      fireEvent.click(submitBtn);

      const alert = screen.getByTestId("form-error-alert");
      expect(alert).toHaveTextContent("Beneficiary address is required");
      expect(alert).toHaveTextContent("You must confirm the beneficiary change");
      expect(alert).toHaveTextContent("You must understand the version impact");
    });

    it("displays error when proposed address matches current address (boundary path)", () => {
      render(<BeneficiaryChangesView defaultCurrentAddress={VALID_CURRENT} />);

      const addressInput = screen.getByTestId("beneficiary-new-address-input");
      const confirmCb = screen.getByTestId("beneficiary-confirm-checkbox");
      const understoodCb = screen.getByTestId("beneficiary-understood-checkbox");
      const submitBtn = screen.getByTestId("beneficiary-submit-button");

      fireEvent.change(addressInput, { target: { value: VALID_CURRENT } });
      fireEvent.click(confirmCb);
      fireEvent.click(understoodCb);
      fireEvent.click(submitBtn);

      const alert = screen.getByTestId("form-error-alert");
      expect(alert).toHaveTextContent("New beneficiary must differ from current beneficiary");
    });

    it("displays error when proposed address format is invalid (boundary path)", () => {
      render(<BeneficiaryChangesView defaultCurrentAddress={VALID_CURRENT} />);

      const addressInput = screen.getByTestId("beneficiary-new-address-input");
      const confirmCb = screen.getByTestId("beneficiary-confirm-checkbox");
      const understoodCb = screen.getByTestId("beneficiary-understood-checkbox");
      const submitBtn = screen.getByTestId("beneficiary-submit-button");

      fireEvent.change(addressInput, { target: { value: "GINVALID" } });
      fireEvent.click(confirmCb);
      fireEvent.click(understoodCb);
      fireEvent.click(submitBtn);

      const alert = screen.getByTestId("form-error-alert");
      expect(alert).toHaveTextContent("Invalid Stellar address format");
    });
  });

  describe("Active payroll cycle locking", () => {
    it("locks mutation actions and displays warning when payroll is in progress", () => {
      render(
        <BeneficiaryChangesView
          defaultCurrentAddress={VALID_CURRENT}
          context={{ now: Date.now(), isPayrollInProgress: true }}
        />,
      );

      const lockWarning = screen.getByTestId("payroll-in-progress-lock");
      expect(lockWarning).toHaveTextContent("Beneficiary changes cannot be applied while an active payroll cycle is in progress");

      const addressInput = screen.getByTestId("beneficiary-new-address-input");
      const submitBtn = screen.getByTestId("beneficiary-submit-button");

      expect(addressInput).toBeDisabled();
      expect(submitBtn).toBeDisabled();
    });
  });

  describe("24-Hour Administrative Recovery Flow", () => {
    it("rejects recovery when fields are incomplete or unconfirmed (failure path)", () => {
      render(<BeneficiaryChangesView defaultCurrentAddress={VALID_CURRENT} />);

      const recoveryBtn = screen.getByTestId("beneficiary-recovery-button");
      fireEvent.click(recoveryBtn);

      const alert = screen.getByTestId("recovery-error-alert");
      expect(alert).toHaveTextContent("Recovery code is required");
      expect(alert).toHaveTextContent("Administrator confirmation is required");
    });

    it("rejects recovery with malformed recovery code length (boundary path)", () => {
      render(<BeneficiaryChangesView defaultCurrentAddress={VALID_CURRENT} />);

      const codeInput = screen.getByTestId("beneficiary-recovery-code-input");
      const adminCb = screen.getByTestId("beneficiary-recovery-admin-checkbox");
      const recoveryBtn = screen.getByTestId("beneficiary-recovery-button");

      fireEvent.change(codeInput, { target: { value: "SHORTCODE123" } });
      fireEvent.click(adminCb);
      fireEvent.click(recoveryBtn);

      const alert = screen.getByTestId("recovery-error-alert");
      expect(alert).toHaveTextContent("Invalid recovery code format");
    });

    it("successfully reverts beneficiary with valid recovery code and confirmation (success path)", () => {
      render(<BeneficiaryChangesView defaultCurrentAddress={VALID_CURRENT} />);

      const codeInput = screen.getByTestId("beneficiary-recovery-code-input");
      const adminCb = screen.getByTestId("beneficiary-recovery-admin-checkbox");
      const recoveryBtn = screen.getByTestId("beneficiary-recovery-button");

      fireEvent.change(codeInput, { target: { value: "ABCDEF0123456789ABCDEF0123456789" } });
      fireEvent.click(adminCb);
      fireEvent.click(recoveryBtn);

      expect(screen.getByTestId("recovery-success-notice")).toHaveTextContent(
        "Previous beneficiary successfully restored under 24-hour administrative undo policy.",
      );
    });
  });

  describe("Zero-knowledge & privacy boundaries", () => {
    it("renders masked addresses and never leaks raw 56-char public keys in request list", () => {
      const sampleReq: BeneficiaryChangeRequest = createBeneficiaryChangeRequest({
        id: "bcr-private-test",
        employeeRef: "emp-999",
        currentAddressMasked: "GBUQ...MD56",
        proposedAddressMasked: "GAAA...HF7E",
        requestedBy: "op-1",
      });

      render(
        <BeneficiaryChangesView
          initialRequests={[sampleReq]}
          defaultCurrentAddress={VALID_CURRENT}
        />,
      );

      const container = screen.getByTestId("beneficiary-changes-view");
      const text = container.textContent || "";

      // Must show masked address
      expect(text).toContain("GBUQ...MD56");
      expect(text).toContain("GAAA...HF7E");

      // Must NOT leak full 56-char raw strings in the request card display
      const fullCurrentRegex = new RegExp(VALID_CURRENT);
      const fullProposedRegex = new RegExp(VALID_PROPOSED);
      expect(fullCurrentRegex.test(text)).toBe(false);
      expect(fullProposedRegex.test(text)).toBe(false);

      // Must not render salary symbols or currency figures
      expect(text).not.toContain("$");
      expect(text).not.toMatch(/\b\d+,\d{3}\b/);
    });
  });

  describe("Accessibility (A11y)", () => {
    it("has accessible roles, labels, and status landmarks", () => {
      render(<BeneficiaryChangesView defaultCurrentAddress={VALID_CURRENT} />);

      expect(screen.getByRole("status", { name: /beneficiary verification/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/New beneficiary address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Recovery code/i)).toBeInTheDocument();
    });
  });
});
