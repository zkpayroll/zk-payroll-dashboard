import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PayrollCreatePage from "@/app/payroll/create/page";
import { useCompanyWarningsStore } from "@/stores/companyWarnings";

/**
 * #856: the employer role is re-read from the session endpoint when the form is
 * submitted, so a role that changed after the page loaded decides the outcome.
 */

const PRIVATE = { employee: "Ada Okafor", salary: "8500.00 USDC" };

function sessionResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

// The dashboard layout also reads the session when it mounts. Those calls get a
// fixed answer; the queued responses are only used once a submit is under way.
let submitting = false;
const LAYOUT_SESSION = () => sessionResponse(200, { role: "operator" });

function mockFetch(...responses: Array<ReturnType<typeof sessionResponse> | Error>) {
  const queue = [...responses];
  const submitCalls: Array<[unknown, unknown]> = [];
  const fetchMock = vi.fn(async (url: unknown, init: unknown) => {
    if (!submitting) return LAYOUT_SESSION();
    submitCalls.push([url, init]);
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next ?? LAYOUT_SESSION();
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock, submitCalls };
}

async function fillAndSubmit() {
  submitting = true;
  fireEvent.change(screen.getByLabelText(/asset/i, { selector: "input" }), { target: { value: "usdc" } });
  fireEvent.change(screen.getByLabelText(/External batch reference/i), {
    target: { value: `BATCH-${Math.random().toString(36).slice(2, 8).toUpperCase()}` },
  });
  fireEvent.submit(screen.getByTestId("payroll-create-submit").closest("form") as HTMLFormElement);
}

describe("Payroll create page — role refresh before submission (#856)", () => {
  beforeEach(() => {
    submitting = false;
    useCompanyWarningsStore.getState().setCompanyState({ isPaused: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("re-reads the role from the session endpoint on submit", async () => {
    const { submitCalls } = mockFetch(sessionResponse(200, { role: "operator" }));
    render(<PayrollCreatePage />);
    expect(submitCalls).toHaveLength(0);

    await fillAndSubmit();

    await waitFor(() => expect(submitCalls).toHaveLength(1));
    expect(submitCalls[0][0]).toBe("/api/auth/session");
    expect(submitCalls[0][1]).toMatchObject({ cache: "no-store" });
  });

  it("blocks the submission when the role was downgraded to a read-only role", async () => {
    mockFetch(sessionResponse(200, { role: "auditor" }));
    render(<PayrollCreatePage />);

    await fillAndSubmit();

    const error = await screen.findByTestId("payroll-create-error");
    expect(error).toHaveTextContent(/lacks the "create:payroll" permission/);
    expect(screen.queryByTestId("payroll-create-success")).not.toBeInTheDocument();
    expect(screen.getByTestId("payroll-role-refreshed")).toHaveTextContent(/now "viewer"/);
  });

  it("allows the submission and shows the new role after a promotion", async () => {
    mockFetch(sessionResponse(200, { role: "admin" }));
    render(<PayrollCreatePage />);

    await fillAndSubmit();

    expect(await screen.findByTestId("payroll-create-success")).toBeInTheDocument();
    expect(screen.getByTestId("payroll-role-refreshed")).toHaveTextContent(/now "admin"/);
    expect(screen.getByTestId("payroll-operator-permission")).toHaveTextContent(/admin/);
  });

  it("submits normally, with no role notice, when the role is unchanged", async () => {
    mockFetch(sessionResponse(200, { role: "operator" }));
    render(<PayrollCreatePage />);

    await fillAndSubmit();

    expect(await screen.findByTestId("payroll-create-success")).toBeInTheDocument();
    expect(screen.queryByTestId("payroll-role-refreshed")).not.toBeInTheDocument();
  });

  it("blocks and asks for a new sign-in when the session was revoked (401)", async () => {
    mockFetch(sessionResponse(401, { error: "Invalid or expired session" }));
    render(<PayrollCreatePage />);

    await fillAndSubmit();

    expect(await screen.findByTestId("payroll-create-error")).toHaveTextContent(/Sign in again/);
    expect(screen.queryByTestId("payroll-create-success")).not.toBeInTheDocument();
    expect(screen.getByTestId("payroll-retry-decision")).toHaveAttribute("data-reason-code", "role_refresh_failed");
    expect(screen.getByTestId("payroll-retry-decision")).toHaveAttribute("data-decision", "blocked");
  });

  it("blocks, but allows a retry, when the session service fails (503)", async () => {
    mockFetch(sessionResponse(503, PRIVATE));
    render(<PayrollCreatePage />);

    await fillAndSubmit();

    expect(await screen.findByTestId("payroll-create-error")).toHaveTextContent(/Nothing was submitted/);
    expect(screen.getByTestId("payroll-retry-decision")).toHaveAttribute("data-decision", "allowed");
    expect(screen.queryByTestId("payroll-create-success")).not.toBeInTheDocument();
  });

  it("blocks when the network request fails, and a later retry can succeed", async () => {
    mockFetch(new Error("offline"), sessionResponse(200, { role: "operator" }));
    render(<PayrollCreatePage />);

    await fillAndSubmit();
    expect(await screen.findByTestId("payroll-create-error")).toHaveTextContent(/Nothing was submitted/);

    fireEvent.submit(screen.getByTestId("payroll-create-submit").closest("form") as HTMLFormElement);
    expect(await screen.findByTestId("payroll-create-success")).toBeInTheDocument();
    expect(screen.queryByTestId("payroll-create-error")).not.toBeInTheDocument();
  });

  it("never renders private payroll data from a misbehaving session response", async () => {
    mockFetch(sessionResponse(500, PRIVATE));
    const { container } = render(<PayrollCreatePage />);

    await fillAndSubmit();
    await screen.findByTestId("payroll-create-error");

    expect(container).not.toHaveTextContent(/Ada Okafor|8500|USDC salary/);
  });

  it("does not contact the session endpoint when contracts are paused", async () => {
    useCompanyWarningsStore.getState().setCompanyState({ isPaused: true });
    const { submitCalls } = mockFetch(sessionResponse(200, { role: "admin" }));
    render(<PayrollCreatePage />);

    submitting = true;
    fireEvent.submit(screen.getByTestId("payroll-create-submit").closest("form") as HTMLFormElement);

    await screen.findByTestId("payroll-create-error");
    expect(submitCalls).toHaveLength(0);
  });
});
