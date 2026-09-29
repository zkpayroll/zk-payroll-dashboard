import { create } from "zustand";

export type RetryStatus =
  | "pending"
  | "retrying"
  | "recovered"
  | "exhausted"
  | "cancelled";

export interface NetworkRetryOperation {
  id: string;
  operationName: string;
  description?: string;
  isIdempotent: boolean;
  status: RetryStatus;
  attempt: number;
  maxRetries: number;
  nextRetryDelayMs: number;
  nextRetryAt: number | null;
  lastError: string | null;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  remediationPage: string;
  remediationActionLabel: string;
  idempotencyWarning?: string;
}

export interface StartOperationParams {
  id?: string;
  operationName: string;
  description?: string;
  isIdempotent?: boolean;
  maxRetries?: number;
  nextRetryDelayMs?: number;
  remediationPage?: string;
  remediationActionLabel?: string;
  idempotencyWarning?: string;
}

export interface RecordRetryParams {
  attempt: number;
  maxRetries?: number;
  nextRetryDelayMs: number;
  nextRetryAt?: number;
  error: string;
}

export interface RecordExhaustedParams {
  error: string;
  remediationPage?: string;
  remediationActionLabel?: string;
}

interface NetworkStatusState {
  operations: NetworkRetryOperation[];
  startOperation: (params: StartOperationParams) => string;
  recordRetry: (id: string, params: RecordRetryParams) => void;
  recordSuccess: (id: string, autoDismissDelayMs?: number) => void;
  recordExhausted: (id: string, params: RecordExhaustedParams) => void;
  cancelOperation: (id: string, reason?: string) => void;
  dismissOperation: (id: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;
  getOperation: (id: string) => NetworkRetryOperation | undefined;
}

const DEFAULT_REMEDIATION_PAGE = "network-remediation";
const DEFAULT_REMEDIATION_LABEL = "Open Remediation Guide";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 2000;

export const useNetworkStatusStore = create<NetworkStatusState>((set, get) => ({
  operations: [],

  startOperation: (params) => {
    const id =
      params.id ??
      `rpc_op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    const isIdempotent = params.isIdempotent ?? true;

    const newOp: NetworkRetryOperation = {
      id,
      operationName: params.operationName,
      description: params.description,
      isIdempotent,
      status: "pending",
      attempt: 0,
      maxRetries: params.maxRetries ?? DEFAULT_MAX_RETRIES,
      nextRetryDelayMs: params.nextRetryDelayMs ?? DEFAULT_INITIAL_DELAY_MS,
      nextRetryAt: null,
      lastError: null,
      startedAt: now,
      updatedAt: now,
      remediationPage: params.remediationPage ?? DEFAULT_REMEDIATION_PAGE,
      remediationActionLabel:
        params.remediationActionLabel ?? DEFAULT_REMEDIATION_LABEL,
      idempotencyWarning:
        params.idempotencyWarning ??
        (!isIdempotent
          ? "Non-idempotent operation: Retrying transaction submission may risk duplicate actions. Please verify ledger confirmation before re-triggering."
          : undefined),
    };

    set((state) => ({
      operations: [newOp, ...state.operations.filter((op) => op.id !== id)],
    }));

    return id;
  },

  recordRetry: (id, params) => {
    const now = Date.now();
    const nextRetryAt =
      params.nextRetryAt ?? (params.nextRetryDelayMs > 0 ? now + params.nextRetryDelayMs : null);

    set((state) => ({
      operations: state.operations.map((op) => {
        if (op.id !== id) return op;
        return {
          ...op,
          status: "retrying",
          attempt: params.attempt,
          maxRetries: params.maxRetries ?? op.maxRetries,
          nextRetryDelayMs: params.nextRetryDelayMs,
          nextRetryAt,
          lastError: params.error,
          updatedAt: now,
        };
      }),
    }));
  },

  recordSuccess: (id, autoDismissDelayMs = 4000) => {
    const now = Date.now();
    set((state) => ({
      operations: state.operations.map((op) => {
        if (op.id !== id) return op;
        return {
          ...op,
          status: "recovered",
          nextRetryAt: null,
          updatedAt: now,
          completedAt: now,
        };
      }),
    }));

    if (autoDismissDelayMs > 0) {
      setTimeout(() => {
        const currentOp = get().getOperation(id);
        if (currentOp && currentOp.status === "recovered") {
          get().dismissOperation(id);
        }
      }, autoDismissDelayMs);
    }
  },

  recordExhausted: (id, params) => {
    const now = Date.now();
    set((state) => ({
      operations: state.operations.map((op) => {
        if (op.id !== id) return op;
        return {
          ...op,
          status: "exhausted",
          lastError: params.error,
          nextRetryAt: null,
          remediationPage: params.remediationPage ?? op.remediationPage,
          remediationActionLabel:
            params.remediationActionLabel ?? op.remediationActionLabel,
          updatedAt: now,
          completedAt: now,
        };
      }),
    }));
  },

  cancelOperation: (id, reason) => {
    const now = Date.now();
    set((state) => ({
      operations: state.operations.map((op) => {
        if (op.id !== id) return op;
        return {
          ...op,
          status: "cancelled",
          lastError: reason ?? op.lastError ?? "Operation cancelled by user",
          nextRetryAt: null,
          updatedAt: now,
          completedAt: now,
        };
      }),
    }));
  },

  dismissOperation: (id) => {
    set((state) => ({
      operations: state.operations.filter((op) => op.id !== id),
    }));
  },

  clearCompleted: () => {
    set((state) => ({
      operations: state.operations.filter(
        (op) =>
          op.status !== "recovered" &&
          op.status !== "exhausted" &&
          op.status !== "cancelled",
      ),
    }));
  },

  clearAll: () => {
    set({ operations: [] });
  },

  getOperation: (id) => {
    return get().operations.find((op) => op.id === id);
  },
}));

export interface ExecuteWithRetryOptions {
  id?: string;
  operationName: string;
  description?: string;
  isIdempotent?: boolean;
  maxRetries?: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  remediationPage?: string;
  remediationActionLabel?: string;
  idempotencyWarning?: string;
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
  signal?: AbortSignal;
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: ExecuteWithRetryOptions,
): Promise<T> {
  const store = useNetworkStatusStore.getState();
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const initialDelayMs = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const backoffMultiplier = options.backoffMultiplier ?? 2;
  const maxDelayMs = options.maxDelayMs ?? 15000;

  const id = store.startOperation({
    id: options.id,
    operationName: options.operationName,
    description: options.description,
    isIdempotent: options.isIdempotent,
    maxRetries,
    nextRetryDelayMs: initialDelayMs,
    remediationPage: options.remediationPage,
    remediationActionLabel: options.remediationActionLabel,
    idempotencyWarning: options.idempotencyWarning,
  });

  let currentDelay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    // Check if cancelled via store or AbortSignal
    const currentOp = useNetworkStatusStore.getState().getOperation(id);
    if (currentOp?.status === "cancelled" || options.signal?.aborted) {
      useNetworkStatusStore
        .getState()
        .cancelOperation(id, "Operation cancelled before execution");
      throw new Error("Operation cancelled");
    }

    try {
      const result = await operation();
      useNetworkStatusStore.getState().recordSuccess(id);
      return result;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : String(err ?? "Network request failed");

      if (attempt > maxRetries) {
        useNetworkStatusStore.getState().recordExhausted(id, {
          error: errorMessage,
          remediationPage: options.remediationPage,
          remediationActionLabel: options.remediationActionLabel,
        });
        throw err instanceof Error ? err : new Error(errorMessage);
      }

      // Check cancellation again before scheduling retry
      const preDelayOp = useNetworkStatusStore.getState().getOperation(id);
      if (preDelayOp?.status === "cancelled" || options.signal?.aborted) {
        useNetworkStatusStore
          .getState()
          .cancelOperation(id, "Operation cancelled during retry sequence");
        throw new Error("Operation cancelled");
      }

      const delayForThisAttempt = Math.min(currentDelay, maxDelayMs);
      const nextRetryAt = Date.now() + delayForThisAttempt;

      useNetworkStatusStore.getState().recordRetry(id, {
        attempt,
        maxRetries,
        nextRetryDelayMs: delayForThisAttempt,
        nextRetryAt,
        error: errorMessage,
      });

      if (options.onRetry && err instanceof Error) {
        options.onRetry(attempt, err, delayForThisAttempt);
      }

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(resolve, delayForThisAttempt);

        const checkCancel = setInterval(() => {
          const checkOp = useNetworkStatusStore.getState().getOperation(id);
          if (checkOp?.status === "cancelled" || options.signal?.aborted) {
            clearTimeout(timeout);
            clearInterval(checkCancel);
            reject(new Error("Operation cancelled"));
          }
        }, 100);

        if (options.signal) {
          options.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timeout);
              clearInterval(checkCancel);
              reject(new Error("Operation cancelled"));
            },
            { once: true },
          );
        }
      });

      currentDelay = Math.round(currentDelay * backoffMultiplier);
    }
  }

  throw new Error("Retry sequence ended unexpectedly");
}
