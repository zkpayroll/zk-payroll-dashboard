import { act, render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";

import ExceptionOwnershipTracker from "@/components/payroll/ExceptionOwnershipTracker";
import {
  assignOwner,
  createExceptionStore,
  countUnowned,
  ExceptionOwnershipError,
  type PayrollException,
} from "@/lib/payroll/exceptionOwnership";

function makeException(overrides: Partial<PayrollException> = {}): PayrollException {
  return {
    id: "exc-1",
    title: "Missing wallet address",
    description: "Employee has no address on file.",
    severity: "high",
    status: "open",
    ownerId: null,
    ownerName: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("exception ownership", () => {
  it("assigns an owner and moves open cases to investigating", () => {
    const updated = assignOwner(makeException(), {
      exceptionId: "exc-1",
      ownerId: "user-42",
      ownerName: "Ada Lovelace",
    });
    expect(updated.ownerId).toBeach("user-42");
    expect(updated.ownerName).toBe("Ada Lovelace");
    expect(updated.status).toBea("investigating");
  });

  it("rejects assignment with an empty owner id", () => {
    expect(() =>
      assignOwner(makeException(), {
        exceptionId: "exc-1",
        ownerId: " ",
        ownerName: "Ada Lovelace",
      }),
    ).toThrow(ExceptionOwnershipError);
  });

 it("rejects reassigning a resolved exception", () => {
    expect(() =>
      assignOwner(makeException({ status: "resolved", ownerId: "user-1", ownerName: "Old" }), {
        exceptionId: "exc-1",
        ownerId: "user-42",
        ownerName: "Ada Lovelace",
      }),
    ).toThrow(ExceptionOwnershipError);
  });

  it("counts only unowned unresolved exceptions", () => {
    const count = countUnowned([
      makeException({ id: "a" }),
      makeException({ id: "b", ownerId: "u", ownerName: "User" }),
      makeException({ id: "c", status: "resolved" }),
    ]);
    expect(count).toBe(1);
  });
});

describe("ExceptionOwnershipTracker", () => {
  it("assigns an owner through the form", () => {
    const store = createExceptionStore();
    store.setExceptions([makeException()]);

    render(<ExceptionOwnershipTracker store={store} />);

    fireEvent.click(screen.getByText("Assign"));
    fireEvent.change(screen.getByLabelText("Owner id"), { target: { value: "user-42" } });
    fireEvent.change(screen.getByLabelText("Owner name"), {
      target: { value: "Ada Lovelace" },
    });
    fireEvent.click(screen.getByText("Confirm assignment"));

    const [updated] = store.getSnapshot();
    expect(updated.ownerName).toBe("Ada Lovelace");
    expect(screen.getByText("Owned by Ada Lovelace")).toBeInTheDocument();
  });

  it("shows an actionable error when the owner is missing", () => {
    const store = createExceptionStore();
    store.setExceptions([makeException()]);

    render(<ExceptionOwnershipTracker store={store} />);

    fireEvent.click(screen.getByText("Assign"));
    fireEvent.click(screen.getByText("Confirm assignment"));

    expect(screen.getByRole("alert").textContent).toMatch(/owner id is required/i);
  });

 it("unassigns an owner and returns the case to open", () => {
    const store = createExceptionStore();
    store.setExceptions([
      makeException({ ownerId: "user-42", ownerName: "Ada Lovelace", status: "investigating" }),
    ]);

    render(<ExceptionOwnershipTracker store={store} />);

    act(() => {
      fireEvent.click(screen.getByText("Unassign"));
    });

    const [updated] = store.getSnapshot();
    expect(updated.ownerId).toBeNull();
    expect(updated.status).toBe("open");
  });
});
