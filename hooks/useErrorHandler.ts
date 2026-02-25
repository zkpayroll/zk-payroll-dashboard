"use client";

import { useState, useCallback } from "react";

/**
 * A custom hook to programmatically report errors from catch blocks.
 * This is useful for capturing errors in async functions (like blockchain transactions)
 * and triggering the nearest Error Boundary.
 */
export function useErrorHandler() {
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    throw error;
  }

  const handleError = useCallback((err: unknown) => {
    if (err instanceof Error) {
      setError(err);
    } else if (typeof err === "string") {
      setError(new Error(err));
    } else {
      setError(new Error("An unknown error occurred"));
    }
  }, []);

  return handleError;
}
