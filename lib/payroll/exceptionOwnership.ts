import { useSyncExternalStore } from "react";

export type ExceptionSeverity = "low" | "medium" | "high" | "critical";

export type ExceptionSttatus = "open" | "investigating" | "resolved";

export interface PayrollException {
  id: string;
  title: string;
  description: string;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  ownerId: string | null;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OwnershipAssignment {
  exceptionId: string;
  ownerId: string;
  ownerName: string;
}

export class ExceptionOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExceptionOwnershipError";
  }
}

const SEVERITY_RANK: Record<ExceptionSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function validateAssignment(
  exception: PayrollException,
  assignment: OwnershipAssignment,
): void {
  if (!assignment.ownerId.trim()) {
    throw new ExceptionOwnershipError("Owner id is required to assign an exception.");
  }
  if (!assignment.ownerName.trim()) {
    throw new ExceptionOwnershipError("Owner name is required to assign an exception.");
  }
  if (exception.status === "resolved") {
    throw new ExceptionOwnershipError(
      "Resolved exceptions cannot be reassigned. Reopen the case first.",
    );
  }
  if (exception.ownerId === assignment.ownerId) {
    throw new ExceptionOwnershipError(
      `Exception is already owned by ${assignment.ownerName}.`,
    );
  }
}

export function assignOwner(exception: PayrollException, assignment: OwnershipAssignment): PayrollException {
  validateAssignment(exception, assignment);
  return {
    ...exception,
    ownerId: assignment.ownerId,
    ownerName: assignment.ownerName,
    status: exception.status === "open" ? "investigating" : exception.status,
    updatedAt: new Date().toISOString(),
  };
}

export function unassignOwner(exception: PayrollException): PayrollException {
  if (!exception.ownerId) {
    throw new ExceptionOwnershipError("Exception has no owner to unassign.");
  }
  if (exception.status === "resolved") {
    throw new ExceptionOwnershipError(
      "Resolved exceptions cannot have their owner removed.",
    );
  }
  return {
    ...exception,
    ownerId: null,
    ownerName: null,
    status: "open",
    updatedAt: new Date().toISOString(),
  };
}

export function sortBySeverity(exceptions: PayrollException[]): PayrollException[] {
  return [...exceptions].sort((a, b) => {
    const diff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (diff !== 0) return diff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function countUnowned(exceptions: PayrollException[]): number {
  return exceptions.filter((e) => !e.ownerId && e.status !== "resolved").length;
}

export function createExceptionStore() {
  let exceptions: PayrollException[] = [];
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => exceptions,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setExceptions: (next: PayrollException[]) => {
      exceptions = sortBySeverity(next);
      notify();
    },
    assign: (exceptionId: string, assignment: OwnershipAssignment): PayrollException => {
      const target = exceptions.find((e) => e.id === exceptionId);
      if (!target) {
        throw new ExceptionOwnershipError(`No exception found with id ${exceptionId}.`);
      }
      const updated = assignOwner(target, assignment);
      exceptions = sortBySeverity(exceptions.map((e) => (e.id === exceptionId ? updated : e)));
      notify();
      return updated;
    },
    unassign: (exceptionId: string): PayrollException => {
      const target = exceptions.find((e) => e.id === exceptionId);
      if (!target) {
        throw new ExceptionOwnershipError(`No exception found with id ${exceptionId}.`);
      }
      const updated = unassignOwner(target);
      exceptions = sortBySeverity(exceptions.map((e) => (e.id === exceptionId ? updated : e)));
      notify();
      return updated;
    },
  };
}

export type ExceptionStore = ReturnType<typeof createExceptionStore>;

export const defaultExceptionStore = createExceptionStore();

export function useExceptions(store: ExceptionStore = defaultExceptionStore) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
