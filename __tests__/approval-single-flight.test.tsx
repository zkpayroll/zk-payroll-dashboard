import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AmendmentApproval } from "@/components/amendments/AmendmentApproval";
import SnapshotLockApproval from "@/src/components/snapshots/SnapshotLockApproval";
import { MOCK_AMENDMENTS } from "@/lib/sdk/amendments";
import { MOCK_SNAPSHOTS } from "@/lib/sdk/snapshots";

const amendment = MOCK_AMENDMENTS.find((a) => a.id === "amd_valid_001")!;
const snapshot = MOCK_SNAPSHOTS.find((s) => s.id === "snap_valid_001")!;

type SubmitApproval = (id: string) => Promise<void>;

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const cases = [
  {
    name: "amendment",
    buttonId: "amendment-approve-button",
    successId: "amendment-approved-state",
    pendingId: "amendment-approving",
    id: amendment.id,
    message: "Could not approve the amendment. Please try again.",
    element: (onApprove?: SubmitApproval, id = amendment.id) => (
      <AmendmentApproval amendmentId={id} amendment={{ ...amendment, id }} onApprove={onApprove} />
    ),
    blockedElement: (onApprove: SubmitApproval) => (
      <AmendmentApproval amendmentId={amendment.id} amendment={{ ...amendment, isStale: true }} onApprove={onApprove} />
    ),
    blockedButtonId: "amendment-approve-disabled",
  },
  {
    name: "snapshot",
    buttonId: "snapshot-lock-button",
    successId: "snapshot-locked-state",
    pendingId: "snapshot-locking",
    id: snapshot.id,
    message: "Could not approve the snapshot lock. Please try again.",
    element: (onApprove?: SubmitApproval, id = snapshot.id) => (
      <SnapshotLockApproval snapshotId={id} snapshot={{ ...snapshot, id }} onApprove={onApprove} />
    ),
    blockedElement: (onApprove: SubmitApproval) => (
      <SnapshotLockApproval snapshotId={snapshot.id} snapshot={{ ...snapshot, isStale: true }} onApprove={onApprove} />
    ),
    blockedButtonId: "snapshot-lock-disabled",
  },
];

describe.each(cases)("$name approval single flight (#805)", (subject) => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("starts one simulated request for repeated clicks before React commits", async () => {
    render(subject.element());
    const timer = vi.spyOn(globalThis, "setTimeout");
    const button = screen.getByTestId(subject.buttonId);
    // One act batch keeps the same rendered handler live for every click.
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
    });
    const approvalTimers = timer.mock.calls.filter(([, delay]) => delay === 600);
    expect(approvalTimers).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(screen.getByTestId(subject.successId)).toBeInTheDocument();
  });

  it("submits once, stays disabled on metadata refresh, and renders success", async () => {
    const request = deferred();
    const submit = vi.fn<SubmitApproval>(() => request.promise);
    const view = render(subject.element(submit));
    const button = screen.getByTestId(subject.buttonId);
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(submit).toHaveBeenCalledExactlyOnceWith(subject.id);
    expect(screen.getByTestId(subject.pendingId)).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: /approving/i })).toBeDisabled();
    view.rerender(subject.element(submit));
    expect(screen.getByTestId(subject.pendingId)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /approving/i }));
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { request.resolve(); });
    expect(screen.getByTestId(subject.successId)).toBeInTheDocument();
    expect(screen.queryByTestId(subject.buttonId)).not.toBeInTheDocument();
  });

  it("redacts a rejection, releases the guard, and permits one successful retry", async () => {
    const first = deferred();
    const second = deferred();
    const submit = vi.fn<SubmitApproval>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    render(subject.element(submit));
    fireEvent.click(screen.getByTestId(subject.buttonId));
    await act(async () => { first.reject(new Error("private-payroll-detail-do-not-display")); });
    expect(screen.getByRole("alert")).toHaveTextContent(subject.message);
    expect(document.body.textContent).not.toContain("private-payroll-detail-do-not-display");
    const retry = screen.getByTestId(subject.buttonId);
    expect(retry).toBeEnabled();
    act(() => {
      fireEvent.click(retry);
      fireEvent.click(retry);
    });
    expect(submit).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await act(async () => { second.resolve(); });
    expect(screen.getByTestId(subject.successId)).toBeInTheDocument();
  });

  it("also releases the guard if an adapter throws synchronously", async () => {
    const submit = vi.fn<SubmitApproval>()
      .mockImplementationOnce(() => { throw new Error("private synchronous failure"); })
      .mockResolvedValueOnce(undefined);
    render(subject.element(submit));
    fireEvent.click(screen.getByTestId(subject.buttonId));
    expect(screen.getByRole("alert")).toHaveTextContent(subject.message);
    expect(document.body.textContent).not.toContain("private synchronous failure");
    await act(async () => { fireEvent.click(screen.getByTestId(subject.buttonId)); });
    expect(submit).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId(subject.successId)).toBeInTheDocument();
  });

  it.each(["resolve", "reject"] as const)(
    "ignores a previous record's late %s without unlocking the next record's request",
    async (outcome) => {
      const first = deferred();
      const second = deferred();
      const submit = vi.fn<SubmitApproval>()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      const view = render(subject.element(submit));
      fireEvent.click(screen.getByTestId(subject.buttonId));
      const nextId = `${subject.id}-next`;
      view.rerender(subject.element(submit, nextId));
      fireEvent.click(screen.getByTestId(subject.buttonId));
      expect(submit.mock.calls).toEqual([[subject.id], [nextId]]);
      await act(async () => {
        if (outcome === "resolve") first.resolve();
        else first.reject(new Error("late private failure"));
      });
      expect(screen.getByTestId(subject.pendingId)).toBeInTheDocument();
      expect(screen.queryByTestId(subject.successId)).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      view.rerender(subject.element(submit, nextId));
      expect(screen.getByTestId(subject.pendingId)).toBeInTheDocument();
      expect(submit).toHaveBeenCalledTimes(2);
      await act(async () => { second.resolve(); });
      expect(screen.getByTestId(subject.successId)).toBeInTheDocument();
    },
  );

  it("keeps existing stale-data validation gates intact", () => {
    const submit = vi.fn<SubmitApproval>().mockResolvedValue(undefined);
    render(subject.blockedElement(submit));
    const button = screen.getByTestId(subject.blockedButtonId);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(submit).not.toHaveBeenCalled();
  });

  it("does not retain a guard across unmount and remount", async () => {
    const first = deferred();
    const second = deferred();
    const submit = vi.fn<SubmitApproval>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const oldView = render(subject.element(submit));
    fireEvent.click(screen.getByTestId(subject.buttonId));
    oldView.unmount();
    render(subject.element(submit));
    fireEvent.click(screen.getByTestId(subject.buttonId));
    await act(async () => { first.resolve(); });
    expect(screen.getByTestId(subject.pendingId)).toBeInTheDocument();
    expect(submit).toHaveBeenCalledTimes(2);
    await act(async () => { second.resolve(); });
    expect(screen.getByTestId(subject.successId)).toBeInTheDocument();
  });

});
