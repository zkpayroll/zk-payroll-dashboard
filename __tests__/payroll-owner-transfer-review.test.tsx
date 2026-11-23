import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import OwnerTransferReview from "@/components/features/settings/OwnerTransferReview";
import OwnerTransferReviewContainer from "@/components/features/settings/OwnerTransferReviewContainer";
import { OWNER_TRANSFER_CONFIRMATION_PHRASE, type OwnerTransferParty } from "@/src/payroll/ownerTransfer";

const OWNER_ADDRESS = "GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR";
const OPERATOR_ADDRESS = "GCATS5YOVB6ROX2WUNKGNQ2MP3GMXDMKSG2O4N5CLX3A6W4PZGZZI55U";

const owner: OwnerTransferParty = { id: "own", name: "Primary Admin", walletAddress: OWNER_ADDRESS, role: "admin" };
const operator: OwnerTransferParty = {
  id: "op",
  name: "Payroll Operator",
  walletAddress: OPERATOR_ADDRESS,
  role: "operator",
};

function setup(props: Partial<React.ComponentProps<typeof OwnerTransferReview>> = {}) {
  const onSubmit = vi.fn();
  const utils = render(
    <OwnerTransferReview
      currentOwner={owner}
      candidates={[owner, operator]}
      inFlightRunCount={0}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  const submit = () => screen.getByRole("button", { name: "Request ownership transfer" });
  const choose = (value: string) => fireEvent.change(screen.getByLabelText("New owner"), { target: { value } });
  const confirm = () => {
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: OWNER_TRANSFER_CONFIRMATION_PHRASE } });
    fireEvent.click(screen.getByLabelText(/lose owner access/));
  };
  return { ...utils, onSubmit, submit, choose, confirm };
}

const blockerCodes = () =>
  Array.from(screen.queryByTestId("owner-transfer-blockers")?.querySelectorAll("[data-code]") ?? []).map((el) =>
    el.getAttribute("data-code"),
  );

describe("OwnerTransferReview (#546)", () => {
  it("starts blocked and lists what is missing", () => {
    const { submit } = setup();
    expect(submit()).toBeDisabled();
    expect(blockerCodes()).toEqual(["no_candidate", "confirmation_mismatch", "not_acknowledged"]);
  });

  it("does not offer the current owner as a candidate", () => {
    setup();
    const options = within(screen.getByLabelText("New owner")).getAllByRole("option").map((o) => o.textContent);
    expect(options.some((o) => o?.startsWith("Primary Admin"))).toBe(false);
    expect(options.some((o) => o?.startsWith("Payroll Operator"))).toBe(true);
  });

  it("main path: review, confirm and submit an audit-safe request", () => {
    const { submit, choose, confirm, onSubmit } = setup();
    choose("op");

    const summary = screen.getByTestId("owner-transfer-summary");
    expect(summary).toHaveTextContent("Payroll Operator");
    expect(summary).toHaveTextContent("GCATS5…I55U");

    confirm();
    expect(submit()).toBeEnabled();
    fireEvent.click(submit());

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "payroll_owner_transfer_requested",
        fromOwner: "GCFIRY…YOJR",
        toOwner: "GCATS5…I55U",
      }),
    );
    expect(screen.getByTestId("owner-transfer-submitted")).toHaveTextContent(/must\s+accept/);
  });

  it("stays blocked while payroll runs are in flight", () => {
    const { submit, choose, confirm } = setup({ inFlightRunCount: 2 });
    choose("op");
    confirm();
    expect(submit()).toBeDisabled();
    expect(blockerCodes()).toEqual(["runs_in_flight"]);
    expect(screen.getByTestId("owner-transfer-blockers")).toHaveTextContent("2 payroll runs are still in progress");
  });

  it("validates a manually entered address and warns it is outside the directory", () => {
    const { choose, confirm, submit } = setup();
    choose("__manual__");
    confirm();

    fireEvent.change(screen.getByLabelText("Wallet address"), { target: { value: "GNOTAREALADDRESS" } });
    expect(blockerCodes()).toEqual(["invalid_address"]);
    expect(submit()).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Wallet address"), { target: { value: OPERATOR_ADDRESS } });
    expect(submit()).toBeEnabled();
    expect(screen.getByTestId("owner-transfer-warnings")).toHaveTextContent(/not in the role directory/);
  });

  it("never renders a full wallet address", () => {
    const { container, choose, confirm, submit } = setup();
    choose("op");
    confirm();
    expect(container.textContent).not.toContain(OWNER_ADDRESS);
    expect(container.textContent).not.toContain(OPERATOR_ADDRESS);
    fireEvent.click(submit());
    expect(container.textContent).not.toContain(OWNER_ADDRESS);
    expect(container.textContent).not.toContain(OPERATOR_ADDRESS);
  });
});

describe("OwnerTransferReviewContainer", () => {
  it("loads directory candidates and blocks on the seeded in-flight run", async () => {
    render(<OwnerTransferReviewContainer />);
    await waitFor(() => expect(screen.getByTestId("owner-transfer-review")).toBeInTheDocument());
    // MOCK_PAYROLL_RUNS contains a pending run, so the transfer must be blocked.
    expect(blockerCodes()).toContain("runs_in_flight");
  });
});
